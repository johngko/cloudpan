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
	"path"
	"strconv"
	"strings"
	"sync"
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
}

type officeTarget struct {
	PolicyID uint
	Path     string
}

var officeTokens sync.Map // token → *officeTarget

func parseUintQuery(c *gin.Context, key string) uint {
	v, _ := strconv.ParseUint(c.Query(key), 10, 32)
	return uint(v)
}

// signFileToken 生成供 DS 使用的短期签名 token：b64url(payload).hex(hmac(payload))
func (h *OfficeHandler) signFileToken(t officeTarget, ttl time.Duration) string {
	exp := time.Now().Add(ttl).Unix()
	payload := fmt.Sprintf("%d|%s|%d", t.PolicyID, t.Path, exp)
	mac := hmac.New(sha256.New, h.Site.Cfg.Secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + hex.EncodeToString(mac.Sum(nil))
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
	payload := string(raw)
	mac := hmac.New(sha256.New, h.Site.Cfg.Secret)
	mac.Write([]byte(payload))
	if !hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(tok[dot+1:])) {
		return nil, errors.New("token 校验失败")
	}
	parts := strings.SplitN(payload, "|", 3)
	if len(parts) != 3 {
		return nil, errors.New("token 载荷非法")
	}
	var pid uint64
	fmt.Sscanf(parts[0], "%d", &pid)
	var exp int64
	fmt.Sscanf(parts[2], "%d", &exp)
	if time.Now().Unix() > exp {
		return nil, errors.New("token 已过期")
	}
	return &officeTarget{PolicyID: uint(pid), Path: parts[1]}, nil
}

// Config 签发编辑器配置（GET /api/office/config?policyId=&path=&mode=edit|view）
func (h *OfficeHandler) Config(c *gin.Context) {
	u := middleware.CurrentUser(c)
	x := ctxOf(c)
	policyID := parseUintQuery(c, "policyId")
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil || policyID == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, err := h.Site.Fs.Resolve(u.ID, u.Role, x.group, policyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	e, err := d.Stat(vp)
	if err != nil {
		dto.Fail(c, 404, "文件不存在")
		return
	}
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
	ext := strings.TrimPrefix(strings.ToLower(path.Ext(vp)), ".")
	fileToken := h.signFileToken(officeTarget{PolicyID: policyID, Path: vp}, 24*time.Hour)
	publicBase := strings.TrimRight(h.Site.Cfg.PublicURL, "/")

	docURL := fmt.Sprintf("%s/api/office/file?token=%s", publicBase, fileToken)
	callbackURL := fmt.Sprintf("%s/api/office/callback?token=%s", publicBase, fileToken)

	// document.key 内容变化后必须变化：以 mtime 参与哈希
	keySum := sha256.Sum256([]byte(fmt.Sprintf("%d|%s|%d", p.ID, vp, e.ModTime)))
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
	var p model.Policy
	if err := model.DB.First(&p, t.PolicyID).Error; err != nil {
		dto.FailHTTP(c, 404, "存储不存在")
		return
	}
	d, err := h.Site.Fs.DriverOf(&p)
	if err != nil {
		dto.FailHTTP(c, 400, err.Error())
		return
	}
	rc, err := d.Open(t.Path)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	name := path.Base(t.Path)
	c.Header("Content-Type", "application/octet-stream")
	// 禁止浏览器缓存：文件可被在线编辑覆盖，必须每次拉取最新内容
	c.Header("Cache-Control", "no-cache")
	http.ServeContent(c.Writer, c.Request, name, time.Now(), rc)
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
	if (cb.Status == 2 || cb.Status == 6) && cb.URL != "" {
		var p model.Policy
		if err := model.DB.First(&p, t.PolicyID).Error; err == nil {
			if d, err := h.Site.Fs.DriverOf(&p); err == nil {
				resp, err := http.Get(cb.URL)
				if err == nil {
					body, err := io.ReadAll(resp.Body)
					resp.Body.Close()
					if err == nil {
						// 覆盖前归档旧版本（与上传覆盖行为一致）
						if phys, err := fscore.PhysicalOf(d, t.Path); err == nil {
							fscore.SaveVersion(t.PolicyID, 0, t.Path, phys)
						}
						_ = d.CreateFile(t.Path, strings.NewReader(string(body)))
						model.DB.Create(&model.AuditLog{UserID: 0, Username: "onlyoffice", Action: "office-save",
							Detail: fmt.Sprintf("policy:%d %s (%d bytes)", t.PolicyID, t.Path, len(body))})
					}
				}
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"error": 0})
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
	d, err := h.Site.Fs.DriverOf(&p)
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
