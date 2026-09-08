package handler

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// TerminalHandler 终端 + 远程 SSH/SFTP
type TerminalHandler struct{}

// NewTerminalHandler 构造终端处理器并记录服务器密钥（AES-GCM 加密连接凭证用）
func NewTerminalHandler(secret []byte) *TerminalHandler {
	termSecret = secret
	return &TerminalHandler{}
}

var termSecret []byte

const sshConnsKey = "ssh_conns"

// sshConnCfg 一个 SSH 连接配置。
// 注意：此结构体永不直接序列化进 API 响应（响应用 sshConnView），
// 故 json 标签可保留（请求绑定需要），凭证不会泄漏。
type sshConnCfg struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	AuthType   string `json:"authType"` // password | key
	Password   string `json:"password"`
	PrivateKey string `json:"privateKey"`
	HostKey    string `json:"hostKey"` // TOFU：base64(公钥)
}

func encodePublicKey(key ssh.PublicKey) string {
	return base64.StdEncoding.EncodeToString(key.Marshal())
}

func decodePublicKey(enc string) (ssh.PublicKey, error) {
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return nil, err
	}
	// ParsePublicKey 解析 SSH 线格式字节；NewPublicKey 接收的是 Go 密码对象，二者不可混用
	return ssh.ParsePublicKey(raw)
}

// ---- 凭证加密（AES-256-GCM，密钥 = 服务器 secret.key）----

func encryptBlob(plain []byte) (string, error) {
	block, err := aes.NewCipher(termSecret)
	if err != nil {
		return "", err
	}
	g, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, g.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(g.Seal(nonce, nonce, plain, nil)), nil
}

func decryptBlob(enc string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(termSecret)
	if err != nil {
		return nil, err
	}
	g, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(raw) < g.NonceSize() {
		return nil, errors.New("数据损坏")
	}
	return g.Open(nil, raw[:g.NonceSize()], raw[g.NonceSize():], nil)
}

// ---- 连接配置存取（UserSetting KV，整值加密）----

func loadSSHConns(uid uint) ([]sshConnCfg, error) {
	var it model.UserSetting
	if err := model.DB.Where("user_id = ? AND key = ?", uid, sshConnsKey).First(&it).Error; err != nil {
		return []sshConnCfg{}, nil // 未配置过
	}
	plain, err := decryptBlob(it.Value)
	if err != nil {
		return nil, errors.New("连接配置解密失败")
	}
	var conns []sshConnCfg
	if err := json.Unmarshal(plain, &conns); err != nil {
		return nil, errors.New("连接配置损坏")
	}
	return conns, nil
}

func saveSSHConns(uid uint, conns []sshConnCfg) error {
	plain, err := json.Marshal(conns)
	if err != nil {
		return err
	}
	enc, err := encryptBlob(plain)
	if err != nil {
		return err
	}
	// 存在性检查必须带 user_id（同 UserSettingsSet 的注释）
	var n int64
	model.DB.Model(&model.UserSetting{}).Where("user_id = ? AND key = ?", uid, sshConnsKey).Count(&n)
	if n > 0 {
		model.DB.Model(&model.UserSetting{}).
			Where("user_id = ? AND key = ?", uid, sshConnsKey).Update("value", enc)
	} else {
		model.DB.Create(&model.UserSetting{UserID: uid, Key: sshConnsKey, Value: enc})
	}
	return nil
}

func (h *TerminalHandler) getSSHConn(uid, id uint) (*sshConnCfg, error) {
	conns, err := loadSSHConns(uid)
	if err != nil {
		return nil, err
	}
	for i := range conns {
		if conns[i].ID == id {
			return &conns[i], nil
		}
	}
	return nil, errors.New("not found")
}

func (h *TerminalHandler) updateSSHConn(uid uint, cc *sshConnCfg) error {
	conns, err := loadSSHConns(uid)
	if err != nil {
		return err
	}
	for i := range conns {
		if conns[i].ID == cc.ID {
			conns[i] = *cc
			return saveSSHConns(uid, conns)
		}
	}
	return errors.New("not found")
}

// ---- 连接管理 API ----

type sshConnView struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	AuthType string `json:"authType"`
}

func connView(cc *sshConnCfg) sshConnView {
	return sshConnView{ID: cc.ID, Name: cc.Name, Host: cc.Host, Port: cc.Port, Username: cc.Username, AuthType: cc.AuthType}
}

func validateConnIn(in *sshConnCfg) error {
	in.Name = strings.TrimSpace(in.Name)
	in.Host = strings.TrimSpace(in.Host)
	in.Username = strings.TrimSpace(in.Username)
	if in.Name == "" || len(in.Name) > 64 {
		return errors.New("连接名称必填（≤64 字符）")
	}
	if in.Host == "" || len(in.Host) > 255 {
		return errors.New("主机必填")
	}
	if in.Port <= 0 || in.Port > 65535 {
		in.Port = 22
	}
	if in.Username == "" || len(in.Username) > 128 {
		return errors.New("用户名必填")
	}
	switch in.AuthType {
	case "password":
		if in.Password == "" {
			return errors.New("密码必填")
		}
	case "key":
		if strings.TrimSpace(in.PrivateKey) == "" {
			return errors.New("私钥必填")
		}
		if _, err := ssh.ParsePrivateKey([]byte(in.PrivateKey)); err != nil {
			return errors.New("私钥解析失败，请粘贴完整 PEM（含 BEGIN/END 行）")
		}
	default:
		return errors.New("认证方式必须为 password 或 key")
	}
	return nil
}

// ConnList GET /api/terminal/conns —— 列表（不含任何凭证）
func (h *TerminalHandler) ConnList(c *gin.Context) {
	x := ctxOf(c)
	conns, err := loadSSHConns(x.user.ID)
	if err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	views := make([]sshConnView, 0, len(conns))
	for i := range conns {
		views = append(views, connView(&conns[i]))
	}
	dto.OK(c, views)
}

// ConnSave POST /api/terminal/conns —— 新增
func (h *TerminalHandler) ConnSave(c *gin.Context) {
	x := ctxOf(c)
	var in sshConnCfg
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	in.ID = 0 // 防止伪造 id
	in.HostKey = ""
	if err := validateConnIn(&in); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	conns, err := loadSSHConns(x.user.ID)
	if err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	if len(conns) >= 32 {
		dto.Fail(c, 400, "最多保存 32 个连接")
		return
	}
	in.ID = 1
	for _, cc := range conns {
		if cc.ID >= in.ID {
			in.ID = cc.ID + 1
		}
	}
	conns = append(conns, in)
	if err := saveSSHConns(x.user.ID, conns); err != nil {
		dto.Fail(c, 500, "保存失败")
		return
	}
	middleware.Audit(c, "terminal_conn", "save "+in.Name+" ("+in.Host+")")
	dto.OK(c, connView(&in))
}

// ConnUpdate PUT /api/terminal/conns/:id —— 更新（凭证字段留空 = 保持不变）
func (h *TerminalHandler) ConnUpdate(c *gin.Context) {
	x := ctxOf(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var in sshConnCfg
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	old, err := h.getSSHConn(x.user.ID, uint(id))
	if err != nil {
		dto.Fail(c, 404, "连接不存在")
		return
	}
	// 合并：留空的凭证保持原值
	if in.Name == "" {
		in.Name = old.Name
	}
	if in.Host == "" {
		in.Host = old.Host
	}
	if in.Username == "" {
		in.Username = old.Username
	}
	if in.AuthType == "" {
		in.AuthType = old.AuthType
	}
	if in.Password == "" {
		in.Password = old.Password
	}
	if in.PrivateKey == "" {
		in.PrivateKey = old.PrivateKey
	}
	if in.HostKey == "" {
		in.HostKey = old.HostKey
	}
	in.ID = old.ID
	if err := validateConnIn(&in); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	conns, _ := loadSSHConns(x.user.ID)
	for i := range conns {
		if conns[i].ID == old.ID {
			conns[i] = in
		}
	}
	if err := saveSSHConns(x.user.ID, conns); err != nil {
		dto.Fail(c, 500, "保存失败")
		return
	}
	sshPoolEvict(x.user.ID, old.ID)
	middleware.Audit(c, "terminal_conn", "update "+in.Name+" ("+in.Host+")")
	dto.OK(c, connView(&in))
}

// ConnDelete DELETE /api/terminal/conns/:id
func (h *TerminalHandler) ConnDelete(c *gin.Context) {
	x := ctxOf(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	old, err := h.getSSHConn(x.user.ID, uint(id))
	if err != nil {
		dto.Fail(c, 404, "连接不存在")
		return
	}
	conns, _ := loadSSHConns(x.user.ID)
	out := conns[:0]
	for _, cc := range conns {
		if cc.ID != old.ID {
			out = append(out, cc)
		}
	}
	if err := saveSSHConns(x.user.ID, out); err != nil {
		dto.Fail(c, 500, "删除失败")
		return
	}
	sshPoolEvict(x.user.ID, old.ID)
	middleware.Audit(c, "terminal_conn", "delete "+old.Name+" ("+old.Host+")")
	dto.OK(c, nil)
}

// ConnTest POST /api/terminal/conns/:id/test —— 测通（拨号 + SFTP 子系统）
func (h *TerminalHandler) ConnTest(c *gin.Context) {
	x := ctxOf(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	cc, err := h.getSSHConn(x.user.ID, uint(id))
	if err != nil {
		dto.Fail(c, 404, "连接不存在")
		return
	}
	t0 := time.Now()
	client, err := sshDial(cc)
	if err != nil {
		dto.Fail(c, 400, "连接失败: "+maskSSHErr(err))
		return
	}
	_ = h.updateSSHConn(x.user.ID, cc) // TOFU 主机密钥回写
	sc, err := sftp.NewClient(client)
	latency := time.Since(t0).Milliseconds()
	if err != nil {
		client.Close()
		dto.Fail(c, 400, "SSH 已连通但 SFTP 子系统不可用: "+err.Error())
		return
	}
	// 顺手取一句系统信息，让「测通」更有信息量
	info := ""
	if f, err2 := sc.Open("/etc/os-release"); err2 == nil {
		b, _ := io.ReadAll(io.LimitReader(f, 4096))
		f.Close()
		for _, line := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				info = strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
				break
			}
		}
	}
	sc.Close()
	client.Close()
	middleware.Audit(c, "terminal_conn", "test "+cc.Name+" OK")
	dto.OK(c, gin.H{"ok": true, "latencyMs": latency, "os": info})
}

// maskSSHErr 避免错误信息回显凭证
func maskSSHErr(err error) string {
	return strings.ReplaceAll(err.Error(), "password", "******")
}

// ---- SSH 连接池（SFTP REST 操作复用；WS 会话用独立连接）----

type sshPooled struct {
	client   *ssh.Client
	lastUsed time.Time
	mu       sync.Mutex
}

var (
	sshPool     = make(map[string]*sshPooled)
	sshPoolMu   sync.Mutex
	sshPoolOnce sync.Once
)

func sshPoolKey(uid, id uint) string {
	return strconv.FormatUint(uint64(uid), 10) + ":" + strconv.FormatUint(uint64(id), 10)
}

func ensureSSHPoolSweeper() {
	sshPoolOnce.Do(func() {
		go func() {
			tk := time.NewTicker(2 * time.Minute)
			for range tk.C {
				now := time.Now()
				sshPoolMu.Lock()
				for k, p := range sshPool {
					p.mu.Lock()
					idle := now.Sub(p.lastUsed)
					p.mu.Unlock()
					if idle > 5*time.Minute {
						p.client.Close()
						delete(sshPool, k)
					}
				}
				sshPoolMu.Unlock()
			}
		}()
	})
}

func sshPoolEvict(uid, id uint) {
	sshPoolMu.Lock()
	defer sshPoolMu.Unlock()
	if p, ok := sshPool[sshPoolKey(uid, id)]; ok {
		p.client.Close()
		delete(sshPool, sshPoolKey(uid, id))
	}
}

// getSSHClient 取（或建立）用户某连接的 SSH 客户端
func (h *TerminalHandler) getSSHClient(uid, id uint) (*ssh.Client, error) {
	ensureSSHPoolSweeper()
	k := sshPoolKey(uid, id)
	sshPoolMu.Lock()
	if p, ok := sshPool[k]; ok {
		p.mu.Lock()
		p.lastUsed = time.Now()
		p.mu.Unlock()
		sshPoolMu.Unlock()
		return p.client, nil
	}
	sshPoolMu.Unlock()

	cc, err := h.getSSHConn(uid, id)
	if err != nil {
		return nil, errors.New("连接不存在")
	}
	client, err := sshDial(cc)
	if err != nil {
		return nil, err
	}
	if cc.HostKey != "" {
		_ = h.updateSSHConn(uid, cc)
	}
	sshPoolMu.Lock()
	// 双检：可能已有别的 goroutine 建好了
	if p, ok := sshPool[k]; ok {
		client.Close()
		p.mu.Lock()
		p.lastUsed = time.Now()
		p.mu.Unlock()
		sshPoolMu.Unlock()
		return p.client, nil
	}
	sshPool[k] = &sshPooled{client: client, lastUsed: time.Now()}
	sshPoolMu.Unlock()
	return client, nil
}

// sftpClean 规范化 SFTP 路径（绝对路径 + 折叠 .. / 冗余分隔符）
func sftpClean(p string) string {
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return path.Clean(p)
}

// sftpMkdirAll 逐级创建目录（文件夹上传时目标子目录可能不存在）
func sftpMkdirAll(cl *sftp.Client, dir string) error {
	dir = sftpClean(dir)
	if dir == "/" {
		return nil
	}
	seg := ""
	for _, part := range strings.Split(dir, "/") {
		if part == "" {
			continue
		}
		seg += "/" + part
		if _, err := cl.Stat(seg); err == nil {
			continue
		}
		if err := cl.Mkdir(seg); err != nil {
			return err
		}
	}
	return nil
}

// withSFTP 在池化 SSH 连接上开 SFTP 会话执行操作；失败时写 Fail 响应并返回错误，
// 成功时返回 nil（由调用方写 OK 响应）；会话级错误剔除连接强制重连
func (h *TerminalHandler) withSFTP(c *gin.Context, uid, connId uint, fn func(cl *sftp.Client) error) error {
	client, err := h.getSSHClient(uid, connId)
	if err != nil {
		dto.Fail(c, 502, "SSH 连接失败: "+maskSSHErr(err))
		return err
	}
	sc, err := sftp.NewClient(client)
	if err != nil {
		sshPoolEvict(uid, connId)
		dto.Fail(c, 502, "SFTP 子系统不可用: "+err.Error())
		return err
	}
	defer sc.Close()
	if err := fn(sc); err != nil {
		var se *sftp.StatusError
		if !errors.As(err, &se) {
			sshPoolEvict(uid, connId) // 非协议错误 → 连接可能已断，剔除重连
		}
		dto.Fail(c, 502, "SFTP 操作失败: "+err.Error())
		return err
	}
	return nil
}

func parseConnQuery(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Query("connId"), 10, 64)
	if err != nil || id == 0 {
		dto.Fail(c, 400, "缺少 connId")
		return 0, false
	}
	return uint(id), true
}

// ---- SFTP 文件操作 ----

type sftpEntry struct {
	Name    string `json:"name"`
	Type    string `json:"type"` // dir | file
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
	Perm    string `json:"perm"`
}

// FSList GET /api/terminal/fs/list?connId=&path=
func (h *TerminalHandler) FSList(c *gin.Context) {
	x := ctxOf(c)
	connId, ok := parseConnQuery(c)
	if !ok {
		return
	}
	p := c.Query("path")
	if p == "" {
		p = "/"
	}
	var out gin.H
	err := h.withSFTP(c, x.user.ID, connId, func(cl *sftp.Client) error {
		clean := sftpClean(p)
		infos, err := cl.ReadDir(clean)
		if err != nil {
			return err
		}
		entries := make([]sftpEntry, 0, len(infos))
		for _, fi := range infos {
			perm := "0644"
			if fi.Mode()&0o40000 != 0 {
				perm = "0755"
			}
			entries = append(entries, sftpEntry{
				Name:    fi.Name(),
				Type:    "file",
				Size:    fi.Size(),
				ModTime: fi.ModTime().Format("2006-01-02 15:04"),
				Perm:    perm,
			})
			if fi.IsDir() {
				entries[len(entries)-1].Type = "dir"
			}
		}
		// 目录在前，名称排序
		sortSFTPEntries(entries)
		parent := path.Dir(clean)
		if parent == clean || parent == "." {
			parent = "/"
		}
		out = gin.H{"path": clean, "parent": parent, "entries": entries}
		return nil
	})
	if err == nil {
		dto.OK(c, out)
	}
}

func sortSFTPEntries(es []sftpEntry) {
	// 简单插入排序（目录条目通常不多；目录恒排前）
	for i := 1; i < len(es); i++ {
		for j := i; j > 0; j-- {
			a, b := es[j-1], es[j]
			if a.Type == "dir" && b.Type == "file" {
				break
			}
			if a.Type == "file" && b.Type == "dir" {
				es[j-1], es[j] = b, a
				continue
			}
			if strings.ToLower(a.Name) <= strings.ToLower(b.Name) {
				break
			}
			es[j-1], es[j] = b, a
		}
	}
}

// FSOps POST /api/terminal/fs/op {connId, op: mkdir|delete|rename|move, path, target?}
func (h *TerminalHandler) FSOps(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		ConnId uint   `json:"connId" binding:"required"`
		Op     string `json:"op" binding:"required"`
		Path   string `json:"path" binding:"required"`
		Target string `json:"target"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	switch in.Op {
	case "mkdir", "delete", "rename", "move":
	default:
		dto.Fail(c, 400, "op 必须为 mkdir/delete/rename/move")
		return
	}
	if in.Op == "rename" || in.Op == "move" {
		if in.Target == "" {
			dto.Fail(c, 400, "target 必填")
			return
		}
	}
	err := h.withSFTP(c, x.user.ID, in.ConnId, func(cl *sftp.Client) error {
		p := sftpClean(in.Path)
		switch in.Op {
		case "mkdir":
			return cl.Mkdir(p)
		case "delete":
			return sftpRemoveAll(cl, p)
		case "rename", "move":
			return cl.Rename(p, sftpClean(in.Target))
		}
		return nil
	})
	if err == nil {
		dto.OK(c, nil)
		middleware.Audit(c, "terminal_fs", in.Op+" "+in.Path)
	}
}

// sftpRemoveAll 递归删除（SFTP 协议无递归删除）
func sftpRemoveAll(cl *sftp.Client, p string) error {
	fi, err := cl.Lstat(p)
	if err != nil {
		return err
	}
	if !fi.IsDir() {
		return cl.Remove(p)
	}
	infos, err := cl.ReadDir(p)
	if err != nil {
		return err
	}
	for _, fi := range infos {
		if err := sftpRemoveAll(cl, sftpClean(path.Join(p, fi.Name()))); err != nil {
			return err
		}
	}
	return cl.RemoveDirectory(p)
}

// FSDownload GET /api/terminal/fs/download?connId=&path= （?t= 令牌直链可用）
func (h *TerminalHandler) FSDownload(c *gin.Context) {
	x := ctxOf(c)
	connId, ok := parseConnQuery(c)
	if !ok {
		return
	}
	p := c.Query("path")
	if p == "" {
		dto.Fail(c, 400, "缺少 path")
		return
	}
	// 流式响应在闭包内直接写；失败时 withSFTP 写 Fail（此时响应头未发出）
	_ = h.withSFTP(c, x.user.ID, connId, func(cl *sftp.Client) error {
		clean := sftpClean(p)
		f, err := cl.Open(clean)
		if err != nil {
			return err
		}
		defer f.Close()
		fi, err := f.Stat()
		if err != nil || fi.IsDir() {
			return errors.New("不是文件")
		}
		name := fi.Name()
		c.Header("Content-Type", "application/octet-stream")
		c.Header("Content-Disposition",
			fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`,
				rfc5987ASCII(name), url.PathEscape(name)))
		if fi.Size() >= 0 {
			c.Header("Content-Length", strconv.FormatInt(fi.Size(), 10))
		}
		c.Status(http.StatusOK)
		_, err = io.Copy(c.Writer, f)
		return err
	})
}

// rfc5987ASCII 文件名回退值：非 ASCII 时给个安全名
func rfc5987ASCII(name string) string {
	var b strings.Builder
	for _, r := range name {
		if r < 0x80 {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	s := b.String()
	s = strings.Trim(s, `"`)
	if s == "" {
		s = "download"
	}
	return s
}

// FSUpload POST /api/terminal/fs/upload?connId=&path=&name=&overwrite=1
// 请求体 = 原始文件字节流（前端 XHR 直传，进度可上报）
func (h *TerminalHandler) FSUpload(c *gin.Context) {
	x := ctxOf(c)
	connId, ok := parseConnQuery(c)
	if !ok {
		return
	}
	dir := c.Query("path")
	if dir == "" {
		dir = "/"
	}
	name := path.Base(c.Query("name"))
	if name == "" || name == "." || name == "/" || strings.Contains(c.Query("name"), "/") {
		dto.Fail(c, 400, "文件名非法")
		return
	}
	overwrite := c.Query("overwrite") == "1"
	var wrote int64
	err := h.withSFTP(c, x.user.ID, connId, func(cl *sftp.Client) error {
		target := sftpClean(path.Join(dir, name))
		// 文件夹上传：目标子目录可能不存在，逐级补建
		if err := sftpMkdirAll(cl, path.Dir(target)); err != nil {
			return err
		}
		// 不覆盖时先探测存在性：OpenSSH 对 O_EXCL 冲突只回 SSH_FX_FAILURE（无 "exists" 字样），
		// 预检才能给出明确错误
		if !overwrite {
			if _, serr := cl.Lstat(target); serr == nil {
				return errors.New("文件已存在（勾选覆盖后可替换）")
			}
		}
		flags := os.O_CREATE | os.O_WRONLY
		if overwrite {
			flags |= os.O_TRUNC
		}
		f, err := cl.OpenFile(target, flags)
		if err != nil {
			return err
		}
		defer f.Close()
		buf := make([]byte, 1<<20)
		for {
			n, rerr := c.Request.Body.Read(buf)
			if n > 0 {
				if _, werr := f.Write(buf[:n]); werr != nil {
					return werr
				}
				wrote += int64(n)
			}
			if rerr == io.EOF {
				return nil
			}
			if rerr != nil {
				return rerr
			}
		}
	})
	if err == nil {
		dto.OK(c, gin.H{"size": wrote})
		middleware.Audit(c, "terminal_fs", "upload "+dir+"/"+name+" ("+strconv.FormatInt(wrote, 10)+"B)")
	}
}
