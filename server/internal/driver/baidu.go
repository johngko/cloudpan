package driver

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

const apiBaidu = "https://pan.baidu.com/rest/2.0/xpan"

// Baidu 百度网盘开放平台驱动（官方 API；上传接口多数应用需白名单，默认只读）
// token 策略：优先用 refresh_token 滚动续期（access_token 30 天过期，refresh 可长期保持），
// 轮换出的新 token 立即落库（同阿里云盘）
type Baidu struct {
	PolicyID     uint
	ClientID     string
	ClientSecret string
	RefreshToken string
	AccessToken  string
	tokenExpire  time.Time
	idCache      map[string]string
	idMu         sync.Mutex
	http         *http.Client
	readOnly     bool
}

func NewBaidu(p *model.Policy) (fscore.Driver, error) {
	o := p.Opts()
	if o["access_token"] == "" && o["refresh_token"] == "" {
		return nil, fmt.Errorf("百度网盘需要 access_token 或 refresh_token（开放平台 OAuth 授权后获取）")
	}
	return &Baidu{
		PolicyID: p.ID, ClientID: o["client_id"], ClientSecret: o["client_secret"],
		RefreshToken: o["refresh_token"], AccessToken: o["access_token"],
		idCache:  map[string]string{"/": "/"},
		http:     &http.Client{Timeout: 120 * time.Second},
		readOnly: o["allow_upload"] != "true",
	}, nil
}

// BaiduAuthURL 构造授权页地址。redirectURI 传系统回调地址（扫码绑定）或 "oob"（授权码粘贴）
func BaiduAuthURL(clientID, redirectURI, state string) string {
	if redirectURI == "" {
		redirectURI = "oob"
	}
	u := "https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id=" + url.QueryEscape(clientID) +
		"&redirect_uri=" + url.QueryEscape(redirectURI) + "&scope=basic,netdisk"
	if state != "" {
		u += "&state=" + url.QueryEscape(state)
	}
	return u
}

// BaiduExchangeCode 授权码换 token（redirectURI 必须与授权页所用一致）
func BaiduExchangeCode(clientID, clientSecret, code, redirectURI string) (access, refresh string, err error) {
	if redirectURI == "" {
		redirectURI = "oob"
	}
	u := fmt.Sprintf("https://openapi.baidu.com/oauth/2.0/token?grant_type=authorization_code&code=%s&client_id=%s&client_secret=%s&redirect_uri=%s",
		url.QueryEscape(code), url.QueryEscape(clientID), url.QueryEscape(clientSecret), url.QueryEscape(redirectURI))
	m, err := jreq("GET", u, nil, nil)
	if err != nil {
		return "", "", err
	}
	return jstr(m, "access_token"), jstr(m, "refresh_token"), nil
}

// token 返回有效 access_token：本地缓存未过期直接用；否则用 refresh_token 续期
// （refresh 成功后新 access/refresh 立即落库）
func (d *Baidu) token() (string, error) {
	if d.AccessToken != "" && time.Now().Before(d.tokenExpire) {
		return d.AccessToken, nil
	}
	if d.RefreshToken == "" {
		return "", fmt.Errorf("百度网盘授权已失效（无 refresh_token），请重新授权")
	}
	u := fmt.Sprintf("https://openapi.baidu.com/oauth/2.0/token?grant_type=refresh_token&client_id=%s&client_secret=%s&refresh_token=%s",
		url.QueryEscape(d.ClientID), url.QueryEscape(d.ClientSecret), url.QueryEscape(d.RefreshToken))
	m, err := jreq("GET", u, nil, nil)
	if err != nil {
		return "", fmt.Errorf("百度网盘 token 续期失败: %w", err)
	}
	d.AccessToken = jstr(m, "access_token")
	if rt := jstr(m, "refresh_token"); rt != "" {
		d.RefreshToken = rt
		persistPolicyOpt(d.PolicyID, "refresh_token", rt)
	}
	persistPolicyOpt(d.PolicyID, "access_token", d.AccessToken)
	exp := jnum(m, "expires_in")
	if exp < 300 {
		exp = 7200
	}
	d.tokenExpire = time.Now().Add(time.Duration(exp-120) * time.Second)
	if d.AccessToken == "" {
		return "", fmt.Errorf("百度网盘未返回 token")
	}
	return d.AccessToken, nil
}

func (d *Baidu) List(dir string) ([]fscore.Entry, error) {
	c, err := fscore.Clean(dir)
	if err != nil {
		return nil, err
	}
	t, err := d.token()
	if err != nil {
		return nil, err
	}
	u := fmt.Sprintf("%s/file?method=list&access_token=%s&dir=%s&limit=1000", apiBaidu, t, url.QueryEscape(c))
	m, err := jreq("GET", u, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("百度网盘列表失败: %w", err)
	}
	var out []fscore.Entry
	for _, it := range jarr(m, "list") {
		f := it.(map[string]interface{})
		p := jstr(f, "path")
		name := path.Base(p)
		if name == "." || name == "/" {
			continue
		}
		isDir := jnum(f, "isdir") == 1
		ext := ""
		if !isDir {
			if i := strings.LastIndex(name, "."); i > 0 {
				ext = strings.ToLower(name[i+1:])
			}
		}
		out = append(out, fscore.Entry{Name: name, IsDir: isDir, Size: int64(jnum(f, "size")),
			ModTime: int64(jnum(f, "server_mtime")) * 1000, Ext: ext})
		d.setCache(c, name, p)
	}
	sortEntries(out)
	return out, nil
}

func (d *Baidu) setCache(dir, name, fullPath string) {
	d.idMu.Lock()
	d.idCache[path.Join(dir, name)] = fullPath
	d.idMu.Unlock()
}

func (d *Baidu) Stat(p string) (*fscore.Entry, error) {
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

func (d *Baidu) Mkdir(dir string) error {
	if d.readOnly {
		return fmt.Errorf("百度网盘上传接口需应用白名单，当前为只读模式")
	}
	c, err := fscore.Clean(dir)
	if err != nil {
		return err
	}
	t, err := d.token()
	if err != nil {
		return err
	}
	form := url.Values{"path": {c}, "isdir": {"1"}, "rtype": {"1"}}
	_, err = jreq("POST", apiBaidu+"/file?method=create&access_token="+t,
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, []byte(form.Encode()))
	return wrapBaiduErr(err)
}

func (d *Baidu) Rename(p, newName string) error {
	if d.readOnly {
		return fmt.Errorf("百度网盘当前为只读模式")
	}
	c, _ := fscore.Clean(p)
	newPath := path.Join(path.Dir(c), newName)
	t, err := d.token()
	if err != nil {
		return err
	}
	form := url.Values{"filelist": {fmt.Sprintf(`[{"path":%q,"newname":%q}]`, c, newName)}}
	_, err = jreq("POST", apiBaidu+"/filemanager?method=filemanager&opera=rename&access_token="+t,
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, []byte(form.Encode()))
	d.invalidate(c)
	_ = newPath
	return wrapBaiduErr(err)
}

func (d *Baidu) Move(src, dstDir string) error {
	if d.readOnly {
		return fmt.Errorf("百度网盘当前为只读模式")
	}
	sc, _ := fscore.Clean(src)
	dc, _ := fscore.Clean(dstDir)
	t, err := d.token()
	if err != nil {
		return err
	}
	form := url.Values{"filelist": {fmt.Sprintf(`[{"path":%q,"dest":%q,"newname":%q}]`, sc, dc, path.Base(sc))}}
	_, err = jreq("POST", apiBaidu+"/filemanager?method=filemanager&opera=move&access_token="+t,
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, []byte(form.Encode()))
	d.invalidate(sc)
	return wrapBaiduErr(err)
}

func (d *Baidu) Copy(src, dstDir string) error {
	if d.readOnly {
		return fmt.Errorf("百度网盘当前为只读模式")
	}
	sc, _ := fscore.Clean(src)
	dc, _ := fscore.Clean(dstDir)
	t, err := d.token()
	if err != nil {
		return err
	}
	form := url.Values{"filelist": {fmt.Sprintf(`[{"path":%q,"dest":%q,"newname":%q}]`, sc, dc, path.Base(sc))}}
	_, err = jreq("POST", apiBaidu+"/filemanager?method=filemanager&opera=copy&access_token="+t,
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, []byte(form.Encode()))
	return wrapBaiduErr(err)
}

func (d *Baidu) Delete(p string) error {
	if d.readOnly {
		return fmt.Errorf("百度网盘当前为只读模式")
	}
	c, _ := fscore.Clean(p)
	t, err := d.token()
	if err != nil {
		return err
	}
	form := url.Values{"filelist": {fmt.Sprintf(`[%q]`, c)}}
	_, err = jreq("POST", apiBaidu+"/filemanager?method=filemanager&opera=delete&access_token="+t,
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, []byte(form.Encode()))
	d.invalidate(c)
	return wrapBaiduErr(err)
}

func (d *Baidu) invalidate(vp string) {
	d.idMu.Lock()
	for k := range d.idCache {
		if k == vp || strings.HasPrefix(k, vp+"/") {
			delete(d.idCache, k)
		}
	}
	d.idMu.Unlock()
}

func (d *Baidu) DirectURL(p string) (string, error) {
	c, err := fscore.Clean(p)
	if err != nil {
		return "", err
	}
	t, err := d.token()
	if err != nil {
		return "", err
	}
	form := url.Values{"fsids": {fmt.Sprintf(`[%q]`, "/"+strings.TrimPrefix(c, "/"))}}
	m, err := jreq("POST", fmt.Sprintf("%s/multimedia?method=filemetas&access_token=%s&dlink=1", apiBaidu, t),
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, []byte(form.Encode()))
	if err != nil {
		return "", err
	}
	list := jarr(m, "list")
	if len(list) == 0 {
		return "", fmt.Errorf("未获取到下载链接")
	}
	return jstr(list[0].(map[string]interface{}), "dlink") + "&access_token=" + t, nil
}

func (d *Baidu) Open(p string) (fscore.ReadSeekCloser, error) {
	dlink, err := d.DirectURL(p)
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest("GET", dlink, nil)
	req.Header.Set("User-Agent", "pan.baidu.com;netdisk")
	resp, err := d.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("百度网盘下载失败 HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return newByteReader(data), nil
}

func (d *Baidu) CreateFile(p string, r io.Reader) error {
	return fmt.Errorf("百度网盘上传接口需应用白名单，暂不支持上传")
}

func (d *Baidu) Quota() (used, total int64, err error) {
	t, err := d.token()
	if err != nil {
		return 0, 0, err
	}
	m, err := jreq("GET", fmt.Sprintf("%s/index?method=quota&access_token=%s", apiBaidu, t), nil, nil)
	if err != nil {
		return 0, 0, err
	}
	return int64(jnum(m, "used")), int64(jnum(m, "total")), nil
}

func (d *Baidu) Capabilities() fscore.Cap {
	return fscore.Cap{DirectDownload: true, Upload: !d.readOnly, StructureList: true}
}

func wrapBaiduErr(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("百度网盘操作失败: %w", err)
}

// byteReader 支持 Seek 的内存读取器
type byteReader struct {
	data []byte
	pos  int
}

func newByteReader(b []byte) *byteReader { return &byteReader{data: b} }

func (b *byteReader) Read(p []byte) (int, error) {
	if b.pos >= len(b.data) {
		return 0, io.EOF
	}
	n := copy(p, b.data[b.pos:])
	b.pos += n
	return n, nil
}

func (b *byteReader) Seek(off int64, whence int) (int64, error) {
	var np int64
	switch whence {
	case 0:
		np = off
	case 1:
		np = int64(b.pos) + off
	case 2:
		np = int64(len(b.data)) + off
	}
	if np < 0 || np > int64(len(b.data)) {
		return 0, fmt.Errorf("seek 越界")
	}
	b.pos = int(np)
	return np, nil
}

func (b *byteReader) Close() error { b.data = nil; return nil }
