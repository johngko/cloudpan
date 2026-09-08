package driver

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

const apiAli = "https://openapi.alipan.com"

// Aliyun 阿里云盘开放平台驱动（需 client_id/client_secret + refresh_token）
type Aliyun struct {
	ClientID     string
	ClientSecret string
	RefreshToken string
	AccessToken  string
	DriveID      string
	tokenExpire  time.Time
	idCache      map[string]string
	idMu         sync.Mutex
	http         *http.Client
}

func NewAliyun(p *model.Policy) (fscore.Driver, error) {
	o := p.Opts()
	if o["refresh_token"] == "" {
		return nil, fmt.Errorf("阿里云盘需要 refresh_token（开放平台授权后获取，在存储策略中配置）")
	}
	return &Aliyun{
		ClientID: o["client_id"], ClientSecret: o["client_secret"], RefreshToken: o["refresh_token"],
		idCache: map[string]string{"/": "root"},
		http:    &http.Client{Timeout: 120 * time.Second},
	}, nil
}

// AuthURL 生成授权页地址（前端授权中心引导用户访问）
func AliyunAuthURL(clientID string) string {
	return fmt.Sprintf("%s/oauth/authorize?client_id=%s&redirect_uri=oob&scope=user:base,file:all:read,file:all:write", apiAli, clientID)
}

// ExchangeCode 用授权码换 token（管理端调用）
func AliyunExchangeCode(clientID, clientSecret, code string) (refresh, access string, err error) {
	m, err := jreq("POST", apiAli+"/oauth/access_token", nil, map[string]interface{}{
		"client_id": clientID, "client_secret": clientSecret, "grant_type": "authorization_code", "code": code, "redirect_uri": "oob",
	})
	if err != nil {
		return "", "", err
	}
	return jstr(m, "refresh_token"), jstr(m, "access_token"), nil
}

func (d *Aliyun) token() (string, error) {
	if d.AccessToken != "" && time.Now().Before(d.tokenExpire) {
		return d.AccessToken, nil
	}
	body := map[string]interface{}{"grant_type": "refresh_token", "refresh_token": d.RefreshToken}
	if d.ClientID != "" {
		body["client_id"] = d.ClientID
		body["client_secret"] = d.ClientSecret
	}
	m, err := jreq("POST", apiAli+"/oauth/access_token", nil, body)
	if err != nil {
		return "", fmt.Errorf("阿里云盘鉴权失败: %w", err)
	}
	d.AccessToken = jstr(m, "access_token")
	rt := jstr(m, "refresh_token")
	if rt != "" {
		d.RefreshToken = rt
	}
	exp := jnum(m, "expires_in")
	if exp < 300 {
		exp = 7200
	}
	d.tokenExpire = time.Now().Add(time.Duration(exp-120) * time.Second)
	if d.AccessToken == "" {
		return "", fmt.Errorf("阿里云盘未返回 token")
	}
	return d.AccessToken, nil
}

func (d *Aliyun) api(method, ep string, body interface{}) (map[string]interface{}, error) {
	t, err := d.token()
	if err != nil {
		return nil, err
	}
	h := map[string]string{"Authorization": "Bearer " + t}
	return jreq(method, apiAli+ep, h, body)
}

func (d *Aliyun) driveID() (string, error) {
	if d.DriveID != "" {
		return d.DriveID, nil
	}
	m, err := d.api("POST", "/adrive/v1.0/user/getDriveInfo", map[string]interface{}{})
	if err != nil {
		return "", err
	}
	d.DriveID = jstr(jmap(m, "default_drive_id"), "")
	if d.DriveID == "" {
		d.DriveID = jstr(m, "default_drive_id")
	}
	if d.DriveID == "" {
		return "", fmt.Errorf("未获取到 drive_id")
	}
	return d.DriveID, nil
}

func (d *Aliyun) cachedID(vp string) (string, bool) {
	d.idMu.Lock()
	defer d.idMu.Unlock()
	id, ok := d.idCache[vp]
	return id, ok
}

func (d *Aliyun) setCache(vp, id string) {
	d.idMu.Lock()
	d.idCache[vp] = id
	d.idMu.Unlock()
}

func (d *Aliyun) resolveID(vp string) (string, error) {
	c, err := fscore.Clean(vp)
	if err != nil {
		return "", err
	}
	if c == "/" {
		return "root", nil
	}
	if id, ok := d.cachedID(c); ok {
		return id, nil
	}
	parent := path.Dir(c)
	pid, err := d.resolveID(parent)
	if err != nil {
		return "", err
	}
	seg := path.Base(c)
	m, err := d.api("POST", "/adrive/v1.0/openFile/list", map[string]interface{}{
		"drive_id": d.mustDriveID(), "parent_file_id": pid, "limit": 200,
	})
	if err != nil {
		return "", err
	}
	for _, it := range jarr(m, "items") {
		f := it.(map[string]interface{})
		name := jstr(f, "name")
		d.setCache(path.Join(parent, name), jstr(f, "file_id"))
		if name == seg {
			return jstr(f, "file_id"), nil
		}
	}
	return "", fmt.Errorf("阿里云盘路径不存在: %s", c)
}

func (d *Aliyun) mustDriveID() string {
	id, _ := d.driveID()
	return id
}

func (d *Aliyun) List(dir string) ([]fscore.Entry, error) {
	pid, err := d.resolveID(dir)
	if err != nil {
		return nil, err
	}
	var out []fscore.Entry
	marker := ""
	for {
		body := map[string]interface{}{"drive_id": d.mustDriveID(), "parent_file_id": pid, "limit": 100}
		if marker != "" {
			body["marker"] = marker
		}
		m, err := d.api("POST", "/adrive/v1.0/openFile/list", body)
		if err != nil {
			return nil, err
		}
		for _, it := range jarr(m, "items") {
			f := it.(map[string]interface{})
			name := jstr(f, "name")
			isDir := jstr(f, "type") == "folder"
			ext := ""
			if !isDir {
				if i := strings.LastIndex(name, "."); i > 0 {
					ext = strings.ToLower(name[i+1:])
				}
			}
			mt, _ := time.Parse(time.RFC3339, jstr(f, "updated_at"))
			out = append(out, fscore.Entry{Name: name, IsDir: isDir, Size: int64(jnum(f, "size")), ModTime: mt.UnixMilli(), Ext: ext})
			d.setCache(path.Join(dir, name), jstr(f, "file_id"))
		}
		marker = jstr(m, "next_marker")
		if marker == "" {
			break
		}
	}
	sortEntries(out)
	return out, nil
}

func (d *Aliyun) Stat(p string) (*fscore.Entry, error) {
	if c, _ := fscore.Clean(p); c == "/" {
		return &fscore.Entry{Name: "/", IsDir: true}, nil
	}
	items, err := d.List(path.Dir(p))
	if err != nil {
		return nil, err
	}
	base := path.Base(p)
	for _, it := range items {
		if it.Name == base {
			return &it, nil
		}
	}
	return nil, os.ErrNotExist
}

func (d *Aliyun) Mkdir(dir string) error {
	pid, err := d.resolveID(path.Dir(dir))
	if err != nil {
		return err
	}
	m, err := d.api("POST", "/adrive/v1.0/openFile/create", map[string]interface{}{
		"drive_id": d.mustDriveID(), "parent_file_id": pid, "name": path.Base(dir), "type": "folder", "check_name_mode": "refuse",
	})
	if err != nil {
		return err
	}
	d.setCache(dir, jstr(m, "file_id"))
	return nil
}

func (d *Aliyun) Rename(p, newName string) error {
	fid, err := d.resolveID(p)
	if err != nil {
		return err
	}
	_, err = d.api("POST", "/adrive/v1.0/openFile/rename", map[string]interface{}{
		"drive_id": d.mustDriveID(), "file_id": fid, "name": newName,
	})
	d.invalidate(p)
	return err
}

func (d *Aliyun) Move(src, dstDir string) error {
	fid, err := d.resolveID(src)
	if err != nil {
		return err
	}
	tid, err := d.resolveID(dstDir)
	if err != nil {
		return err
	}
	_, err = d.api("POST", "/adrive/v1.0/openFile/move", map[string]interface{}{
		"drive_id": d.mustDriveID(), "file_id": fid, "to_parent_file_id": tid, "check_name_mode": "auto_rename",
	})
	d.invalidate(src)
	return err
}

func (d *Aliyun) Copy(src, dstDir string) error {
	fid, err := d.resolveID(src)
	if err != nil {
		return err
	}
	tid, err := d.resolveID(dstDir)
	if err != nil {
		return err
	}
	_, err = d.api("POST", "/adrive/v1.0/openFile/copy", map[string]interface{}{
		"drive_id": d.mustDriveID(), "file_id": fid, "to_parent_file_id": tid, "auto_rename": true,
	})
	return err
}

func (d *Aliyun) Delete(p string) error {
	fid, err := d.resolveID(p)
	if err != nil {
		return err
	}
	_, err = d.api("POST", "/adrive/v1.0/openFile/recycle/bin/trash", map[string]interface{}{
		"drive_id": d.mustDriveID(), "file_id": fid,
	})
	d.invalidate(p)
	return err
}

func (d *Aliyun) invalidate(vp string) {
	d.idMu.Lock()
	for k := range d.idCache {
		if k == vp || strings.HasPrefix(k, vp+"/") {
			delete(d.idCache, k)
		}
	}
	d.idMu.Unlock()
}

func (d *Aliyun) DirectURL(p string) (string, error) {
	fid, err := d.resolveID(p)
	if err != nil {
		return "", err
	}
	m, err := d.api("POST", "/adrive/v1.0/openFile/get_download_url", map[string]interface{}{
		"drive_id": d.mustDriveID(), "file_id": fid, "expire_sec": 3600,
	})
	if err != nil {
		return "", err
	}
	return jstr(m, "url"), nil
}

func (d *Aliyun) Open(p string) (fscore.ReadSeekCloser, error) {
	url, err := d.DirectURL(p)
	if err != nil {
		return nil, err
	}
	return downloadToTemp(d.http, url, p)
}

// CreateFile 阿里云盘上传（单分片简单模式，≤5GB）
func (d *Aliyun) CreateFile(p string, r io.Reader) error {
	pid, err := d.resolveID(path.Dir(p))
	if err != nil {
		return err
	}
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	h := sha256.Sum256(data)
	body := map[string]interface{}{
		"drive_id": d.mustDriveID(), "parent_file_id": pid, "name": path.Base(p),
		"type": "file", "check_name_mode": "overwrite", "size": len(data),
		"content_hash": hex.EncodeToString(h[:]), "content_hash_name": "sha256", "proof_version": "v1",
	}
	m, err := d.api("POST", "/adrive/v1.0/openFile/create", body)
	if err != nil {
		return err
	}
	if jstr(m, "rapid_upload") == "true" || m["rapid_upload"] == true {
		return nil // 秒传
	}
	fid := jstr(m, "file_id")
	uploadID := jstr(m, "upload_id")
	parts := jarr(m, "part_info_list")
	for i, it := range parts {
		pi := it.(map[string]interface{})
		url := jstr(pi, "upload_url")
		chunk := data
		req, _ := http.NewRequest("PUT", url, bytes.NewReader(chunk))
		resp, err := d.http.Do(req)
		if err != nil {
			return err
		}
		resp.Body.Close()
		_ = i
	}
	_, err = d.api("POST", "/adrive/v1.0/openFile/complete", map[string]interface{}{
		"drive_id": d.mustDriveID(), "file_id": fid, "upload_id": uploadID,
	})
	d.invalidate(path.Dir(p))
	return err
}

func (d *Aliyun) Quota() (used, total int64, err error) {
	m, err := d.api("POST", "/adrive/v1.0/users/getUser", map[string]interface{}{})
	if err != nil {
		return 0, 0, err
	}
	return int64(jnum(m, "used_space")), int64(jnum(m, "total_space")), nil
}

func (d *Aliyun) Capabilities() fscore.Cap {
	return fscore.Cap{DirectDownload: true, Upload: true, StructureList: true}
}
