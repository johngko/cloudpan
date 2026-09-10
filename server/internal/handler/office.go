package handler

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	jwt "github.com/golang-jwt/jwt/v5"

	"cloudpan/internal/driver"
	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// OfficeHandler ONLYOFFICE Document Server 集成
type OfficeHandler struct {
	Site *SiteHandler
	// LoadShare 共享可见性加载器（由 router 注入 UserShareHandler.loadShareByID）；
	// 仅 Config（登录态）需要；File/Callback 走无用户上下文的 token 自授权解析
	LoadShare func(c *gin.Context, id uint) (*model.UserShare, fscore.Driver, bool)
}

// officeTarget DS 拉取/回调目标：
// kind=local  → PolicyID+UID+Path（UID=文件属主，本地策略按属主隔离目录解析）
// kind=shared → ShareID+Rel（共享内容属创建者，回调保存走创建者隔离目录）
type officeTarget struct {
	Kind     string `json:"k"`
	PolicyID uint   `json:"p"`
	UID      uint   `json:"u"`
	Path     string `json:"path"`
	ShareID  uint   `json:"s"`
	Rel      string `json:"r"`
	// Edit=false（view 签发）的 token 只允许拉取文件，回调保存一律拒绝——
	// 否则只读组用户/只读共享查看者可持合法 token 伪造回调覆盖他人文件
	Edit bool  `json:"e"`
	Exp  int64 `json:"exp"`
}

func parseUintQuery(c *gin.Context, key string) uint {
	v, _ := strconv.ParseUint(c.Query(key), 10, 32)
	return uint(v)
}

// signFileToken 生成供 DS 使用的短期签名 token：b64url(JSON).hex(hmac(JSON))
// JSON 载荷避免旧版 "|" 分隔在路径含分隔符时歧义
func (h *OfficeHandler) signFileToken(t officeTarget) string {
	t.Exp = time.Now().Add(24 * time.Hour).Unix()
	b, _ := json.Marshal(t)
	mac := hmac.New(sha256.New, h.Site.Cfg.Secret)
	mac.Write(b)
	return base64.RawURLEncoding.EncodeToString(b) + "." + hex.EncodeToString(mac.Sum(nil))
}

func (h *OfficeHandler) verifyToken(tok string) (*officeTarget, error) {
	dot := strings.Index(tok, ".")
	if dot <= 0 {
		return nil, errors.New("token 非法")
	}
	raw, err := base64.RawURLEncoding.DecodeString(tok[:dot])
	if err != nil {
		return nil, errors.New("token 非法")
	}
	mac := hmac.New(sha256.New, h.Site.Cfg.Secret)
	mac.Write(raw)
	if !hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(tok[dot+1:])) {
		return nil, errors.New("token 校验失败")
	}
	var t officeTarget
	if err := json.Unmarshal(raw, &t); err != nil {
		return nil, errors.New("token 载荷非法")
	}
	if t.Kind != "local" && t.Kind != "shared" {
		return nil, errors.New("token 类型非法")
	}
	if time.Now().Unix() > t.Exp {
		return nil, errors.New("token 已过期")
	}
	return &t, nil
}

// resolveShared 从 token 解析共享文件（无用户上下文：token 本身即授权，
// 但路径仍须落在共享根内，存储/共享失效则失败）
func (h *OfficeHandler) resolveShared(t *officeTarget) (*model.UserShare, *model.Policy, fscore.Driver, string, error) {
	var sh model.UserShare
	if err := model.DB.First(&sh, t.ShareID).Error; err != nil {
		return nil, nil, nil, "", errors.New("共享不存在或已取消")
	}
	var p model.Policy
	if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
		return nil, nil, nil, "", errors.New("存储已失效")
	}
	full, ok := userShareFull(&sh, t.Rel)
	if !ok {
		return nil, nil, nil, "", errors.New("路径越界")
	}
	d, err := h.Site.Fs.DriverFor(&p, userOfID(sh.OwnerID))
	if err != nil {
		return nil, nil, nil, "", err
	}
	return &sh, &p, d, full, nil
}

// publicBase Document Server 回拉文件/回调用的基础地址，优先级：
// 1) 环境变量 CP_PUBLIC_URL 显式设置（运维意图）
// 2) 站点设置 public_url（管理控制台填写，需 DS 可达）
// 3) 当前请求的 Host 推导（浏览器能到达的地址，单机部署下通常 DS 也能到达）
// 注意：Cfg.PublicURL 未显式设置时只是 localhost 默认值，不能直接用于远端 DS
func (h *OfficeHandler) publicBase(c *gin.Context) string {
	if h.Site.Cfg.PublicURLOverridden {
		if b := strings.TrimRight(h.Site.Cfg.PublicURL, "/"); b != "" {
			return b
		}
	}
	if b := strings.TrimRight(GetSiteSettings()["public_url"], "/"); b != "" {
		return b
	}
	scheme := "http"
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + c.Request.Host
}

// Health 管理员探测 Document Server 连通性（/healthcheck）
func (h *OfficeHandler) Health(c *gin.Context) {
	settings := GetSiteSettings()
	dsURL := strings.TrimRight(settings["onlyoffice_url"], "/")
	if dsURL == "" {
		dto.Fail(c, 400, "未配置 Document Server 地址")
		return
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(dsURL + "/healthcheck")
	if err != nil {
		dto.OK(c, gin.H{"ok": false, "msg": "连接失败：" + err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != http.StatusOK {
		dto.OK(c, gin.H{"ok": false, "msg": fmt.Sprintf("HTTP %d：%s", resp.StatusCode, strings.TrimSpace(string(body)))})
		return
	}
	dto.OK(c, gin.H{"ok": true, "msg": "连接正常：" + strings.TrimSpace(string(body))})
}

// Config 签发编辑器配置
// 本地盘：GET /api/office/config?policyId=&path=&mode=edit|view
// 共享盘：GET /api/office/config?shareId=&rel=&mode=edit|view（ro 共享强制 view）
func (h *OfficeHandler) Config(c *gin.Context) {
	u := middleware.CurrentUser(c)
	x := ctxOf(c)
	settings := GetSiteSettings()
	dsURL := strings.TrimRight(settings["onlyoffice_url"], "/")
	jwtSecret := settings["onlyoffice_jwt"]
	if dsURL == "" {
		dto.Fail(c, 400, "ONLYOFFICE 未配置：请在管理控制台-站点设置中填写 Document Server 地址；留空 JWT 表示 Document Server 未启用 JWT")
		return
	}
	mode := c.DefaultQuery("mode", "edit")
	if mode != "edit" && mode != "view" {
		mode = "edit"
	}
	shareID := parseUintQuery(c, "shareId")
	policyID := parseUintQuery(c, "policyId")
	if shareID == 0 && policyID == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var d fscore.Driver
	var vp string
	editable := u.Role == "admin"
	if shareID != 0 {
		if h.LoadShare == nil {
			dto.Fail(c, 500, "共享服务不可用")
			return
		}
		sh, dd, ok := h.LoadShare(c, shareID)
		if !ok {
			return
		}
		full, ok := userShareFull(sh, c.Query("rel"))
		if !ok {
			dto.Fail(c, 403, "路径越界")
			return
		}
		editable = sh.Perm == "rw" // 共享可写性只看共享授权（admin 也不能借 ro 共享写别人盘）
		d, vp = dd, full
	} else {
		v, err := fscore.Clean(c.Query("path"))
		if err != nil {
			dto.Fail(c, 400, "参数错误")
			return
		}
		_, dd, err := h.Site.Fs.Resolve(u, x.group, policyID)
		if err != nil {
			dto.Fail(c, 403, err.Error())
			return
		}
		// 只读用户组（非 admin）只能 view，与 fs.go requireWritable 语义一致
		editable = u.Role == "admin" || x.group == nil || !x.group.ReadOnly
		d, vp = dd, v
	}
	if !editable {
		mode = "view"
	}
	e, err := d.Stat(vp)
	if err != nil {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	if e.IsDir {
		dto.Fail(c, 400, "不能打开目录")
		return
	}
	ext := strings.TrimPrefix(strings.ToLower(path.Ext(vp)), ".")
	editFlag := mode == "edit"
	var fileToken string
	if shareID != 0 {
		fileToken = h.signFileToken(officeTarget{Kind: "shared", ShareID: shareID, Rel: strings.TrimPrefix(c.Query("rel"), "/"), Edit: editFlag})
	} else {
		fileToken = h.signFileToken(officeTarget{Kind: "local", PolicyID: policyID, UID: u.ID, Path: vp, Edit: editFlag})
	}
	publicBase := h.publicBase(c)

	docURL := fmt.Sprintf("%s/api/office/file?token=%s", publicBase, fileToken)
	callbackURL := fmt.Sprintf("%s/api/office/callback?token=%s", publicBase, fileToken)

	// document.key 内容变化后必须变化：以 mtime 参与哈希（含来源标识防跨盘碰撞）
	keySum := sha256.Sum256([]byte(fmt.Sprintf("%d|%d|%s|%d", shareID, policyID, vp, e.ModTime)))
	docKey := base64.RawURLEncoding.EncodeToString(keySum[:])[:20]

	docType := "word"
	switch ext {
	case "xlsx", "xls", "csv", "ods":
		docType = "cell"
	case "pptx", "ppt", "odp":
		docType = "slide"
	}

	cfgMap := map[string]interface{}{
		"documentType": docType,
		"type":         "desktop",
		"document": map[string]interface{}{
			"fileType": ext,
			"key":      docKey,
			"title":    e.Name,
			"url":      docURL,
			"permissions": map[string]interface{}{
				"edit": mode == "edit", "download": true, "print": true, "comment": true,
			},
		},
		"editorConfig": map[string]interface{}{
			"callbackUrl": callbackURL,
			"lang":        "zh",
			"mode":        mode,
			"user":        map[string]interface{}{"id": fmt.Sprintf("u-%d", u.ID), "name": u.Nickname},
			"customization": map[string]interface{}{
				"autosave": true, "forcesave": true, "compactHeader": true,
			},
		},
	}

	// 仅当 Document Server 启用了 JWT 时才签名并携带 token；未配置密钥（如 Cloudreve 部署）则不签名
	if jwtSecret != "" {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims(cfgMap))
		signed, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			dto.Fail(c, 500, "配置签名失败")
			return
		}
		cfgMap["token"] = signed
	}
	dto.OK(c, gin.H{"documentServer": dsURL, "config": cfgMap})
}

// File DS 服务端拉取文件
func (h *OfficeHandler) File(c *gin.Context) {
	t, err := h.verifyToken(c.Query("token"))
	if err != nil {
		dto.FailHTTP(c, 403, err.Error())
		return
	}
	var d fscore.Driver
	var vp string
	if t.Kind == "shared" {
		_, _, dd, full, err := h.resolveShared(t)
		if err != nil {
			dto.FailHTTP(c, 404, err.Error())
			return
		}
		d, vp = dd, full
	} else {
		var p model.Policy
		if err := model.DB.First(&p, t.PolicyID).Error; err != nil {
			dto.FailHTTP(c, 404, "存储不存在")
			return
		}
		d, err = h.Site.Fs.DriverFor(&p, userOfID(t.UID)) // 文件属主的隔离目录
		if err != nil {
			dto.FailHTTP(c, 400, err.Error())
			return
		}
		vp = t.Path
	}
	rc, err := d.Open(vp)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	// 不预设 Content-Type：由 ServeContent 按扩展名/内容嗅探，Document Server 依赖正确类型识别文档
	c.Header("Cache-Control", "no-cache")
	http.ServeContent(c.Writer, c.Request, path.Base(vp), time.Now(), rc)
}

type dsCallback struct {
	Key    string `json:"key"`
	Status int    `json:"status"`
	URL    string `json:"url"`
}

// Callback DS 保存回调：status 2/6 携带新文件 URL，下载覆盖原文件
func (h *OfficeHandler) Callback(c *gin.Context) {
	t, err := h.verifyToken(c.Query("token"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"error": 1, "message": err.Error()})
		return
	}
	var cb dsCallback
	if err := c.ShouldBindJSON(&cb); err != nil {
		c.JSON(http.StatusOK, gin.H{"error": 1})
		return
	}
	// view 签发的 token 一律不落盘（防只读身份借回调覆盖他人文件）
	if !t.Edit {
		c.JSON(http.StatusOK, gin.H{"error": 0})
		return
	}
	if (cb.Status == 2 || cb.Status == 6) && cb.URL != "" {
		if t.Kind == "shared" {
			sh, p, d, full, err := h.resolveShared(t)
			if err == nil {
				h.saveCallbackBody(cb.URL, full, d, func(phys string) {
					fscore.SaveVersion(p.ID, sh.OwnerID, full, phys)
				}, fmt.Sprintf("share:%d %s", t.ShareID, full))
			}
		} else {
			var p model.Policy
			if err := model.DB.First(&p, t.PolicyID).Error; err == nil {
				if d, err := h.Site.Fs.DriverFor(&p, userOfID(t.UID)); err == nil {
					h.saveCallbackBody(cb.URL, t.Path, d, func(phys string) {
						fscore.SaveVersion(t.PolicyID, t.UID, t.Path, phys)
					}, fmt.Sprintf("policy:%d %s", t.PolicyID, t.Path))
				}
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"error": 0})
}

// saveCallbackBody 拉取 DS 保存产物并覆盖原文件（覆盖前归档旧版本）
func (h *OfficeHandler) saveCallbackBody(cbURL, vp string, d fscore.Driver, archive func(phys string), auditDetail string) {
	resp, err := http.Get(cbURL)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<30)) // 2GiB 上限，防止异常回调拉爆内存
	if err != nil {
		return
	}
	if phys, perr := fscore.PhysicalOf(d, vp); perr == nil {
		archive(phys)
	}
	if werr := d.CreateFile(vp, bytes.NewReader(body)); werr != nil {
		return
	}
	model.DB.Create(&model.AuditLog{UserID: 0, Username: "onlyoffice", Action: "office-save",
		Detail: auditDetail + fmt.Sprintf(" (%d bytes)", len(body))})
}

// ---- 云盘授权 ----

// CloudAuth 云盘 OAuth 授权辅助
type CloudAuth struct{ Site *SiteHandler }

// AuthURL 返回指定策略类型的授权页地址
func (h *CloudAuth) AuthURL(c *gin.Context) {
	policyID := parseUintQuery(c, "policyId")
	var p model.Policy
	if err := model.DB.First(&p, policyID).Error; err != nil {
		dto.Fail(c, 404, "存储策略不存在")
		return
	}
	o := p.Opts()
	switch p.Type {
	case "aliyun":
		dto.OK(c, gin.H{"url": driver.AliyunAuthURL(o["client_id"]), "mode": "code"})
	case "baidu":
		dto.OK(c, gin.H{"url": driver.BaiduAuthURL(o["client_id"]), "mode": "code"})
	case "pan123":
		dto.OK(c, gin.H{"url": "", "mode": "keys"}) // 123 直接用 clientID/secret，无需跳转
	case "tianyi":
		dto.OK(c, gin.H{"url": "", "mode": "cookie"})
	default:
		dto.OK(c, gin.H{"url": "", "mode": "none"})
	}
}

// Exchange 用授权码换取 token 并写回策略 options
func (h *CloudAuth) Exchange(c *gin.Context) {
	var in struct {
		PolicyID uint   `json:"policyId" binding:"required"`
		Type     string `json:"type" binding:"required"`
		Code     string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, in.PolicyID).Error; err != nil {
		dto.Fail(c, 404, "存储策略不存在")
		return
	}
	o := p.Opts()
	switch in.Type {
	case "aliyun":
		refresh, _, err := driver.AliyunExchangeCode(o["client_id"], o["client_secret"], in.Code)
		if err != nil {
			dto.Fail(c, 400, err.Error())
			return
		}
		o["refresh_token"] = refresh
	case "baidu":
		acc, err := driver.BaiduExchangeCode(o["client_id"], o["client_secret"], in.Code)
		if err != nil {
			dto.Fail(c, 400, err.Error())
			return
		}
		o["access_token"] = acc
	default:
		dto.Fail(c, 400, "不支持的授权类型")
		return
	}
	b, _ := json.Marshal(o)
	model.DB.Model(&p).UpdateColumn("options", string(b))
	h.Site.Fs.Invalidate(p.ID)
	middleware.Audit(c, "admin", "云盘授权成功 "+p.Name)
	dto.OK(c, gin.H{"ok": true})
}

// Status 授权连通性探测
func (h *CloudAuth) Status(c *gin.Context) {
	policyID := parseUintQuery(c, "policyId")
	var p model.Policy
	if err := model.DB.First(&p, policyID).Error; err != nil {
		dto.Fail(c, 404, "存储策略不存在")
		return
	}
	if p.Type == "local" {
		dto.OK(c, gin.H{"ok": true, "msg": "本地存储"})
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, nil) // 云盘连通性探测（本地策略已提前返回）
	if err != nil {
		dto.OK(c, gin.H{"ok": false, "msg": err.Error()})
		return
	}
	used, total, err := d.Quota()
	if err != nil {
		dto.OK(c, gin.H{"ok": false, "msg": err.Error()})
		return
	}
	dto.OK(c, gin.H{"ok": true, "used": used, "total": total})
}
