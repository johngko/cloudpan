package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// DLHandler 直链提取：签名的免登录下载直链
// 本地策略：服务端流式直出；云盘策略：302 跳转到官方签名直链
type DLHandler struct{ Site *SiteHandler }

func (h *DLHandler) sign(t officeTarget, ttl time.Duration) string {
	exp := time.Now().Add(ttl).Unix()
	payload := fmt.Sprintf("dlink|%d|%d|%s|%d", t.PolicyID, t.UID, t.Path, exp)
	mac := hmac.New(sha256.New, h.Site.Cfg.Secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + hex.EncodeToString(mac.Sum(nil))
}

func (h *DLHandler) verify(tok string) (*officeTarget, error) {
	dot := strings.Index(tok, ".")
	if dot <= 0 {
		return nil, errors.New("直链非法")
	}
	raw, err := base64.RawURLEncoding.DecodeString(tok[:dot])
	if err != nil {
		return nil, errors.New("直链非法")
	}
	payload := string(raw)
	mac := hmac.New(sha256.New, h.Site.Cfg.Secret)
	mac.Write([]byte(payload))
	if !hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(tok[dot+1:])) {
		return nil, errors.New("直链校验失败")
	}
	parts := strings.SplitN(payload, "|", 5)
	if len(parts) != 5 || parts[0] != "dlink" {
		return nil, errors.New("直链载荷非法")
	}
	var pid, uid, exp int64
	fmt.Sscanf(parts[1], "%d", &pid)
	fmt.Sscanf(parts[2], "%d", &uid)
	fmt.Sscanf(parts[4], "%d", &exp)
	if exp > 0 && time.Now().Unix() > exp {
		return nil, errors.New("直链已过期")
	}
	return &officeTarget{PolicyID: uint(pid), UID: uint(uid), Path: parts[3]}, nil
}

// Create 签发直链（需登录）。expireHours: 1/24/168/720，0 = 永久
func (h *DLHandler) Create(c *gin.Context) {
	u := middleware.CurrentUser(c)
	x := ctxOf(c)
	policyID := parseUintQuery(c, "policyId")
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil || policyID == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	_, d, err := h.Site.Fs.Resolve(u, x.group, policyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	e, err := d.Stat(vp)
	if err != nil {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	if e.IsDir {
		dto.Fail(c, 400, "目录不支持直链（请使用分享）")
		return
	}
	hours := int64(24)
	fmt.Sscanf(c.DefaultQuery("expireHours", "24"), "%d", &hours)
	ttl := time.Duration(hours) * time.Hour
	if hours <= 0 {
		ttl = time.Duration(100*365*24) * time.Hour // 永久
	}
	token := h.sign(officeTarget{PolicyID: policyID, UID: u.ID, Path: vp}, ttl)
	dto.OK(c, gin.H{
		"url":       "/api/dl?token=" + token,
		"expireAt":  time.Now().Add(ttl).UnixMilli(),
		"permanent": hours <= 0,
		"name":      e.Name,
		"size":      e.Size,
	})
}

// Serve 免登录直链出口
func (h *DLHandler) Serve(c *gin.Context) {
	t, err := h.verify(c.Query("token"))
	if err != nil {
		dto.FailHTTP(c, 403, err.Error())
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, t.PolicyID).Error; err != nil {
		dto.FailHTTP(c, 404, "存储不存在")
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, userOfID(t.UID)) // 文件属主的隔离目录
	if err != nil {
		dto.FailHTTP(c, 400, err.Error())
		return
	}
	// 云盘且支持直链：302 到官方签名地址（真·直连）
	if p.Type != "local" {
		if url, err := d.DirectURL(t.Path); err == nil && url != "" {
			c.Redirect(http.StatusFound, url)
			return
		}
	}
	// 本地 / 不支持直链的云盘：服务流式输出
	rc, err := d.Open(t.Path)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	name := baseOf(t.Path)
	if c.Query("att") == "1" {
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(name)))
	} else {
		c.Header("Content-Disposition", fmt.Sprintf(`inline; filename*=UTF-8''%s`, urlEscape(name)))
	}
	// 免登录直链：全局共享桶限速（20MB/s），防签名 URL 被滥用
	rc = wrapDlink(rc)
	http.ServeContent(c.Writer, c.Request, name, modTimeOf(rc), rc)
}
