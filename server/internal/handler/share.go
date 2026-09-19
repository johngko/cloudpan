package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// ShareHandler 分享（管理 + 公开访问）
type ShareHandler struct {
	Site   *SiteHandler
	Secret []byte
}

type shareCreateIn struct {
	PolicyID        uint   `json:"policyId" binding:"required"`
	Path            string `json:"path" binding:"required"`
	Password        string `json:"password"`
	ExpireDays      int    `json:"expireDays"` // 0 = 永久
	RemainDownloads int    `json:"remainDownloads"`
	AllowDownload   *bool  `json:"allowDownload"`
	PreviewEnabled  *bool  `json:"previewEnabled"`
	AllowEdit       *bool  `json:"allowEdit"` // 分享访客可否在线编辑（缺省 = 允许）
	Encrypted       *bool  `json:"encrypted"` // 端到端加密分享（客户端加密，服务端只存密文）
	EncSalt         string `json:"encSalt"`   // 客户端生成的 base64(16B) 随机盐
}

func (h *ShareHandler) Create(c *gin.Context) {
	x := ctxOf(c)
	// 管理员豁免用户组分享限制（用户与管理员均可发起分享/共享）
	if x.user.Role != "admin" && !x.group.AllowShare {
		dto.Fail(c, 403, "当前用户组不允许分享")
		return
	}
	var in shareCreateIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, err := h.Site.Fs.Resolve(x.user, x.group, in.PolicyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	// 内置资源库（T:）仅管理员可见：非管理员不能对 T 建立对外分享链接
	if p.Type == "builtin" && x.user.Role != "admin" {
		dto.Fail(c, 403, "内置资源库不能分享")
		return
	}
	vp, err := fscore.Clean(in.Path)
	if err != nil || vp == "/" {
		dto.Fail(c, 400, "路径非法")
		return
	}
	e, err := d.Stat(vp)
	if err != nil {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	allowDl := true
	if in.AllowDownload != nil {
		allowDl = *in.AllowDownload && x.group.ShareAllowDownload
	}
	preview := true
	if in.PreviewEnabled != nil {
		preview = *in.PreviewEnabled
	}
	// 在线编辑默认允许（Cloudreve 分享模式：任何人打开分享链接都能在线编辑）
	allowEdit := true
	if in.AllowEdit != nil {
		allowEdit = *in.AllowEdit
	}
	// 端到端加密分享：提取码兼作解密密钥（必设），服务端无法解密故强制禁在线编辑
	encrypted := in.Encrypted != nil && *in.Encrypted
	if encrypted {
		if strings.TrimSpace(in.Password) == "" {
			dto.Fail(c, 400, "加密分享必须设置提取码（兼作解密密钥）")
			return
		}
		if _, err := base64.StdEncoding.DecodeString(in.EncSalt); err != nil || len([]byte(in.EncSalt)) != 24 {
			dto.Fail(c, 400, "加密盐非法（需 16 字节 base64）")
			return
		}
		allowEdit = false
	}
	var expires *time.Time
	if in.ExpireDays > 0 {
		t := time.Now().AddDate(0, 0, in.ExpireDays)
		expires = &t
	}
	sh := model.Share{
		UserID: x.user.ID, PolicyID: p.ID, Path: vp, Name: e.Name, IsDir: e.IsDir,
		Token: genID16() + genID16(), RemainDownloads: in.RemainDownloads,
		AllowDownload: allowDl, PreviewEnabled: preview, AllowEdit: allowEdit, ExpiresAt: expires,
		Encrypted: encrypted, EncSalt: in.EncSalt,
	}
	if in.Password != "" {
		sh.PasswordHash = hashPassword(in.Password)
	}
	if err := model.DB.Create(&sh).Error; err != nil {
		dto.Fail(c, 500, "创建分享失败")
		return
	}
	if !allowEdit {
		// GORM default:true 标签会跳过零值（false）不写入 INSERT 列，数据库默认值 true 生效——
		// 显式关闭在线编辑时必须回写，否则「不允许编辑」的分享实际可被编辑
		model.DB.Model(&sh).UpdateColumn("allow_edit", false)
	}
	middleware.Audit(c, "share", p.Name+":"+vp)
	dto.OK(c, sh)
}

func (h *ShareHandler) Mine(c *gin.Context) {
	x := ctxOf(c)
	var items []model.Share
	model.DB.Where("user_id = ?", x.user.ID).Order("created_at DESC").Find(&items)
	// hasPassword 仅回布尔（PasswordHash 本身 json:"-" 不外泄）：「我的共享」/设置页据此显示「需密码」
	out := make([]gin.H, 0, len(items))
	for _, s := range items {
		out = append(out, gin.H{
			"id": s.ID, "userId": s.UserID, "policyId": s.PolicyID, "path": s.Path,
			"name": s.Name, "isDir": s.IsDir, "token": s.Token,
			"hasPassword": s.PasswordHash != "",
			"expiresAt": s.ExpiresAt, "remainDownloads": s.RemainDownloads,
			"previewEnabled": s.PreviewEnabled, "allowDownload": s.AllowDownload,
			"allowEdit": s.AllowEdit, "encrypted": s.Encrypted,
			"views": s.Views, "downloads": s.Downloads, "createdAt": s.CreatedAt,
		})
	}
	dto.OK(c, out)
}

func (h *ShareHandler) Cancel(c *gin.Context) {
	x := ctxOf(c)
	var sh model.Share
	// 先取 token 以清理加密分享的密文目录（sharedata/<token>/）
	_ = model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).First(&sh).Error
	model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).Delete(&model.Share{})
	if sh.Token != "" {
		_ = os.RemoveAll(h.shareDataDir(sh.Token))
	}
	dto.OK(c, nil)
}

// ---- 端到端加密分享：密文存储（DataDir/sharedata/<token>/）----
// 服务端只保存客户端上传的密文与清单（文件名/大小/mtime），永远不接触明文

// shareDataDir 加密分享的密文目录
func (h *ShareHandler) shareDataDir(token string) string {
	return filepath.Join(h.Site.Cfg.Sub("sharedata"), filepath.Base(token))
}

// shareDataMeta 密文清单条目
type shareDataMeta struct {
	Size    int64 `json:"size"`
	Mtime   int64 `json:"mtime"` // 原文件 unix ms（展示用）
	Name    string `json:"name"` // 原文件名（下载 disposition 用）
}

func (h *ShareHandler) manifestPath(token string) string {
	return filepath.Join(h.shareDataDir(token), ".manifest.json")
}

func (h *ShareHandler) loadManifest(token string) map[string]shareDataMeta {
	m := map[string]shareDataMeta{}
	b, err := os.ReadFile(h.manifestPath(token))
	if err == nil {
		_ = json.Unmarshal(b, &m)
	}
	return m
}

func (h *ShareHandler) saveManifest(token string, m map[string]shareDataMeta) {
	_ = os.MkdirAll(h.shareDataDir(token), 0o755)
	if b, err := json.MarshalIndent(m, "", "  "); err == nil {
		_ = os.WriteFile(h.manifestPath(token), b, 0o644)
	}
}

// shareDataMeta 取单个文件的清单（key = 相对分享根路径；单文件分享恒为 "file"）
func (h *ShareHandler) shareDataMeta(token, key string) (shareDataMeta, bool) {
	m, ok := h.loadManifest(token)[key]
	return m, ok
}

// EncryptFile 属主上传「本地加密后的密文」。
// POST /shares/:id/encrypt-file?path=<相对分享根路径,单文件分享留空>&mtime=<原文件 unix ms>
// body = 密文字节流（上限 2GiB）。服务端校验原文件确实存在且位于分享范围内。
func (h *ShareHandler) EncryptFile(c *gin.Context) {
	x := ctxOf(c)
	var sh model.Share
	if err := model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).First(&sh).Error; err != nil {
		dto.Fail(c, 404, "分享不存在")
		return
	}
	if !sh.Encrypted {
		dto.Fail(c, 400, "非加密分享")
		return
	}
	rel := strings.TrimSpace(c.Query("path"))
	var src string
	var diskKey string // 密文目录内的键（相对分享根；单文件分享恒为 "file"）
	if sh.IsDir {
		if rel == "" {
			dto.Fail(c, 400, "目录分享需指定 path")
			return
		}
		// Clean 返回规整后的绝对路径（如 /a/b.txt）且拒绝 ".."；
		// 直接拼到分享根（fscore.Join 会拒绝含 "/" 的多段名，不能用于此场景）
		r2, err := fscore.Clean(rel)
		if err != nil || r2 == "/" {
			dto.Fail(c, 400, "路径非法")
			return
		}
		if sh.Path == "/" {
			src = r2
		} else {
			src = sh.Path + r2
		}
		// 纵深防御：必须严格位于分享根之下
		if sh.Path != "/" && !strings.HasPrefix(src, sh.Path+"/") {
			dto.Fail(c, 403, "路径越界")
			return
		}
		diskKey = strings.TrimPrefix(r2, "/")
	} else {
		if rel != "" {
			dto.Fail(c, 400, "单文件分享不接受 path")
			return
		}
		src = sh.Path
		diskKey = "file"
	}
	// 原文件必须存在且是普通文件（防止为分享范围外的任意路径写入密文）
	var p model.Policy
	if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
		dto.Fail(c, 404, "存储已失效")
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, x.user)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	orig, err := d.Stat(src)
	if err != nil {
		dto.Fail(c, 404, "原文件不存在")
		return
	}
	if orig.IsDir {
		dto.Fail(c, 400, "目录不能直接加密上传（请逐文件）")
		return
	}
	mtime, _ := strconv.ParseInt(c.Query("mtime"), 10, 64)
	if mtime == 0 {
		mtime = orig.ModTime
	}
	// 流式落盘（不把整个密文读进内存：并发传几个 2GiB 大文件即 OOM 服务进程）。
	// 2GiB 上限由 LimitReader 强制，超限拒收。
	dstDir := h.shareDataDir(sh.Token)
	// diskKey 已 Clean 过，再 filepath.FromSlash 适配 Windows；token 已 Base 化
	if err := os.MkdirAll(filepath.Dir(filepath.Join(dstDir, filepath.FromSlash(diskKey))), 0o755); err != nil {
		dto.Fail(c, 500, "创建目录失败")
		return
	}
	dst := filepath.Join(dstDir, filepath.FromSlash(diskKey))
	tmp := dst + ".uploading"
	f, err := os.Create(tmp)
	if err != nil {
		dto.Fail(c, 500, "密文写入失败")
		return
	}
	written, err := io.Copy(f, io.LimitReader(c.Request.Body, 1<<(30+1)))
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(tmp)
		dto.Fail(c, 400, "读取密文失败")
		return
	}
	if written == 0 {
		_ = os.Remove(tmp)
		dto.Fail(c, 400, "密文为空")
		return
	}
	if written > 2<<30 {
		_ = os.Remove(tmp)
		dto.Fail(c, 400, "密文过大（上限 2GB）")
		return
	}
	if err := os.Rename(tmp, dst); err != nil {
		_ = os.Remove(tmp)
		dto.Fail(c, 500, "密文写入失败")
		return
	}
	m := h.loadManifest(sh.Token)
	m[diskKey] = shareDataMeta{Size: written, Mtime: mtime, Name: orig.Name}
	h.saveManifest(sh.Token, m)
	middleware.Audit(c, "share-encrypt", sh.Name+":"+diskKey)
	dto.OK(c, gin.H{"path": diskKey, "size": written})
}

// saveShareCopy 转存复制：分享者 driver → 本人 driver（目录递归）。
// 同名条目不覆盖，自动加后缀（与站内跨盘复制一致）；
// 复制时计算 SHA-256 并登记秒传索引（本地盘），转存内容自此参与全站去重
func (h *ShareHandler) saveShareCopy(sd, dd fscore.Driver, src, dstDir string) error {
	e, err := sd.Stat(src)
	if err != nil {
		return fmt.Errorf("读取源失败 %s: %w", src, err)
	}
	dst, err := uniqueName(dd, dstDir, path.Base(src))
	if err != nil {
		return err
	}
	if e.IsDir {
		if err := dd.Mkdir(dst); err != nil {
			return fmt.Errorf("创建目录失败 %s: %w", dst, err)
		}
		children, err := sd.List(src)
		if err != nil {
			return fmt.Errorf("列目录失败 %s: %w", src, err)
		}
		for _, ch := range children {
			childPath, _ := fscore.Join(src, ch.Name)
			if err := h.saveShareCopy(sd, dd, childPath, dst); err != nil {
				return err
			}
		}
		return nil
	}
	rc, err := sd.Open(src)
	if err != nil {
		return fmt.Errorf("打开文件失败 %s: %w", src, err)
	}
	defer rc.Close()
	hasher := sha256.New()
	if err := dd.CreateFile(dst, io.TeeReader(rc, hasher)); err != nil {
		return fmt.Errorf("写入目标失败 %s: %w", dst, err)
	}
	if phys, perr := fscore.PhysicalOf(dd, dst); perr == nil {
		h.Site.Fs.RegisterHash(hex.EncodeToString(hasher.Sum(nil)), e.Size, phys)
	}
	return nil
}

// SaveToDrive 转存（一键保存到自己账号）：把公开分享的内容复制到当前登录用户的网盘。
// 走本人配额与策略约束；只读用户组（访客）不可转存；带提取码的分享需已 verify（?st=）
func (h *ShareHandler) SaveToDrive(c *gin.Context) {
	sh, owner, ok := h.guard(c)
	if !ok {
		return
	}
	// 加密分享：服务端只有密文，转存（从创建者明文盘复制）会绕过端到端加密，禁止
	if sh.Encrypted {
		dto.Fail(c, 403, "加密分享不支持转存（内容仅客户端可解密）")
		return
	}
	x := ctxOf(c)
	if x.user.Role != "admin" && x.group.ReadOnly {
		dto.Fail(c, 403, "该用户组为只读，仅可查看和下载")
		return
	}
	var in struct {
		PolicyID uint   `json:"policyId" binding:"required"`
		Path     string `json:"path"`    // 目标目录，缺省根目录
		SrcPath  string `json:"srcPath"` // 目录分享时可选：仅转存分享根下的这个子路径
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	// 源路径 = 分享根，或目录分享下指定的子路径（防穿越：Clean 后必须仍在分享根内）
	srcVP := sh.Path
	if in.SrcPath != "" {
		if !sh.IsDir {
			dto.Fail(c, 400, "单文件分享不支持部分转存")
			return
		}
		joined, cerr := fscore.Clean(sh.Path + "/" + in.SrcPath)
		if cerr != nil || !strings.HasPrefix(joined, sh.Path+"/") {
			dto.Fail(c, 400, "转存路径非法")
			return
		}
		srcVP = joined
	}
	dp, dd, err := h.Site.Fs.Resolve(x.user, x.group, in.PolicyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	dstDir, err := fscore.Clean(in.Path)
	if err != nil || dstDir == "" {
		dto.Fail(c, 400, "目标路径非法")
		return
	}
	if de, serr := dd.Stat(dstDir); serr != nil || !de.IsDir {
		dto.Fail(c, 404, "目标目录不存在")
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
		dto.Fail(c, 404, "存储已失效")
		return
	}
	if p.Status == "disabled" {
		dto.Fail(c, 400, "分享所在存储已停用")
		return
	}
	sdrv, err := h.Site.Fs.DriverFor(&p, owner)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	total, err := entryBytes(sdrv, srcVP)
	if err != nil {
		dto.Fail(c, 404, "分享内容不存在")
		return
	}
	if !checkQuota(c, x, total) {
		return
	}
	if err := h.saveShareCopy(sdrv, dd, srcVP, dstDir); err != nil {
		dto.Fail(c, 500, "保存失败："+err.Error())
		return
	}
	addQuota(x.user.ID, total)
	middleware.Audit(c, "share-save", fmt.Sprintf("转存 %s 到 %s:%s", srcVP, dp.Name, dstDir))
	dto.OK(c, gin.H{"saved": true, "bytes": total})
}

// ---- 公开访问 ----

func (h *ShareHandler) loadShare(token string) (*model.Share, *model.User, error) {
	var sh model.Share
	if err := model.DB.Where("token = ?", token).First(&sh).Error; err != nil {
		return nil, nil, errors.New("分享不存在或已取消")
	}
	if sh.RemainDownloads == 0 {
		return nil, nil, errors.New("下载次数已用完")
	}
	if !sh.Available() {
		return nil, nil, errors.New("分享已过期")
	}
	var owner model.User
	if err := model.DB.First(&owner, sh.UserID).Error; err != nil || owner.Disabled {
		return nil, nil, errors.New("分享者账号不可用")
	}
	return &sh, &owner, nil
}

// stoken: HMAC(token+2h)，密码验证通过后签发
func (h *ShareHandler) makeStoken(token string) string {
	mac := hmac.New(sha256.New, h.Secret)
	exp := time.Now().Add(2 * time.Hour).Unix()
	mac.Write([]byte(fmt.Sprintf("share|%s|%d", token, exp)))
	return fmt.Sprintf("%d.%s", exp, hex.EncodeToString(mac.Sum(nil)))
}

func (h *ShareHandler) checkStoken(token, st string) bool {
	return checkShareStoken(h.Secret, token, st)
}

// checkShareStoken 提取码会话票据校验（包级：OfficeHandler 的匿名分享编辑器端点复用）
func checkShareStoken(secret []byte, token, st string) bool {
	var exp int64
	var sig string
	if _, err := fmt.Sscanf(st, "%d.%s", &exp, &sig); err != nil {
		return false
	}
	if time.Now().Unix() > exp {
		return false
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(fmt.Sprintf("share|%s|%d", token, exp)))
	return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(sig))
}

func (h *ShareHandler) Info(c *gin.Context) {
	sh, owner, err := h.loadShare(c.Param("token"))
	if err != nil {
		dto.Fail(c, 404, err.Error())
		return
	}
	model.DB.Model(sh).UpdateColumn("views", sh.Views+1)
	var size int64
	if sh.Encrypted {
		// 加密分享：单文件密文大小取 manifest（明文大小不暴露给未解密者）
		if !sh.IsDir {
			if m, ok := h.shareDataMeta(sh.Token, "file"); ok {
				size = m.Size
			}
		}
	} else {
		if !sh.IsDir {
			var p model.Policy
			if err := model.DB.First(&p, sh.PolicyID).Error; err == nil {
				if d, err := h.Site.Fs.DriverFor(&p, owner); err == nil { // 分享内容在分享者的隔离目录内
					if e, err := d.Stat(sh.Path); err == nil {
						size = e.Size
					}
				}
			}
		}
	}
	dto.OK(c, gin.H{
		"name": sh.Name, "isDir": sh.IsDir, "size": size, "hasPassword": sh.PasswordHash != "",
		"allowDownload": sh.AllowDownload, "previewEnabled": sh.PreviewEnabled,
		"allowEdit": sh.AllowEdit,
		"encrypted": sh.Encrypted, "encSalt": sh.EncSalt,
		"expiresAt": sh.ExpiresAt, "owner": owner.Nickname, "createdAt": sh.CreatedAt,
		"views": sh.Views + 1, "downloads": sh.Downloads,
	})
}

func (h *ShareHandler) Verify(c *gin.Context) {
	sh, _, err := h.loadShare(c.Param("token"))
	if err != nil {
		dto.Fail(c, 404, err.Error())
		return
	}
	if sh.PasswordHash != "" {
		var in struct {
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&in); err != nil || bcrypt.CompareHashAndPassword([]byte(sh.PasswordHash), []byte(in.Password)) != nil {
			dto.Fail(c, 4007, "提取码错误")
			return
		}
	}
	dto.OK(c, gin.H{"stoken": h.makeStoken(sh.Token)})
}

func (h *ShareHandler) guard(c *gin.Context) (*model.Share, *model.User, bool) {
	sh, owner, err := h.loadShare(c.Param("token"))
	if err != nil {
		dto.Fail(c, 404, err.Error())
		return nil, nil, false
	}
	if sh.PasswordHash != "" && !h.checkStoken(sh.Token, c.Query("st")) {
		dto.Fail(c, 401, "请先输入提取码")
		return nil, nil, false
	}
	return sh, owner, true
}

func (h *ShareHandler) List(c *gin.Context) {
	sh, owner, ok := h.guard(c)
	if !ok {
		return
	}
	if !sh.IsDir {
		dto.Fail(c, 400, "该分享是单文件")
		return
	}
	// 加密分享：列表来自密文目录（sharedata/<token>/），与明文盘解耦
	if sh.Encrypted {
		rel := fsClean(c.Query("path"), sh.Path)
		if rel != sh.Path {
			if _, err := fscore.RelTo(sh.Path, rel); err != nil {
				dto.Fail(c, 403, "路径越界")
				return
			}
		}
		sub := strings.TrimPrefix(rel, sh.Path)
		sub = strings.TrimPrefix(sub, "/")
		dirOnDisk := h.shareDataDir(sh.Token)
		if sub != "" {
			dirOnDisk = filepath.Join(dirOnDisk, filepath.FromSlash(sub))
		}
		entries, err := os.ReadDir(dirOnDisk)
		if err != nil {
			dto.Fail(c, 404, "目录不存在")
			return
		}
		m := h.loadManifest(sh.Token)
		items := make([]gin.H, 0, len(entries))
		for _, e := range entries {
			name := e.Name()
			if name == ".manifest.json" || strings.HasPrefix(name, ".") {
				continue
			}
			key := name
			if sub != "" {
				key = sub + "/" + name
			}
			meta, ok := m[key]
			var mt int64
			var sz int64
			if ok {
				mt, sz = meta.Mtime, meta.Size
			}
			if fi, err := e.Info(); err == nil {
				if mt == 0 {
					mt = fi.ModTime().UnixMilli()
				}
				if sz == 0 {
					sz = fi.Size()
				}
			}
			items = append(items, gin.H{"name": name, "isDir": e.IsDir(), "size": sz,
				"modTime": mt, "ext": path.Ext(name), "relPath": key})
		}
		dto.OK(c, items)
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
		dto.Fail(c, 404, "存储已失效")
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, owner)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	// fsClean 已保证 target == 分享根 或位于分享根之下；此处为纵深防御。
	// 注意 RelTo(base, base) 会报错，目标恰为分享根时跳过。
	target := fsClean(c.Query("path"), sh.Path)
	if target != sh.Path {
		if _, err := fscore.RelTo(sh.Path, target); err != nil {
			dto.Fail(c, 403, "路径越界")
			return
		}
	}
	entries, err := d.List(target)
	if err != nil {
		dto.Fail(c, 404, "目录不存在")
		return
	}
	items := make([]gin.H, 0, len(entries))
	for _, e := range entries {
		full, _ := fscore.Join(target, e.Name)
		relPath, _ := fscore.RelTo(sh.Path, full)
		items = append(items, gin.H{"name": e.Name, "isDir": e.IsDir, "size": e.Size,
			"modTime": e.ModTime, "ext": e.Ext, "relPath": relPath})
	}
	dto.OK(c, items)
}

func (h *ShareHandler) Download(c *gin.Context) {
	sh, _, ok := h.guard(c)
	if !ok {
		return
	}
	if !sh.AllowDownload {
		dto.Fail(c, 403, "分享者禁止下载")
		return
	}
	target, ok := shareTarget(sh, c.Query("path"))
	if !ok {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	// 计数在文件确认存在后执行：404 不应消耗下载次数
	if sh.RemainDownloads > 0 {
		model.DB.Model(sh).UpdateColumn("remain_downloads", sh.RemainDownloads-1)
	}
	model.DB.Model(sh).UpdateColumn("downloads", sh.Downloads+1)
	h.serveShareFile(c, sh, target, true)
}

func (h *ShareHandler) Raw(c *gin.Context) {
	sh, _, ok := h.guard(c)
	if !ok {
		return
	}
	if !sh.PreviewEnabled {
		dto.FailHTTP(c, 403, "分享者禁止预览")
		return
	}
	target, ok := shareTarget(sh, c.Query("path"))
	if !ok {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	h.serveShareFile(c, sh, target, false)
}

func (h *ShareHandler) serveShareFile(c *gin.Context, sh *model.Share, target string, attachment bool) {
	// 加密分享：只从密文目录取密文（目录打包会泄露明文，整体禁用）
	if sh.Encrypted {
		h.serveEncryptedFile(c, sh, target, attachment)
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
		dto.FailHTTP(c, 404, "存储已失效")
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, userOfID(sh.UserID)) // 分享内容在分享者的隔离目录内
	if err != nil {
		dto.FailHTTP(c, 400, err.Error())
		return
	}
	e, err := d.Stat(target)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	if e.IsDir {
		// 目录打包下载
		tmpZip := tempZipName()
		defer osRemove(tmpZip)
		if _, err := h.Site.Fs.BuildZip(d, []fscore.ZipItem{{Path: target}}, tmpZip, nil); err != nil {
			dto.FailHTTP(c, 500, "打包失败")
			return
		}
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(e.Name+".zip")))
		c.File(tmpZip)
		return
	}
	rc, err := d.Open(target)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	// dispositionOf 对 html/svg 等可执行文档类型强制 attachment（XSS 防护）
	disposition := dispositionOf(e.Name)
	if attachment {
		disposition = "attachment"
	}
	c.Header("Content-Disposition", fmt.Sprintf(`%s; filename*=UTF-8''%s`, disposition, urlEscape(e.Name)))
	// 分享文件按分享者所在用户组的限速执行
	rc = wrapThrottle(rc, shareOwnerSpeed(sh.UserID))
	http.ServeContent(c.Writer, c.Request, e.Name, time.UnixMilli(e.ModTime), rc)
}

// serveEncryptedFile 从密文目录取密文直出（接收方客户端用提取码解密）。
// target = 全虚拟路径（分享根之下）；单文件分享的 target = 分享文件本身
func (h *ShareHandler) serveEncryptedFile(c *gin.Context, sh *model.Share, target string, attachment bool) {
	var key, displayName string
	if sh.IsDir {
		if target == sh.Path {
			dto.FailHTTP(c, 400, "加密分享不支持目录打包下载，请逐个文件下载")
			return
		}
		rel, err := fscore.RelTo(sh.Path, target)
		if err != nil {
			dto.FailHTTP(c, 404, "文件不存在")
			return
		}
		key = rel
	} else {
		key = "file"
	}
	displayName = path.Base(target)
	dir := h.shareDataDir(sh.Token)
	f, err := os.Open(filepath.Join(dir, filepath.FromSlash(key)))
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在（密文未上传或已取消）")
		return
	}
	defer f.Close()
	fi, _ := f.Stat()
	mtime := time.Now()
	if meta, ok := h.shareDataMeta(sh.Token, key); ok {
		if meta.Name != "" {
			displayName = meta.Name
		}
		if meta.Mtime > 0 {
			mtime = time.UnixMilli(meta.Mtime)
		}
	}
	disposition := dispositionOf(displayName)
	if attachment {
		disposition = "attachment"
	}
	c.Header("Content-Disposition", fmt.Sprintf(`%s; filename*=UTF-8''%s`, disposition, urlEscape(displayName)))
	c.Header("Cache-Control", "no-store")
	http.ServeContent(c.Writer, c.Request, displayName, mtime, f)
	_ = fi
}

// shareOwnerSpeed 分享者所在用户组的下载限速（KB/s，0 = 不限速）
func shareOwnerSpeed(ownerID uint) int64 {
	var u model.User
	if err := model.DB.First(&u, ownerID).Error; err != nil {
		return 0
	}
	var g model.UserGroup
	if err := model.DB.First(&g, u.GroupID).Error; err != nil {
		return 0
	}
	return g.DownloadSpeedKB
}

// 防越界：查询参数是相对分享根的路径（前端约定），一律锚定到分享根下；
// 直接返回 Clean(q) 会让 ?path=/任意 逃出分享范围。
// 相对路径可能含多级（如 a/b/c），需逐段 Join——fscore.Join 不接受含 "/" 的 name。
// 返回值：(锚定后的路径, 是否合法)。ok=false 表示 q 非法（穿越/非法字符），
// 由调用方决定回退分享根（List）还是 404（Download/Raw）。
func shareAnchor(q, shareRoot string) (string, bool) {
	if q == "" {
		return shareRoot, true
	}
	c, err := fscore.Clean(q)
	if err != nil {
		return shareRoot, false
	}
	if c == "/" {
		return shareRoot, true // 显式请求根
	}
	cur := shareRoot
	for _, seg := range strings.Split(strings.TrimPrefix(c, "/"), "/") {
		if seg == "" {
			continue
		}
		next, jerr := fscore.Join(cur, seg)
		if jerr != nil {
			return shareRoot, false
		}
		cur = next
	}
	return cur, true
}

// fsClean 供 List 使用：非法路径回退分享根（列出根内容无泄密风险）
func fsClean(q, shareRoot string) string {
	t, _ := shareAnchor(q, shareRoot)
	return t
}

// shareTarget 供 Download/Raw 使用：单文件分享恒为分享本身；目录分享的非法路径应 404，
// 而不是静默打包整个分享
func shareTarget(sh *model.Share, q string) (string, bool) {
	if !sh.IsDir {
		return sh.Path, true
	}
	return shareAnchor(q, sh.Path)
}
