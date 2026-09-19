package driver

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"sort"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

const api123 = "https://open-api.123pan.com"

// Pan123 123云盘开放平台驱动（官方 API，需 clientID/clientSecret）
type Pan123 struct {
	ClientID     string
	ClientSecret string
	accessToken  string
	tokenExpire  time.Time
	idCache      map[string]float64 // 虚拟路径 → fileID
	idMu         sync.Mutex
	http         *http.Client
}

func NewPan123(p *model.Policy) (fscore.Driver, error) {
	o := p.Opts()
	if o["client_id"] == "" || o["client_secret"] == "" {
		return nil, fmt.Errorf("123云盘需要 client_id 与 client_secret（在存储策略中配置）")
	}
	return &Pan123{
		ClientID: o["client_id"], ClientSecret: o["client_secret"],
		idCache: map[string]float64{"/": 0},
		http:    &http.Client{Timeout: 120 * time.Second},
	}, nil
}

func (d *Pan123) token() (string, error) {
	if d.accessToken != "" && time.Now().Before(d.tokenExpire) {
		return d.accessToken, nil
	}
	m, err := jreq("POST", api123+"/api/v1/access_token", nil, map[string]interface{}{
		"clientID": d.ClientID, "clientSecret": d.ClientSecret,
	})
	if err != nil {
		return "", fmt.Errorf("123云盘鉴权失败: %w", err)
	}
	data := jmap(m, "data")
	d.accessToken = jstr(data, "accessToken")
	exp := jnum(data, "expiresIn")
	if exp < 300 {
		exp = 300
	}
	d.tokenExpire = time.Now().Add(time.Duration(exp-60) * time.Second)
	if d.accessToken == "" {
		return "", fmt.Errorf("123云盘未返回 token")
	}
	return d.accessToken, nil
}

func (d *Pan123) headers() (map[string]string, error) {
	t, err := d.token()
	if err != nil {
		return nil, err
	}
	return map[string]string{"Authorization": "Bearer " + t, "Platform": "open_platform"}, nil
}

func (d *Pan123) cachedID(vp string) (float64, bool) {
	d.idMu.Lock()
	defer d.idMu.Unlock()
	id, ok := d.idCache[vp]
	return id, ok
}

func (d *Pan123) setCache(vp string, id float64) {
	d.idMu.Lock()
	d.idCache[vp] = id
	d.idMu.Unlock()
}

// resolveID 由路径解析 123 的 fileID（逐级列出查找）
func (d *Pan123) resolveID(vp string) (float64, error) {
	c, err := fscore.Clean(vp)
	if err != nil {
		return 0, err
	}
	if c == "/" {
		return 0, nil
	}
	if id, ok := d.cachedID(c); ok {
		return id, nil
	}
	segs := strings.Split(strings.Trim(c, "/"), "/")
	cur := 0.0
	curPath := ""
	for _, seg := range segs {
		curPath = curPath + "/" + seg
		if id, ok := d.cachedID(curPath); ok {
			cur = id
			continue
		}
		found := false
		last := -1.0
		for {
			h, err := d.headers()
			if err != nil {
				return 0, err
			}
			q := fmt.Sprintf("%s/api/v2/file/list?parentFileId=%d&limit=100", api123, int64(cur))
			if last >= 0 {
				q += fmt.Sprintf("&lastFileId=%d", int64(last))
			}
			m, err := jreq("GET", q, h, nil)
			if err != nil {
				return 0, err
			}
			data := jmap(m, "data")
			for _, it := range jarr(data, "fileList") {
				f := it.(map[string]interface{})
				fid := jnum(f, "fileId")
				name := jstr(f, "filename")
				d.setCache(curPathOf(curPath, name), fid)
				if name == seg {
					cur = fid
					found = true
				}
			}
			lf := jnum(data, "lastFileId")
			if lf <= 0 || found {
				break
			}
			last = lf
		}
		if !found {
			return 0, fmt.Errorf("123云盘路径不存在: %s", curPath)
		}
	}
	return cur, nil
}

func curPathOf(fullPath, name string) string {
	// fullPath 已含 name
	return fullPath
}

func (d *Pan123) List(dir string) ([]fscore.Entry, error) {
	id, err := d.resolveID(dir)
	if err != nil {
		return nil, err
	}
	h, err := d.headers()
	if err != nil {
		return nil, err
	}
	var out []fscore.Entry
	last := -1.0
	for {
		q := fmt.Sprintf("%s/api/v2/file/list?parentFileId=%d&limit=100", api123, int64(id))
		if last >= 0 {
			q += fmt.Sprintf("&lastFileId=%d", int64(last))
		}
		m, err := jreq("GET", q, h, nil)
		if err != nil {
			return nil, err
		}
		data := jmap(m, "data")
		list := jarr(data, "fileList")
		for _, it := range list {
			f := it.(map[string]interface{})
			name := jstr(f, "filename")
			isDir := jnum(f, "type") == 1
			ext := ""
			if !isDir {
				if i := strings.LastIndex(name, "."); i > 0 {
					ext = strings.ToLower(name[i+1:])
				}
			}
			modT, _ := time.Parse(time.RFC3339, jstr(f, "updateAt"))
			out = append(out, fscore.Entry{Name: name, IsDir: isDir, Size: int64(jnum(f, "size")),
				ModTime: modT.UnixMilli(), Ext: ext})
			d.setCache(path.Join(dir, name), jnum(f, "fileId"))
		}
		lf := jnum(data, "lastFileId")
		if lf <= 0 || len(list) < 100 {
			break
		}
		last = lf
	}
	sortEntries(out)
	return out, nil
}

func sortEntries(e []fscore.Entry) {
	sort.Slice(e, func(i, j int) bool {
		if e[i].IsDir != e[j].IsDir {
			return e[i].IsDir
		}
		return e[i].Name < e[j].Name
	})
}

func (d *Pan123) Stat(p string) (*fscore.Entry, error) {
	if c, _ := fscore.Clean(p); c == "/" {
		return &fscore.Entry{Name: "/", IsDir: true}, nil
	}
	dir := path.Dir(p)
	base := path.Base(p)
	items, err := d.List(dir)
	if err != nil {
		return nil, err
	}
	for _, it := range items {
		if it.Name == base {
			return &it, nil
		}
	}
	return nil, os.ErrNotExist
}

func (d *Pan123) Mkdir(dir string) error {
	parent := path.Dir(dir)
	name := path.Base(dir)
	pid, err := d.resolveID(parent)
	if err != nil {
		return err
	}
	h, err := d.headers()
	if err != nil {
		return err
	}
	m, err := jreq("POST", api123+"/api/v1/file/mkdir", h, map[string]interface{}{"name": name, "parentID": int64(pid)})
	if err != nil {
		return err
	}
	if code := jnum(m, "code"); code != 0 {
		return fmt.Errorf("mkdir 失败: %s", jstr(m, "message"))
	}
	d.setCache(dir, jnum(jmap(m, "data"), "fileID"))
	return nil
}

func (d *Pan123) Rename(p, newName string) error {
	fid, err := d.resolveID(p)
	if err != nil {
		return err
	}
	h, err := d.headers()
	if err != nil {
		return err
	}
	_, err = jreq("PUT", api123+"/api/v1/file/name", h, map[string]interface{}{"fileId": int64(fid), "fileName": newName})
	d.invalidatePath(p)
	return err
}

func (d *Pan123) Move(src, dstDir string) error {
	fid, err := d.resolveID(src)
	if err != nil {
		return err
	}
	tid, err := d.resolveID(dstDir)
	if err != nil {
		return err
	}
	h, err := d.headers()
	if err != nil {
		return err
	}
	_, err = jreq("POST", api123+"/api/v1/file/move", h, map[string]interface{}{"fileIDs": []int64{int64(fid)}, "toParentFileID": int64(tid)})
	d.invalidatePath(src)
	return err
}

func (d *Pan123) Copy(src, dstDir string) error {
	fid, err := d.resolveID(src)
	if err != nil {
		return err
	}
	tid, err := d.resolveID(dstDir)
	if err != nil {
		return err
	}
	h, err := d.headers()
	if err != nil {
		return err
	}
	_, err = jreq("POST", api123+"/api/v1/file/copy", h, map[string]interface{}{"fileIDs": []int64{int64(fid)}, "toParentFileID": int64(tid)})
	return err
}

func (d *Pan123) Delete(p string) error {
	fid, err := d.resolveID(p)
	if err != nil {
		return err
	}
	h, err := d.headers()
	if err != nil {
		return err
	}
	_, err = jreq("POST", api123+"/api/v1/file/trash", h, map[string]interface{}{"fileIDs": []int64{int64(fid)}})
	d.invalidatePath(p)
	return err
}

func (d *Pan123) invalidatePath(vp string) {
	d.idMu.Lock()
	prefix := vp
	for k := range d.idCache {
		if k == vp || strings.HasPrefix(k, prefix+"/") {
			delete(d.idCache, k)
		}
	}
	d.idMu.Unlock()
}

// Open 下载到本地临时缓存文件后返回（中转模式）
func (d *Pan123) Open(p string) (fscore.ReadSeekCloser, error) {
	url, err := d.DirectURL(p)
	if err != nil {
		return nil, err
	}
	return downloadToTemp(d.http, url, p)
}

func (d *Pan123) DirectURL(p string) (string, error) {
	if c, _ := fscore.Clean(p); c == "/" {
		return "", fmt.Errorf("目录无直链")
	}
	fid, err := d.resolveID(p)
	if err != nil {
		return "", err
	}
	h, err := d.headers()
	if err != nil {
		return "", err
	}
	m, err := jreq("GET", fmt.Sprintf("%s/api/v2/file/download_info?fileId=%d", api123, int64(fid)), h, nil)
	if err != nil {
		return "", err
	}
	return jstr(jmap(m, "data"), "DownloadUrl"), nil
}

func (d *Pan123) CreateFile(p string, r io.Reader) error {
	parent := path.Dir(p)
	name := path.Base(p)
	pid, err := d.resolveID(parent)
	if err != nil {
		return err
	}
	h, err := d.headers()
	if err != nil {
		return err
	}
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	md5sum := md5.Sum(data)
	// v2 上传：预上传
	m, err := jreq("POST", api123+"/api/v2/upload/file/request", h, map[string]interface{}{
		"parentFileID": int64(pid), "filename": name, "etag": hex.EncodeToString(md5sum[:]),
		"size": len(data), "partNumber": 1,
	})
	if err != nil {
		return err
	}
	if code := jnum(m, "code"); code != 0 {
		return fmt.Errorf("上传失败: %s", jstr(m, "message"))
	}
	dm := jmap(m, "data")
	if dm["reuse"] == true {
		return nil // 秒传
	}
	sliceSize := int64(jnum(dm, "sliceSize"))
	preID := jstr(dm, "parts") // 占位
	_ = preID
	parts := jarr(dm, "parts")
	if len(parts) == 0 {
		return fmt.Errorf("123云盘未返回分片地址")
	}
	part0 := parts[0].(map[string]interface{})
	uploadURL := jstr(part0, "uploadUrl")
	slice := data
	if int64(len(data)) > sliceSize && sliceSize > 0 {
		slice = data[:sliceSize]
	}
	req, _ := http.NewRequest("PUT", uploadURL, strings.NewReader(string(slice)))
	resp, err := d.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	// 完成上传
	parts2 := []map[string]interface{}{{"partNumber": 1, "etag": hex.EncodeToString(md5sum[:])}}
	_, err = jreq("POST", api123+"/api/v2/upload/file/complete", h, map[string]interface{}{
		"preuploadID": jstr(dm, "preuploadID"), "parts": parts2,
	})
	d.invalidatePath(parent)
	return err
}

func (d *Pan123) Quota() (used, total int64, err error) {
	h, err2 := d.headers()
	if err2 != nil {
		return 0, 0, err2
	}
	m, err := jreq("GET", api123+"/api/v2/user/info", h, nil)
	if err != nil {
		return 0, 0, err
	}
	data := jmap(m, "data")
	return int64(jnum(data, "spaceUsed")), int64(jnum(data, "spaceTotal")), nil
}

func (d *Pan123) Capabilities() fscore.Cap {
	return fscore.Cap{DirectDownload: true, Upload: true, StructureList: true}
}

// downloadToTemp 云盘文件下载到临时文件（支持断点缓存与 Seek）
func downloadToTemp(hc *http.Client, url, key string) (fscore.ReadSeekCloser, error) {
	tmp := os.TempDir()
	sum := sha256.Sum256([]byte(key))
	cachePath := tmp + string(os.PathSeparator) + "cloudpan_cache_" + hex.EncodeToString(sum[:16]) + ".part"
	if fi, err := os.Stat(cachePath); err == nil && fi.Size() > 0 {
		return os.Open(cachePath)
	}
	resp, err := hc.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("云盘下载失败 HTTP %d", resp.StatusCode)
	}
	f, err := os.Create(cachePath)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(cachePath)
		return nil, err
	}
	f.Close()
	return os.Open(cachePath)
}
