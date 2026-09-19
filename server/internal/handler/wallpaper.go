package handler

import (
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
)

// 外部 URL 壁纸（壁纸中心「我的壁纸」）：
// 顶层 SPA 文档的 CSP img-src 只有 'self' data: blob:——若为壁纸放宽 https: 通配，
// 恶意 .md / office 文件里的一行 <img src=https://evil/track> 就能给攻击者开像素外传
// 通道，因此改为服务端代取：同源端点回传图片，CSP 保持严格。
// SSRF 防护见 checkWallpaperHost：只允许 http/https 公网地址，重定向逐跳复检，20MB 上限。
const (
	wallpaperMaxURLLen  = 2048
	wallpaperMaxBodyLen = 20 << 20 // 20MB，超出的尾部直接截断（浏览器对过大图也会拒绝解码）
	wallpaperMaxRedir   = 5
)

// Wallpaper GET /api/fs/wallpaper?p=<base64url(图片URL)>[&t=<token>]
// 代取用户自选的外部图片并以同源响应回传（供 CSS 背景 --wp-ext-url 使用）。
func (h *SiteHandler) Wallpaper(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("p"))
	if raw == "" {
		dto.Fail(c, 400, "缺少壁纸地址")
		return
	}
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(b) == 0 || len(b) > wallpaperMaxURLLen {
		dto.Fail(c, 400, "无效的壁纸地址")
		return
	}
	u, err := url.Parse(string(b))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		dto.Fail(c, 400, "仅支持 http/https 图片地址")
		return
	}
	if err := checkWallpaperHost(u); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= wallpaperMaxRedir {
				return errors.New("重定向次数过多")
			}
			// 每一跳都重新做地址校验，防 302 跳转到内网（DNS rebinding/重定向 SSRF）
			return checkWallpaperHost(req.URL)
		},
	}
	resp, err := client.Get(u.String())
	if err != nil {
		dto.Fail(c, 502, "壁纸下载失败")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		dto.Fail(c, 502, "壁纸源站返回异常")
		return
	}
	// 只回传图片，避免该端点被当作任意内容抓取器
	ct := strings.ToLower(resp.Header.Get("Content-Type"))
	if ct == "" {
		ct = "image/jpeg"
	}
	if i := strings.IndexByte(ct, ';'); i > 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	if !strings.HasPrefix(ct, "image/") {
		dto.Fail(c, 502, "壁纸源站返回的不是图片")
		return
	}
	c.Header("Content-Type", ct)
	c.Header("Cache-Control", "private, max-age=86400")
	c.Header("X-Content-Type-Options", "nosniff")
	io.CopyN(c.Writer, resp.Body, wallpaperMaxBodyLen)
}

// checkWallpaperHost 拒绝环回/私网/链路本地/保留段的图片源（SSRF 防护）。
// 说明：校验后由默认 Dialer 再次解析 DNS，理论上存在 DNS rebinding 窗口；
// 但触发前提是「已登录用户主动把攻击者域名填为自己的壁纸地址」（自攻击），
// 且重定向逐跳复检已覆盖 302 跳板，故不做 IP 钉死（复杂度与收益不匹配）。
func checkWallpaperHost(u *url.URL) error {
	host := u.Hostname()
	if host == "" {
		return errors.New("无效的壁纸地址")
	}
	if ip := net.ParseIP(host); ip != nil {
		if !isPublicIP(ip) {
			return errors.New("不允许使用内网/保留地址")
		}
		return nil
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return errors.New("壁纸域名解析失败")
	}
	for _, ip := range ips {
		if !isPublicIP(ip) {
			return errors.New("不允许使用内网/保留地址")
		}
	}
	return nil
}

func isPublicIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		a, b := ip4[0], ip4[1]
		if a == 100 && b >= 64 && b <= 127 { // 100.64.0.0/10 CGNAT
			return false
		}
		if a == 192 && b == 0 { // 192.0.0.0/24 IETF 保留
			return false
		}
		if a == 198 && (b == 18 || b == 19) { // 198.18.0.0/15 基准测试
			return false
		}
	}
	return true
}
