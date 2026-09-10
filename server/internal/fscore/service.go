package fscore

import (
	"archive/tar"
	"archive/zip"
	"compress/bzip2"
	"compress/gzip"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/model"
)

// Service 文件服务：策略解析 + 驱动缓存 + 上传会话
type Service struct {
	TmpDir     string // 上传分片临时区
	RecycleDir string // 回收区根目录
	ThumbDir   string // 图片缩略图缓存区
	ZipTmp     string // zip 解压临时区（流式解压用，避免整包读入内存）
	mu         sync.Mutex
	drivers    map[string]*cachedDriver
}

func NewService(tmpDir, recycleDir, thumbDir, zipTmp string) *Service {
	return &Service{TmpDir: tmpDir, RecycleDir: recycleDir, ThumbDir: thumbDir, ZipTmp: zipTmp, drivers: map[string]*cachedDriver{}}
}

// Invalidate 失效某策略的全部驱动缓存（含各用户的本地隔离实例）
func (s *Service) Invalidate(policyID uint) {
	s.mu.Lock()
	for k := range s.drivers {
		if k == fmt.Sprintf("p%d", policyID) || strings.HasPrefix(k, fmt.Sprintf("u%d:", policyID)) {
			delete(s.drivers, k)
		}
	}
	s.mu.Unlock()
}

// Resolve 校验用户可用性并返回策略与该用户视角的驱动（本地策略 = 用户隔离目录）
func (s *Service) Resolve(user *model.User, group *model.UserGroup, policyID uint) (*model.Policy, Driver, error) {
	var p model.Policy
	if err := model.DB.First(&p, policyID).Error; err != nil {
		return nil, nil, errors.New("存储策略不存在")
	}
	if p.Status == "disabled" {
		return nil, nil, errors.New("该存储已停用")
	}
	if user.Role != "admin" && !group.CanUsePolicy(p.ID) {
		return nil, nil, errors.New("无权访问该存储")
	}
	d, err := s.DriverFor(&p, user)
	if err != nil {
		return nil, nil, err
	}
	return &p, d, nil
}

// ---- 秒传哈希索引 ----

// LookupHash 查询秒传索引（导出供 handler 使用）
func (s *Service) LookupHash(hash string, size int64) *model.FileHash { return s.lookupHash(hash, size) }

func (s *Service) lookupHash(hash string, size int64) *model.FileHash {
	if hash == "" || size <= 0 {
		return nil
	}
	var fh model.FileHash
	if err := model.DB.Where("hash = ? AND size = ?", hash, size).First(&fh).Error; err != nil {
		return nil
	}
	fi, err := os.Stat(fh.SourcePath)
	if err != nil {
		return nil
	}
	// 源文件被损坏（大小不符）时视为索引失效，走正常上传流程自愈
	if fi.Size() != fh.Size {
		return nil
	}
	return &fh
}

// InstantPut 秒传落盘：优先硬链接（同卷），失败则服务器本地复制
func (s *Service) InstantPut(fh *model.FileHash, physTarget string, userID uint, policyID uint, vp string) error {
	if err := os.MkdirAll(filepath.Dir(physTarget), 0o755); err != nil {
		return err
	}
	// 秒传目标即为已有文件（同路径重复上传，或源文件本身就是目标）时，内容已就位，无需落盘
	if srcFi, err1 := os.Stat(fh.SourcePath); err1 == nil {
		if tgtFi, err2 := os.Stat(physTarget); err2 == nil && os.SameFile(srcFi, tgtFi) {
			return nil
		}
	}
	// 版本管理：如果目标文件已存在，保存旧版本
	SaveVersion(policyID, userID, vp, physTarget)
	// 目标是已存在的目录时不能硬链接/复制成文件（Windows 报 267 类错误）
	if err := ensureFileTarget(physTarget); err != nil {
		return err
	}
	if os.Link(fh.SourcePath, physTarget) == nil {
		RegisterCopy(fh.Hash, physTarget)
		return nil
	}
	in, err := os.Open(fh.SourcePath)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(physTarget)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	if err == nil {
		RegisterCopy(fh.Hash, physTarget)
	}
	return err
}

// ---- 秒传索引副本账本 ----
//
// FileHash：同一内容一条（哈希/大小/当前可用源/存活副本数）。
// FileHashCopy：每个物理副本一条（硬链接/拷贝，含回收站与版本文件中的副本）。
// 语义对齐百度网盘：某用户删除自己的副本（含清空回收站）只移除自己的记录，
// 只要还有任意副本存活，索引就保留、秒传继续可用；
// 最后一个副本物理消失时索引才删除，文件数据也在此时真正释放（硬链接数归零）。

// RegisterHash 登记内容索引与本次落盘的物理副本（新内容定稿时：分块上传完成 / 文本写入）
func (s *Service) RegisterHash(hash string, size int64, phys string) {
	if hash == "" || size <= 0 || phys == "" {
		return
	}
	var fh model.FileHash
	if err := model.DB.Where("hash = ?", hash).First(&fh).Error; err != nil {
		model.DB.Create(&model.FileHash{Hash: hash, Size: size, SourcePath: phys, RefCount: 1})
	} else if fi, e := os.Stat(fh.SourcePath); e != nil || fi.Size() != size {
		// 已有源损坏/消失时用本次落盘的新源替换
		model.DB.Model(&fh).Updates(map[string]interface{}{"source_path": phys, "size": size})
	}
	upsertHashCopy(hash, phys)
	reconcileHash(hash)
}

// RegisterCopy 登记一个新物理副本（秒传落盘 / 版本恢复等，内容已有索引）
func RegisterCopy(hash, phys string) {
	if hash == "" || phys == "" {
		return
	}
	upsertHashCopy(hash, phys)
	reconcileHash(hash)
}

func upsertHashCopy(hash, phys string) {
	var n int64
	model.DB.Model(&model.FileHashCopy{}).Where("hash = ? AND phys_path = ?", hash, phys).Count(&n)
	if n == 0 {
		model.DB.Create(&model.FileHashCopy{Hash: hash, PhysPath: phys})
	}
}

// reconcileHash 按存活副本对账：0 副本 → 删整条索引；
// 否则更新 RefCount，源失效时改指任一存活副本；顺带清理物理已不存在的悬空副本行
func reconcileHash(hash string) {
	var fh model.FileHash
	if err := model.DB.Where("hash = ?", hash).First(&fh).Error; err != nil {
		model.DB.Where("hash = ?", hash).Delete(&model.FileHashCopy{}) // 防御：无索引的孤儿副本行
		return
	}
	var copies []model.FileHashCopy
	model.DB.Where("hash = ?", hash).Find(&copies)
	alive := copies[:0]
	for _, c := range copies {
		if fi, err := os.Stat(c.PhysPath); err == nil && fi.Mode().IsRegular() && fi.Size() == fh.Size {
			alive = append(alive, c)
			continue
		}
		model.DB.Delete(&model.FileHashCopy{}, c.ID)
	}
	if len(alive) == 0 {
		model.DB.Delete(&model.FileHash{}, fh.ID)
		return
	}
	model.DB.Model(&fh).UpdateColumn("ref_count", int64(len(alive)))
	if fi, err := os.Stat(fh.SourcePath); err != nil || !fi.Mode().IsRegular() || fi.Size() != fh.Size {
		model.DB.Model(&fh).UpdateColumn("source_path", alive[0].PhysPath)
	}
}

// HashOfPhys 按物理路径反查秒传账本，返回 sha256 hex。
// 属性面板等场景优先走这里（免重读大文件流式算哈希）；wantSize 传入时
// 额外要求索引记录的大小一致（物理文件在账本登记后被绕过系统修改则视为失效）。
func HashOfPhys(phys string, wantSize int64) (string, bool) {
	var c model.FileHashCopy
	if err := model.DB.Where("phys_path = ?", phys).First(&c).Error; err != nil {
		return "", false
	}
	var fh model.FileHash
	if err := model.DB.Where("hash = ?", c.Hash).First(&fh).Error; err != nil {
		return "", false
	}
	if wantSize > 0 && fh.Size != wantSize {
		return "", false
	}
	return fh.Hash, true
}

// HashPathGone 物理文件（或目录）被永久删除后调用：移除副本记录并对账（目录遍历其下文件；须在删除前或删除后调用均可）
func HashPathGone(phys string) {
	if phys == "" {
		return
	}
	if info, err := os.Stat(phys); err == nil && info.IsDir() {
		_ = filepath.WalkDir(phys, func(p string, d os.DirEntry, err error) error {
			if err != nil || d == nil || d.IsDir() {
				return nil
			}
			removeHashCopy(p)
			return nil
		})
		return
	}
	removeHashCopy(phys)
}

func removeHashCopy(phys string) {
	var c model.FileHashCopy
	if err := model.DB.Where("phys_path = ?", phys).First(&c).Error; err != nil {
		return
	}
	model.DB.Delete(&c)
	// 被移除的恰是当前源时立即改指：物理删除可能尚未发生（先记账后 RemoveAll），
	// 此刻 stat 仍会成功，不能依赖 reconcile 的"源失效"探测
	var n int64
	model.DB.Model(&model.FileHashCopy{}).Where("hash = ?", c.Hash).Count(&n)
	if n > 0 {
		var next model.FileHashCopy
		model.DB.Where("hash = ?", c.Hash).Order("id").First(&next)
		model.DB.Model(&model.FileHash{}).Where("hash = ? AND source_path = ?", c.Hash, phys).
			UpdateColumn("source_path", next.PhysPath)
	}
	reconcileHash(c.Hash)
}

// HashPathRenamed 物理文件（或目录）改名/移动后调用（含移入回收站、版本保存）：
// 副本记录随新路径走（目录遍历新位置反推旧路径；须在移动成功后调用）
func HashPathRenamed(oldPhys, newPhys string) {
	if oldPhys == "" || newPhys == "" {
		return
	}
	if info, err := os.Stat(newPhys); err == nil && info.IsDir() {
		_ = filepath.WalkDir(newPhys, func(p string, d os.DirEntry, err error) error {
			if err != nil || d == nil || d.IsDir() {
				return nil
			}
			renameHashCopy(oldPhys+strings.TrimPrefix(p, newPhys), p)
			return nil
		})
		return
	}
	renameHashCopy(oldPhys, newPhys)
}

func renameHashCopy(oldPhys, newPhys string) {
	var c model.FileHashCopy
	if err := model.DB.Where("phys_path = ?", oldPhys).First(&c).Error; err != nil {
		return
	}
	var n int64
	model.DB.Model(&model.FileHashCopy{}).Where("phys_path = ?", newPhys).Count(&n)
	if n > 0 {
		model.DB.Delete(&c) // 目的地已有同内容记录（防御）
	} else {
		model.DB.Model(&c).Update("phys_path", newPhys)
	}
	model.DB.Model(&model.FileHash{}).Where("hash = ? AND source_path = ?", c.Hash, oldPhys).
		UpdateColumn("source_path", newPhys)
	reconcileHash(c.Hash)
}

// HashPathCopied 复制产生新物理副本后调用（目录复制遍历新树，按旧路径查哈希）
func HashPathCopied(srcPhys, dstPhys string) {
	if srcPhys == "" || dstPhys == "" {
		return
	}
	if info, err := os.Stat(dstPhys); err == nil && info.IsDir() {
		_ = filepath.WalkDir(dstPhys, func(p string, d os.DirEntry, err error) error {
			if err != nil || d == nil || d.IsDir() {
				return nil
			}
			addHashCopyFrom(srcPhys+strings.TrimPrefix(p, dstPhys), p)
			return nil
		})
		return
	}
	addHashCopyFrom(srcPhys, dstPhys)
}

func addHashCopyFrom(oldPhys, newPhys string) {
	var c model.FileHashCopy
	if err := model.DB.Where("phys_path = ?", oldPhys).First(&c).Error; err != nil {
		return // 源内容未登记过索引，不补登记
	}
	upsertHashCopy(c.Hash, newPhys)
	reconcileHash(c.Hash)
}

// ---- 分块上传（断点续传） ----

func (s *Service) chunkPath(sid string, idx int) string {
	return filepath.Join(s.TmpDir, sid, fmt.Sprintf("%06d.part", idx))
}

func (s *Service) InitUpload(uid uint, policyID uint, parent, name string, size int64, chunkSize int64, hash string) (*model.UploadSession, []int, bool, error) {
	if chunkSize <= 0 {
		chunkSize = 8 << 20
	}
	total := int((size + chunkSize - 1) / chunkSize)
	if total < 1 {
		total = 1
	}
	// 秒传判定
	if fh := s.lookupHash(hash, size); fh != nil {
		return nil, nil, true, nil
	}
	// 续传：同用户同策略同目录同名同大小的活跃会话
	var old model.UploadSession
	q := model.DB.Where("user_id=? AND policy_id=? AND parent_path=? AND name=? AND size=? AND status=?",
		uid, policyID, parent, name, size, "uploading")
	if hash != "" {
		q = q.Where("hash=?", hash)
	}
	if err := q.First(&old).Error; err == nil {
		return &old, old.ReceivedList(), false, nil
	}
	sid := genID()
	_ = os.MkdirAll(filepath.Join(s.TmpDir, sid), 0o755)
	rc, _ := json.Marshal([]int{})
	sess := &model.UploadSession{ID: sid, UserID: uid, PolicyID: policyID, ParentPath: parent, Name: name,
		Size: size, ChunkSize: chunkSize, TotalChunks: total, Hash: hash, Received: string(rc), Status: "uploading"}
	if err := model.DB.Create(sess).Error; err != nil {
		return nil, nil, false, err
	}
	return sess, []int{}, false, nil
}

func (s *Service) SaveChunk(sid string, idx int, r io.Reader) error {
	var sess model.UploadSession
	if err := model.DB.First(&sess, "id = ?", sid).Error; err != nil || sess.Status != "uploading" {
		return errors.New("上传会话不存在或已结束")
	}
	if idx < 0 || idx >= sess.TotalChunks {
		return errors.New("分片序号非法")
	}
	_ = os.MkdirAll(filepath.Join(s.TmpDir, sid), 0o755)
	f, err := os.Create(s.chunkPath(sid, idx))
	if err != nil {
		return err
	}
	// 限制读取上限（声明分片大小 + 4KB 容差）：超限请求提前截断，避免恶意大分片占满临时盘
	n, err := io.Copy(f, io.LimitReader(r, sess.ChunkSize+4096))
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if n > sess.ChunkSize+1024 {
		_ = os.Remove(s.chunkPath(sid, idx))
		return errors.New("分片过大")
	}
	s.mu.Lock()
	// 锁内重新读取最新 Received，避免并发上传同会话多个分片时基于过期值互相覆盖、丢失已上传分片记录
	var fresh model.UploadSession
	model.DB.Select("received").First(&fresh, "id = ?", sid)
	received := fresh.ReceivedList()
	found := false
	for _, v := range received {
		if v == idx {
			found = true
			break
		}
	}
	if !found {
		received = append(received, idx)
	}
	sort.Ints(received)
	rc, _ := json.Marshal(received)
	model.DB.Model(&model.UploadSession{}).Where("id = ?", sid).
		Updates(map[string]interface{}{"received": string(rc), "updated_at": time.Now()})
	s.mu.Unlock()
	return nil
}

func (s *Service) CompleteUpload(sess *model.UploadSession, physResolver func(string) (string, error)) (*Entry, error) {
	received := sess.ReceivedList()
	if len(received) != sess.TotalChunks {
		return nil, fmt.Errorf("分片不完整: %d/%d", len(received), sess.TotalChunks)
	}
	targetVP, err := Join(sess.ParentPath, sess.Name)
	if err != nil {
		return nil, err
	}
	physTarget, err := physResolver(targetVP)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(physTarget), 0o755); err != nil {
		return nil, err
	}
	// 组装 + 同时计算实际哈希
	tmpOut := physTarget + ".assembling"
	out, err := os.Create(tmpOut)
	if err != nil {
		return nil, err
	}
	hasher := sha256.New()
	writer := io.MultiWriter(out, hasher)
	var written int64
	for _, idx := range received {
		f, err := os.Open(s.chunkPath(sess.ID, idx))
		if err != nil {
			out.Close()
			_ = os.Remove(tmpOut)
			return nil, err
		}
		n, err := io.Copy(writer, f)
		f.Close()
		if err != nil {
			out.Close()
			_ = os.Remove(tmpOut)
			return nil, err
		}
		written += n
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(tmpOut)
		return nil, err
	}
	if written != sess.Size {
		_ = os.Remove(tmpOut)
		return nil, fmt.Errorf("大小校验失败: 期望 %d 实际 %d", sess.Size, written)
	}
	actualHash := hex.EncodeToString(hasher.Sum(nil))
	if sess.Hash != "" && sess.Hash != actualHash {
		_ = os.Remove(tmpOut)
		return nil, errors.New("SHA-256 校验失败，文件已损坏")
	}
	// 版本管理：如果目标文件已存在，保存旧版本
	SaveVersion(sess.PolicyID, sess.UserID, targetVP, physTarget)
	// 目标是已存在的目录时不能直接用文件覆盖（Windows 下报 267"找不到目录"）
	if err := ensureFileTarget(physTarget); err != nil {
		_ = os.Remove(tmpOut)
		return nil, err
	}
	HashPathGone(physTarget) // 覆盖同名：旧文件物理消失，移除其副本记录（不存在时为无操作）
	_ = os.Remove(physTarget)
	if err := os.Rename(tmpOut, physTarget); err != nil {
		_ = os.Remove(tmpOut)
		return nil, err
	}
	s.RegisterHash(actualHash, written, physTarget)
	model.DB.Model(sess).UpdateColumn("status", "completed")
	_ = os.RemoveAll(filepath.Join(s.TmpDir, sess.ID))
	fi, _ := os.Stat(physTarget)
	e := &Entry{Name: sess.Name, IsDir: false, Size: written, Ext: extOf(sess.Name)}
	if fi != nil {
		e.ModTime = fi.ModTime().UnixMilli()
	}
	return e, nil
}

func (s *Service) AbortUpload(sid string, uid uint) error {
	var sess model.UploadSession
	if err := model.DB.First(&sess, "id = ?", sid).Error; err != nil {
		return errors.New("会话不存在")
	}
	if sess.UserID != uid {
		return errors.New("无权操作")
	}
	model.DB.Model(&sess).UpdateColumn("status", "aborted")
	_ = os.RemoveAll(filepath.Join(s.TmpDir, sid))
	return nil
}

// ---- zip 打包（递归目录，写到临时文件） ----

type ZipItem struct {
	Path string `json:"path"`
	// Name 条目名覆盖（缺省 = Path 去前导斜杠）。同一父目录下的多个文件压缩时
	// 用纯文件名，避免 zip 里出现整条相对路径（解压后嵌套一层目录）
	Name string `json:"name,omitempty"`
}

// ZipFileProgress 压缩进度回调：done/total 为已处理/总文件数；返回 error 可中止（如任务取消）
type ZipFileProgress func(done, total int64) error

// ZipEntryProgress 解压进度回调（同上，int 版）
type ZipEntryProgress func(done, total int) error

// countZipFiles 统计路径下的普通文件数（进度分母用）
func countZipFiles(d Driver, vp string, depth int) (int64, error) {
	if depth > 12 {
		return 0, errors.New("目录层级过深")
	}
	e, err := d.Stat(vp)
	if err != nil {
		return 0, err
	}
	if !e.IsDir {
		return 1, nil
	}
	children, err := d.List(vp)
	if err != nil {
		return 0, err
	}
	var n int64
	for _, ch := range children {
		childVP, err := Join(vp, ch.Name)
		if err != nil {
			continue
		}
		m, err := countZipFiles(d, childVP, depth+1)
		if err != nil {
			return 0, err
		}
		n += m
	}
	return n, nil
}

func (s *Service) BuildZip(d Driver, items []ZipItem, outPath string, onFile ZipFileProgress) (int64, error) {
	var total int64
	for _, item := range items {
		n, err := countZipFiles(d, item.Path, 0)
		if err != nil {
			return 0, err
		}
		total += n
	}
	var done int64
	var lastErr error
	report := func() error {
		if lastErr != nil {
			return lastErr
		}
		done++
		if onFile != nil {
			lastErr = onFile(done, total)
		}
		return lastErr
	}
	out, err := os.Create(outPath)
	if err != nil {
		return 0, err
	}
	defer out.Close()
	zw := zip.NewWriter(out)
	for _, item := range items {
		// 条目名不能带前导斜杠（否则违反 zip 规范，且会被我们自己的安全校验拒绝）
		base := item.Name
		if base == "" {
			base = strings.TrimPrefix(strings.TrimRight(item.Path, "/"), "/")
		}
		if err := zipWalk(d, zw, item.Path, base, 0, report); err != nil {
			zw.Close()
			return 0, err
		}
	}
	if err := zw.Close(); err != nil {
		return 0, err
	}
	fi, _ := out.Stat()
	if fi == nil {
		return 0, nil
	}
	return fi.Size(), nil
}

func zipWalk(d Driver, zw *zip.Writer, vp, arcName string, depth int, onFile func() error) error {
	if depth > 12 {
		return errors.New("目录层级过深")
	}
	e, err := d.Stat(vp)
	if err != nil {
		return err
	}
	if !e.IsDir {
		if err := onFile(); err != nil {
			return err
		}
		rc, err := d.Open(vp)
		if err != nil {
			return err
		}
		defer rc.Close()
		w, err := zw.Create(arcName)
		if err != nil {
			return err
		}
		_, err = io.Copy(w, rc.(io.Reader))
		return err
	}
	children, err := d.List(vp)
	if err != nil {
		return err
	}
	for _, ch := range children {
		childVP, err := Join(vp, ch.Name)
		if err != nil {
			continue
		}
		childArc := ch.Name
		if arcName != "" {
			childArc = arcName + "/" + ch.Name
		}
		if err := zipWalk(d, zw, childVP, childArc, depth+1, onFile); err != nil {
			return err
		}
	}
	return nil
}

// ---- 搜索 / 属性 ----

func (s *Service) Search(d Driver, root, keyword string, limit int) []Entry {
	var out []Entry
	kw := strings.ToLower(keyword)
	var walk func(vp string, depth int)
	walk = func(vp string, depth int) {
		if len(out) >= limit || depth > 8 {
			return
		}
		items, err := d.List(vp)
		if err != nil {
			return
		}
		for _, it := range items {
			if len(out) >= limit {
				return
			}
			if strings.Contains(strings.ToLower(it.Name), kw) {
				child, jerr := Join(vp, it.Name)
				if jerr == nil {
					it.Path = child
					out = append(out, it)
				}
			}
			if it.IsDir {
				child, err := Join(vp, it.Name)
				if err == nil {
					walk(child, depth+1)
				}
			}
		}
	}
	walk(root, 0)
	return out
}

type Properties struct {
	Count    int64 `json:"count"`
	DirCount int64 `json:"dirCount"`
	Size     int64 `json:"size"`
}

func (s *Service) Properties(d Driver, vp string) (*Properties, error) {
	e, err := d.Stat(vp)
	if err != nil {
		return nil, err
	}
	p := &Properties{}
	if !e.IsDir {
		p.Count, p.Size = 1, e.Size
		return p, nil
	}
	var walk func(vp string, depth int)
	walk = func(vp string, depth int) {
		if depth > 10 {
			return
		}
		items, err := d.List(vp)
		if err != nil {
			return
		}
		for _, it := range items {
			if it.IsDir {
				p.DirCount++
				child, err := Join(vp, it.Name)
				if err == nil {
					walk(child, depth+1)
				}
			} else {
				p.Count++
				p.Size += it.Size
			}
		}
	}
	walk(vp, 0)
	return p, nil
}

// ---- zip 解压 ----

// ExtractZip 将 zip 文件解压到其所在目录下（以 zip 名命名的子目录）。
// 流式实现：先落盘到临时区再解析目录表，zip 本身不整体读入内存（大 zip 不会 OOM）。
// 返回解压写入的总字节数（未压缩大小，供配额记账）；precheck 在写任何文件前
// 以该总数做配额预检（返回 error 则整体中止、不落盘）。
// 解压资源硬上限：防 zip-bomb 类恶意归档拖爆磁盘/CPU（配额预检是业务约束，这里是安全兜底）
const (
	extractInputCap   = int64(20) << 30 // 压缩文件本身 ≤ 20GB
	extractTotalCap   = int64(20) << 30 // 解压产物总量 ≤ 20GB
	extractMaxEntries = 100000          // 条目数 ≤ 10 万
)

// copyArchiveInput 把归档完整复制到临时区，超过硬上限即中止
func copyArchiveInput(rc io.Reader, tmp *os.File) error {
	n, err := io.Copy(tmp, io.LimitReader(rc, extractInputCap+1))
	if err != nil {
		return err
	}
	if n > extractInputCap {
		return errors.New("归档文件过大（超过 20GB），已拒绝解压")
	}
	return nil
}

func (s *Service) ExtractZip(d Driver, zipVP string, onFile ZipEntryProgress, precheck func(totalUncompressed int64) error) (int64, error) {
	rc, err := d.Open(zipVP)
	if err != nil {
		return 0, err
	}
	defer rc.Close()
	if err := os.MkdirAll(s.ZipTmp, 0o755); err != nil {
		return 0, err
	}
	tmp, err := os.CreateTemp(s.ZipTmp, "extract-*.zip")
	if err != nil {
		return 0, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := copyArchiveInput(rc, tmp); err != nil {
		tmp.Close()
		return 0, err
	}
	tmp.Close()
	zf, err := os.Open(tmpPath)
	if err != nil {
		return 0, err
	}
	defer zf.Close()
	fi, _ := zf.Stat()
	zr, err := zip.NewReader(zf, fi.Size())
	if err != nil {
		return 0, errors.New("不是有效的 zip 文件")
	}
	if len(zr.File) > extractMaxEntries {
		return 0, errors.New("归档条目数超过 10 万，已拒绝解压")
	}
	parent := zipVP[:strings.LastIndex(zipVP, "/")]
	if parent == "" {
		parent = "/"
	}
	rootName := zipVP[strings.LastIndex(zipVP, "/")+1:]
	rootName = strings.TrimSuffix(rootName, ".zip")
	rootVP, err := Join(parent, rootName)
	if err != nil {
		return 0, err
	}
	// zip 内路径安全校验：逐段拒绝 .. 与绝对路径（允许 "a..b.txt" 这类合法文件名）
	for _, f := range zr.File {
		name := filepath.ToSlash(f.Name)
		if strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\x00\\") {
			return 0, errors.New("zip 内包含非法路径")
		}
		for _, seg := range strings.Split(name, "/") {
			if seg == ".." {
				return 0, errors.New("zip 内包含非法路径")
			}
		}
	}
	// 进度分母 = 非目录条目数；同时累计未压缩总字节（配额预检 + 记账）
	totalFiles := 0
	var totalUncompressed int64
	for _, f := range zr.File {
		if !f.FileInfo().IsDir() {
			totalFiles++
			totalUncompressed += int64(f.UncompressedSize64)
		}
	}
	if totalUncompressed > extractTotalCap {
		return 0, fmt.Errorf("解压后总大小 %dMB 超过 20GB 上限，已拒绝", totalUncompressed>>20)
	}
	if precheck != nil && totalUncompressed > 0 {
		if err := precheck(totalUncompressed); err != nil {
			return 0, err
		}
	}
	_ = d.Mkdir(rootVP)
	doneFiles := 0
	for _, f := range zr.File {
		name := filepath.ToSlash(f.Name)
		// 嵌套路径不能用 Join（它拒绝含 / 的名称），直接拼接后 Clean 校验
		vp, err := Clean(rootVP + "/" + name)
		if err != nil {
			continue
		}
		if f.FileInfo().IsDir() {
			_ = d.Mkdir(vp)
			continue
		}
		fr, err := f.Open()
		if err != nil {
			continue
		}
		err = d.CreateFile(vp, fr)
		fr.Close()
		if err != nil {
			return 0, err
		}
		doneFiles++
		if onFile != nil {
			if cerr := onFile(doneFiles, totalFiles); cerr != nil {
				return 0, cerr
			}
		}
	}
	return totalUncompressed, nil
}

// ---- tar / tar.gz / tar.bz2（纯 Go 标准库，无外部依赖）----

// BuildTar 打包为 tar（compression: "" 纯 tar / "gzip" / "bzip2"），返回归档文件字节数
func (s *Service) BuildTar(d Driver, items []ZipItem, outPath string, compression string, onFile ZipFileProgress) (int64, error) {
	var total int64
	for _, item := range items {
		n, err := countZipFiles(d, item.Path, 0)
		if err != nil {
			return 0, err
		}
		total += n
	}
	var done int64
	var lastErr error
	report := func() error {
		if lastErr != nil {
			return lastErr
		}
		done++
		if onFile != nil {
			lastErr = onFile(done, total)
		}
		return lastErr
	}
	out, err := os.Create(outPath)
	if err != nil {
		return 0, err
	}
	defer out.Close()
	// 注：Go 标准库只有 bzip2 解压没有压缩——tar.bz2 只能解不能打（调用方已拦截）
	var w io.WriteCloser = out
	if compression == "gzip" {
		w = gzip.NewWriter(out)
	}
	tw := tar.NewWriter(w)
	for _, item := range items {
		base := item.Name
		if base == "" {
			base = strings.TrimPrefix(strings.TrimRight(item.Path, "/"), "/")
		}
		if err := tarWalk(d, tw, item.Path, base, 0, report); err != nil {
			tw.Close()
			w.Close()
			return 0, err
		}
	}
	if err := tw.Close(); err != nil {
		w.Close()
		return 0, err
	}
	if err := w.Close(); err != nil {
		return 0, err
	}
	// 纯 tar 时 w 就是 out（已被 Close），必须用 os.Stat 按路径取大小——
	// 对已关闭的 *os.File 调 Stat 会失败并返回 0，导致配额漏记账
	fi, err := os.Stat(outPath)
	if err != nil || fi == nil {
		return 0, nil
	}
	return fi.Size(), nil
}

func tarWalk(d Driver, tw *tar.Writer, vp, arcName string, depth int, onFile func() error) error {
	if depth > 12 {
		return errors.New("目录层级过深")
	}
	e, err := d.Stat(vp)
	if err != nil {
		return err
	}
	mtime := time.UnixMilli(e.ModTime)
	if !e.IsDir {
		if err := onFile(); err != nil {
			return err
		}
		rc, err := d.Open(vp)
		if err != nil {
			return err
		}
		defer rc.Close()
		hdr := &tar.Header{Name: arcName, Mode: 0o644, Size: e.Size, ModTime: mtime}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		_, err = io.Copy(tw, rc.(io.Reader))
		return err
	}
	hdr := &tar.Header{Name: arcName + "/", Typeflag: tar.TypeDir, Mode: 0o755, ModTime: mtime}
	if err := tw.WriteHeader(hdr); err != nil {
		return err
	}
	children, err := d.List(vp)
	if err != nil {
		return err
	}
	for _, ch := range children {
		childVP, err := Join(vp, ch.Name)
		if err != nil {
			continue
		}
		childArc := ch.Name
		if arcName != "" {
			childArc = arcName + "/" + ch.Name
		}
		if err := tarWalk(d, tw, childVP, childArc, depth+1, onFile); err != nil {
			return err
		}
	}
	return nil
}

// tarCheckPath tar 条目路径安全校验（与 zip 一致：拒绝绝对路径 / .. 段 / NUL / 反斜杠）
func tarCheckPath(name string) error {
	if strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\x00\\") {
		return errors.New("归档内包含非法路径")
	}
	for _, seg := range strings.Split(name, "/") {
		if seg == ".." {
			return errors.New("归档内包含非法路径")
		}
	}
	return nil
}

// ExtractTar 解压 tar/tar.gz/tar.bz2 到 zipVP 同目录下同名文件夹；返回写入总字节数。
// tar 无中央目录，无法预先得知总大小，故不做 precheck（记账在解压完成后）。
func (s *Service) ExtractTar(d Driver, arcVP string, onFile ZipEntryProgress) (int64, error) {
	rc, err := d.Open(arcVP)
	if err != nil {
		return 0, err
	}
	defer rc.Close()
	if err := os.MkdirAll(s.ZipTmp, 0o755); err != nil {
		return 0, err
	}
	tmp, err := os.CreateTemp(s.ZipTmp, "extract-*.tar")
	if err != nil {
		return 0, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := copyArchiveInput(rc, tmp); err != nil {
		tmp.Close()
		return 0, err
	}
	tmp.Close()
	zf, err := os.Open(tmpPath)
	if err != nil {
		return 0, err
	}
	defer zf.Close()
	// 按魔数识别压缩格式
	head := make([]byte, 6)
	if _, err := io.ReadFull(zf, head); err != nil && err != io.ErrUnexpectedEOF {
		return 0, errors.New("不是有效的 tar 文件")
	}
	if _, err := zf.Seek(0, io.SeekStart); err != nil {
		return 0, err
	}
	var reader io.Reader = zf
	switch {
	case len(head) >= 2 && head[0] == 0x1f && head[1] == 0x8b:
		gz, err := gzip.NewReader(zf)
		if err != nil {
			return 0, errors.New("不是有效的 tar.gz 文件")
		}
		defer gz.Close()
		reader = gz
	case len(head) >= 3 && head[0] == 'B' && head[1] == 'Z' && head[2] == 'h':
		reader = bzip2.NewReader(zf)
	case len(head) >= 6 && head[0] == 0xfd && head[1] == '7' && head[2] == 'z' && head[3] == 'X' && head[4] == 'Z' && head[5] == 0:
		return 0, errors.New("暂不支持 xz 压缩的 tar（.tar.xz）")
	}
	tr := tar.NewReader(reader)
	parent := arcVP[:strings.LastIndex(arcVP, "/")]
	if parent == "" {
		parent = "/"
	}
	rootName := path.Base(arcVP)
	for _, suf := range []string{".tar.gz", ".tar.bz2", ".tgz", ".tbz2", ".tar"} {
		rootName = strings.TrimSuffix(rootName, suf)
	}
	rootVP, err := Join(parent, rootName)
	if err != nil {
		return 0, err
	}
	_ = d.Mkdir(rootVP)
	var written int64
	n := 0
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}
		name := filepath.ToSlash(strings.TrimSuffix(hdr.Name, "/"))
		if name == "" {
			continue
		}
		if err := tarCheckPath(name); err != nil {
			return 0, err
		}
		vp, err := Clean(rootVP + "/" + name)
		if err != nil {
			continue
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			_ = d.Mkdir(vp)
		case tar.TypeReg:
			if n >= extractMaxEntries {
				return 0, errors.New("归档条目数超过 10 万，已拒绝解压")
			}
			if written+hdr.Size > extractTotalCap {
				return 0, fmt.Errorf("解压后总大小超过 20GB 上限，已拒绝")
			}
			if err := d.CreateFile(vp, io.LimitReader(tr, hdr.Size)); err != nil {
				return 0, err
			}
			written += hdr.Size
			n++
			if onFile != nil {
				// 总数未知：done 递增、total 传 0（前端进度按「处理中」显示）
				if cerr := onFile(n, 0); cerr != nil {
					return 0, cerr
				}
			}
		default:
			// 符号链接/硬链接/设备等一律跳过（避免链接逃逸与设备文件风险）
			continue
		}
	}
	return written, nil
}

// ---- 工具 ----

// ensureFileTarget 确保 physTarget 位置可写入文件：
// 目标不存在或为普通文件 → 放行（rename/create 会覆盖）；
// 目标为已存在的目录 → 空目录删除后放行，非空目录报错（Windows 下用文件覆盖
// 目录会报 ERROR_DIR_NOT_FOUND 267"找不到请求的文件或目录"，这里给出明确提示）
func ensureFileTarget(phys string) error {
	fi, err := os.Stat(phys)
	if err != nil {
		return nil
	}
	if !fi.IsDir() {
		return nil
	}
	entries, _ := os.ReadDir(phys)
	if len(entries) == 0 {
		return os.Remove(phys)
	}
	return fmt.Errorf("已存在同名目录，无法用文件覆盖（请先删除该目录或改名上传）")
}

// PhysicalOf 取本地驱动下虚拟路径的物理路径（仅本地策略）
func PhysicalOf(d Driver, vp string) (string, error) {
	ld, ok := d.(*LocalDriver)
	if !ok {
		return "", errors.New("非本地存储")
	}
	return ld.Physical(vp)
}

func extOf(name string) string {
	if i := strings.LastIndex(name, "."); i > 0 {
		return strings.ToLower(name[i+1:])
	}
	return ""
}

func genID() string {
	b := make([]byte, 16)
	_, _ = crand.Read(b)
	return hex.EncodeToString(b)
}
