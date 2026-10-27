package handler

// C1 S3 兼容网关（研究文档 C1）：gofakes3（纯 Go）做 S3 协议/XML 层，
// 后端直接映射 fscore Driver——对象 key ↔ 虚拟路径，桶 ↔ 存储策略字母。
// 每用户一组 SigV4 密钥（鉴权在 s3.go），本地盘按用户隔离（UserDirOf 走 DriverFor）。
// 写路径复用 Driver.CreateFile（保留秒传台账/净化规则），Delete 直删（S3 语义无回收站）。

import (
	"io"
	"path"
	"strings"
	"time"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"

	"github.com/johannesboyne/gofakes3"
)

// s3BucketPrefix 桶名 = "disk-" + 策略字母小写（S3 桶名要求 ≥3 字符且全小写）
const s3BucketPrefix = "disk-"

func s3BucketName(letter string) string { return s3BucketPrefix + strings.ToLower(letter) }

func s3LetterFromBucket(name string) (string, bool) {
	if !strings.HasPrefix(name, s3BucketPrefix) {
		return "", false
	}
	l := strings.ToUpper(strings.TrimPrefix(name, s3BucketPrefix))
	if len(l) == 1 && l[0] >= 'A' && l[0] <= 'Z' {
		return l, true
	}
	return "", false
}

// s3Backend 每用户一个实例（handler 缓存按 userID）。ro 用户在 Put/Delete/Copy 处被挡。
type s3Backend struct {
	u   *model.User
	svc *fscore.Service
}

var _ gofakes3.Backend = (*s3Backend)(nil)

// policyFor 桶名 → 策略（须对该用户可用，同 WebDAV 字母语义）
func (b *s3Backend) policyFor(bucket string) (*model.Policy, error) {
	letter, ok := s3LetterFromBucket(bucket)
	if !ok {
		return nil, gofakes3.BucketNotFound(bucket)
	}
	var p model.Policy
	if err := model.DB.Where("letter = ? AND status != ?", letter, "disabled").First(&p).Error; err != nil {
		return nil, gofakes3.BucketNotFound(bucket)
	}
	if b.u.Role != "admin" && p.Type == "builtin" {
		return nil, gofakes3.BucketNotFound(bucket)
	}
	var g model.UserGroup
	_ = model.DB.First(&g, b.u.GroupID).Error
	if !policyUsable(b.u, &g, &p) {
		return nil, gofakes3.BucketNotFound(bucket)
	}
	return &p, nil
}

func (b *s3Backend) driverFor(bucket string) (*model.Policy, fscore.Driver, error) {
	p, err := b.policyFor(bucket)
	if err != nil {
		return nil, nil, err
	}
	d, err := b.svc.DriverFor(p, b.u)
	if err != nil {
		return nil, nil, err
	}
	return p, d, nil
}

// keyToVP 对象 key → 虚拟路径（key 已是相对桶根的纯路径）
func keyToVP(key string) string {
	k := strings.TrimPrefix(key, "/")
	if k == "" {
		return "/"
	}
	return "/" + k
}

func (b *s3Backend) ListBuckets() ([]gofakes3.BucketInfo, error) {
	var list []model.Policy
	model.DB.Where("status != ?", "disabled").Order("letter").Find(&list)
	var g model.UserGroup
	_ = model.DB.First(&g, b.u.GroupID).Error
	out := make([]gofakes3.BucketInfo, 0, len(list))
	for _, p := range list {
		if b.u.Role != "admin" && p.Type == "builtin" {
			continue
		}
		if !policyUsable(b.u, &g, &p) {
			continue
		}
		out = append(out, gofakes3.BucketInfo{
			Name:         s3BucketName(p.Letter),
			CreationDate: gofakes3.ContentTime{Time: p.CreatedAt},
		})
	}
	return out, nil
}

func (b *s3Backend) BucketExists(name string) (bool, error) {
	_, err := b.policyFor(name)
	if err == gofakes3.ErrNoSuchBucket {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// CreateBucket 桶即策略字母，不允许动态建：已存在回 AlreadyOwnedByYou，否则未实现
func (b *s3Backend) CreateBucket(name string) error {
	if ok, _ := b.BucketExists(name); ok {
		return gofakes3.ResourceError(gofakes3.ErrBucketAlreadyExists, name)
	}
	return gofakes3.ErrNotImplemented
}

func (b *s3Backend) DeleteBucket(name string) error { return gofakes3.ErrNotImplemented }
func (b *s3Backend) ForceDeleteBucket(name string) error { return gofakes3.ErrNotImplemented }

// ListBucket 前缀+分隔符语义交给 gofakes3.Prefix.Match；递归下降按前缀目录剪枝。
// 分页参数忽略（返回全量）：自建网盘规模下 rclone/SDK 均可正常消费。
func (b *s3Backend) ListBucket(name string, prefix *gofakes3.Prefix, page gofakes3.ListBucketPage) (*gofakes3.ObjectList, error) {
	_, d, err := b.driverFor(name)
	if err != nil {
		return nil, err
	}
	if prefix == nil {
		prefix = &gofakes3.Prefix{}
	}
	res := gofakes3.NewObjectList()
	seen := map[string]struct{}{}
	// 剪枝：从 prefix 的目录层开始走，避免全树遍历
	startVP := "/"
	if prefix.HasPrefix {
		if i := strings.LastIndex(prefix.Prefix, "/"); i > 0 {
			startVP = prefix.Prefix[:i]
		}
	}
	var walk func(vp string) error
	walk = func(vp string) error {
		entries, err := d.List(vp)
		if err != nil {
			return nil // 不存在的目录目录层：跳过（Stat 层面已保证桶存在）
		}
		for _, e := range entries {
			if e.Name == "" || strings.HasPrefix(e.Name, ".") {
				continue // 隐藏文件（.versions/.thumbs 等系统目录）不经 S3 暴露
			}
			child := path.Join(vp, e.Name)
			key := strings.TrimPrefix(child, "/")
			var m gofakes3.PrefixMatch
			if !prefix.Match(key, &m) {
				if e.IsDir {
					// 目录未匹配但可能是更深匹配的祖先（prefix 深于该目录时）
					if prefix.HasPrefix && strings.HasPrefix(prefix.Prefix, key+"/") {
						if err := walk(child); err != nil {
							return err
						}
					}
				}
				continue
			}
			if m.CommonPrefix {
				if _, dup := seen[m.MatchedPart]; !dup {
					seen[m.MatchedPart] = struct{}{}
					res.CommonPrefixes = append(res.CommonPrefixes, m.AsCommonPrefix())
				}
				continue
			}
			if e.IsDir {
				// 目录条目作为内容键无 size 语义；仅继续下钻
				if err := walk(child); err != nil {
					return err
				}
				continue
			}
			res.Contents = append(res.Contents, &gofakes3.Content{
				Key:          key,
				LastModified: gofakes3.NewContentTime(time.UnixMilli(e.ModTime)),
				Size:         e.Size,
			})
		}
		return nil
	}
	if err := walk(startVP); err != nil {
		return nil, err
	}
	return res, nil
}

func (b *s3Backend) head(bucket, key string) (*gofakes3.Object, error) {
	_, d, err := b.driverFor(bucket)
	if err != nil {
		return nil, err
	}
	vp := keyToVP(key)
	e, err := d.Stat(vp)
	if err != nil || e.IsDir {
		return nil, gofakes3.KeyNotFound(key)
	}
	return &gofakes3.Object{
		Name:       key,
		Size:       e.Size,
		Contents:   io.NopCloser(strings.NewReader("")),
	}, nil
}

func (b *s3Backend) HeadObject(bucket, key string) (*gofakes3.Object, error) {
	return b.head(bucket, key)
}

// GetObject 支持单区间 Range（rclone 断点续传依赖）；多区间未实现
func (b *s3Backend) GetObject(bucket, key string, rnge *gofakes3.ObjectRangeRequest) (*gofakes3.Object, error) {
	obj, err := b.head(bucket, key)
	if err != nil {
		return nil, err
	}
	_, d, err := b.driverFor(bucket)
	if err != nil {
		return nil, err
	}
	f, err := d.Open(keyToVP(key))
	if err != nil {
		return nil, gofakes3.KeyNotFound(key)
	}
	if rnge != nil {
		rng, err := rnge.Range(obj.Size)
		if err != nil {
			f.Close()
			return nil, gofakes3.ErrInvalidRange
		}
		if _, err := f.Seek(rng.Start, io.SeekStart); err != nil {
			f.Close()
			return nil, err
		}
		obj.Size = rng.Length
		obj.Range = rng
		obj.Contents = &limitedCloser{Reader: io.LimitReader(f, rng.Length), c: f}
		return obj, nil
	}
	obj.Contents = f
	return obj, nil
}

type limitedCloser struct {
	io.Reader
	c io.Closer
}

func (l *limitedCloser) Close() error { return l.c.Close() }

func (b *s3Backend) PutObject(bucket, key string, meta map[string]string, input io.Reader, size int64, conditions *gofakes3.PutConditions) (gofakes3.PutObjectResult, error) {
	if key == "" {
		return gofakes3.PutObjectResult{}, gofakes3.ErrInvalidArgument
	}
	_, d, err := b.driverFor(bucket)
	if err != nil {
		return gofakes3.PutObjectResult{}, err
	}
	vp := keyToVP(key)
	if err := d.CreateFile(vp, input); err != nil {
		return gofakes3.PutObjectResult{}, err
	}
	return gofakes3.PutObjectResult{}, nil
}

func (b *s3Backend) DeleteObject(bucket, key string) (gofakes3.ObjectDeleteResult, error) {
	_, d, err := b.driverFor(bucket)
	if err != nil {
		return gofakes3.ObjectDeleteResult{}, err
	}
	if err := d.Delete(keyToVP(key)); err != nil {
		// S3 语义：删不存在的键不报错
		if _, serr := d.Stat(keyToVP(key)); serr == nil {
			return gofakes3.ObjectDeleteResult{}, err
		}
	}
	return gofakes3.ObjectDeleteResult{}, nil
}

func (b *s3Backend) DeleteMulti(bucket string, objects ...string) (gofakes3.MultiDeleteResult, error) {
	res := gofakes3.MultiDeleteResult{}
	_, d, err := b.driverFor(bucket)
	if err != nil {
		return gofakes3.MultiDeleteResult{}, err
	}
	for _, k := range objects {
		if err := d.Delete(keyToVP(k)); err != nil {
			if _, serr := d.Stat(keyToVP(k)); serr == nil {
				res.Error = append(res.Error, gofakes3.ErrorResult{Key: k, Message: err.Error()})
				continue
			}
		}
		res.Deleted = append(res.Deleted, gofakes3.ObjectID{Key: k})
	}
	return res, nil
}

func (b *s3Backend) CopyObject(srcBucket, srcKey, dstBucket, dstKey string, meta map[string]string) (gofakes3.CopyObjectResult, error) {
	_, sd, err := b.driverFor(srcBucket)
	if err != nil {
		return gofakes3.CopyObjectResult{}, err
	}
	_, dd, err := b.driverFor(dstBucket)
	if err != nil {
		return gofakes3.CopyObjectResult{}, err
	}
	f, err := sd.Open(keyToVP(srcKey))
	if err != nil {
		return gofakes3.CopyObjectResult{}, gofakes3.KeyNotFound(srcKey)
	}
	defer f.Close()
	if err := dd.CreateFile(keyToVP(dstKey), f); err != nil {
		return gofakes3.CopyObjectResult{}, err
	}
	return gofakes3.CopyObjectResult{}, nil
}
