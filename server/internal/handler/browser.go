package handler

// ---- 内置浏览器代理 ----
// 浏览器应用的 iframe 只能嵌入同源页面，而绝大多数公网站点会发送
// X-Frame-Options / CSP frame-ancestors 拒绝被嵌入。因此由服务端代取：
//   - HTML：重写全部资源地址（src/href/action/srcset/…）为代理路径、
//     移除站点自带的 <base> 与 CSP meta（否则脚本/样式加载被站点策略拦截）；
//   - 其它资源：字节透传（带大小上限）。
//
// 安全边界：
//   - 只接受 GET（不代提交表单/写操作）；
//   - 复用离线下载 SSRF 三层防线（validateFetchURL + ssrfCheckRedirect +
//     拨号层 DNS 复检），不能把服务器当内网扫描器/开放代理用；
//   - 鉴权用短时效代理票据 pt（HMAC(uid|exp)，30 分钟）而非真实 JWT——
//     iframe 子资源请求没有 Authorization 头，而真实 JWT 不宜出现在每个
//     资源 URL 里；访问日志对 pt 打码（main.go AccessLogger 清单）；
//   - 响应头覆盖全局 SecurityHeaders 的 X-Frame-Options: DENY / CSP
//     frame-ancestors 'none'（否则代理页自身无法被 iframe 嵌入）。
//
// 已知限制（v1）：站点内 JS 发起的相对 fetch/XHR 与 SPA 路由导航不走代理
// （纯 HTML 重写无法触及运行时行为）；登录态 Cookie 不保持；重表单不可用。
// 前端提供「在系统浏览器中打开」兜底。

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

type BrowserHandler struct{ Secret []byte }

const (
	browserMaxHTML    = 8 << 20  // 参与重写的 HTML 上限
	browserMaxRes     = 128 << 20 // 透传资源上限
	proxyTokenTTL     = 30 * time.Minute
	proxyUA           = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

// ---- 短时效代理票据 pt = base64url(uid|exp) . base64url(HMAC-SHA256) ----

func (h *BrowserHandler) proxyToken(uid uint) string {
	payload := fmt.Sprintf("%d|%d", uid, time.Now().Add(proxyTokenTTL).Unix())
	b := base64.RawURLEncoding.EncodeToString([]byte(payload))
	mac := hmac.New(sha256.New, h.Secret)
	mac.Write([]byte(b))
	return b + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// proxyTokenUID 验签并检查有效期，返回 uid
func (h *BrowserHandler) proxyTokenUID(pt string) (uint, bool) {
	parts := strings.SplitN(pt, ".", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return 0, false
	}
	mac := hmac.New(sha256.New, h.Secret)
	mac.Write([]byte(parts[0]))
	rawMac, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return 0, false
	}
	if !hmac.Equal(rawMac, mac.Sum(nil)) {
		return 0, false
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return 0, false
	}
	f := strings.SplitN(string(raw), "|", 2)
	if len(f) != 2 {
		return 0, false
	}
	uid, e1 := strconv.ParseUint(f[0], 10, 64)
	exp, e2 := strconv.ParseInt(f[1], 10, 64)
	if e1 != nil || e2 != nil || time.Now().Unix() > exp {
		return 0, false
	}
	return uint(uid), true
}

// auth 代理路由专用鉴权：登录 JWT（Authorization 头或 ?t=）与短时效票据 ?pt=
// 二者皆可。普通 /api 路由仍只认 JWT，pt 仅在本组路由内有效。
func (h *BrowserHandler) auth(c *gin.Context) {
	tok := ""
	if hv := c.GetHeader("Authorization"); strings.HasPrefix(hv, "Bearer ") {
		tok = strings.TrimPrefix(hv, "Bearer ")
	} else if t := c.Query("t"); t != "" {
		tok = t
	}
	if tok != "" {
		if claims, err := middleware.ParseToken(tok, h.Secret); err == nil {
			var u model.User
			if model.DB.First(&u, claims.UID).Error == nil && !u.Disabled {
				c.Set("user", &u)
				c.Next()
				return
			}
		}
	}
	if pt := c.Query("pt"); pt != "" {
		if uid, ok := h.proxyTokenUID(pt); ok {
			var u model.User
			if model.DB.First(&u, uid).Error == nil && !u.Disabled {
				c.Set("user", &u)
				c.Next()
				return
			}
		}
	}
	c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "未登录"})
}

// Session 签发代理票据（前端拿到后拼进 iframe src 与刷新请求）
func (h *BrowserHandler) Session(c *gin.Context) {
	u := middleware.CurrentUser(c)
	dto.OK(c, gin.H{"pt": h.proxyToken(u.ID)})
}

// ---- URL 重写 ----

var (
	reBaseTag      = regexp.MustCompile(`(?i)<base\b[^>]*>`)
	reCSPMeta      = regexp.MustCompile(`(?i)<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>`)
	reURLAttr      = regexp.MustCompile(`(?i)\b(data-src|data-href|lowsrc|src|href|action|poster)\s*=\s*["']([^"']*)["']`)
	reSrcsetAttr   = regexp.MustCompile(`(?i)\bsrcset\s*=\s*["']([^"']*)["']`)
	reMetaRefresh  = regexp.MustCompile(`(?i)<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>`)
	reMetaRefreshU = regexp.MustCompile(`(?i)\burl=([^"'\s&<>]+)`)
	reHeadOpen     = regexp.MustCompile(`(?i)<head[^>]*>`)
	reMetaCharset  = regexp.MustCompile(`(?i)<meta[^>]+charset\s*=\s*["']?([a-zA-Z0-9_\-]+)`)
)

// rewriteBrowserHTML 把目标页 HTML 重写为可在同源 iframe 中展示的形态：
// 1) 移除站点自带 <base>（其相对解析语义与代理路径不兼容）；
// 2) 移除 CSP meta（frame-ancestors/script-src 等会拦截代理后的资源加载）；
// 3) src/href/action/poster/srcset/meta-refresh 中的地址一律重写为代理路径
//    （相对地址先按页面 URL 解析为绝对地址再代理）；
// 4) 注入 <base> 指向代理页自身，兜底未命中规则的相对地址（含 JS 中
//    相对 fetch）——相对解析会落在 /api/browser/p/<其他段> 上被 400 拒绝，
//    不会误取他站资源。
func rewriteBrowserHTML(html string, base *url.URL, pt string) string {
	proxied := func(abs string) string {
		return "/api/browser/p/" + base64.RawURLEncoding.EncodeToString([]byte(abs)) + "?pt=" + pt
	}
	toProxy := func(raw string) string {
		s := strings.TrimSpace(raw)
		if s == "" {
			return s
		}
		low := strings.ToLower(s)
		switch {
		case strings.HasPrefix(low, "#"), strings.HasPrefix(low, "javascript:"),
			strings.HasPrefix(low, "data:"), strings.HasPrefix(low, "mailto:"),
			strings.HasPrefix(low, "tel:"), strings.HasPrefix(low, "blob:"),
			strings.HasPrefix(low, "about:"), strings.HasPrefix(low, "ftp:"),
			strings.HasPrefix(low, "ws:"), strings.HasPrefix(low, "wss:"):
			return s
		}
		if strings.HasPrefix(s, "//") {
			s = "https:" + s
		}
		u, err := url.Parse(s)
		if err != nil {
			return s
		}
		absU := base.ResolveReference(u)
		if absU.Scheme != "http" && absU.Scheme != "https" {
			return s
		}
		return proxied(absU.String())
	}

	html = reBaseTag.ReplaceAllString(html, "")
	html = reCSPMeta.ReplaceAllString(html, "")

	// 代理 URL 只含 base64url 字符与 ?pt=（无引号/空白）→ 双引号属性包裹安全
	html = reURLAttr.ReplaceAllStringFunc(html, func(m string) string {
		g := reURLAttr.FindStringSubmatch(m)
		return g[1] + `="` + toProxy(g[2]) + `"`
	})
	// srcset：逗号分隔的「地址 描述符」列表，仅重写每段第一个 token
	html = reSrcsetAttr.ReplaceAllStringFunc(html, func(m string) string {
		g := reSrcsetAttr.FindStringSubmatch(m)
		segs := strings.Split(g[1], ",")
		for i, seg := range segs {
			fields := strings.Fields(seg)
			if len(fields) == 0 {
				continue
			}
			rest := strings.TrimPrefix(seg, fields[0])
			segs[i] = toProxy(fields[0]) + rest
		}
		return `srcset="` + strings.Join(segs, ",") + `"`
	})
	// meta refresh：5;url=https://...
	html = reMetaRefresh.ReplaceAllStringFunc(html, func(m string) string {
		g := reMetaRefreshU.FindStringSubmatch(m)
		if g == nil {
			return m
		}
		return strings.Replace(m, "url="+g[1], "url="+toProxy(g[1]), 1)
	})

	inject := `<base href="` + proxied(base.String()) + `">`
	if loc := reHeadOpen.FindStringIndex(html); loc != nil {
		html = html[:loc[1]] + inject + html[loc[1]:]
	} else {
		html = inject + html
	}
	return html
}

// toUTF8 按响应 Content-Type / <meta charset> 把页面字节转成 UTF-8 字符串。
// 中文站点大量使用 gbk/gb2312，直接按 UTF-8 输出会整页乱码。
func toUTF8(body []byte, contentType string, html string) string {
	charset := ""
	if i := strings.Index(strings.ToLower(contentType), "charset="); i >= 0 {
		rest := contentType[i+len("charset="):]
		if j := strings.IndexAny(rest, "; \t'\""); j >= 0 {
			rest = rest[:j]
		}
		charset = strings.TrimSpace(rest)
	}
	if charset == "" {
		if g := reMetaCharset.FindStringSubmatch(html[:min(len(html), 4096)]); g != nil {
			charset = g[1]
		}
	}
	conv := func(dec transform.Transformer) (string, bool) {
		b, _, err := transform.Bytes(dec, body)
		return string(b), err == nil
	}
	switch strings.ToLower(charset) {
	case "", "utf-8", "utf8", "unicode-1-1-utf-8":
		return html
	case "gb2312", "gbk", "gb18030":
		if s, ok := conv(simplifiedchinese.GB18030.NewDecoder()); ok {
			return s
		}
	case "big5", "big5-hkscs", "cn-big5":
		if s, ok := conv(traditionalchinese.Big5.NewDecoder()); ok {
			return s
		}
	case "utf-16le", "utf-16":
		if s, ok := conv(unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewDecoder()); ok {
			return s
		}
	case "utf-16be":
		if s, ok := conv(unicode.UTF16(unicode.BigEndian, unicode.UseBOM).NewDecoder()); ok {
			return s
		}
	case "windows-1252", "cp1252":
		if s, ok := conv(charmap.Windows1252.NewDecoder()); ok {
			return s
		}
	case "iso-8859-1", "latin1", "latin-1", "x-mac-roman":
		if s, ok := conv(charmap.ISO8859_1.NewDecoder()); ok {
			return s
		}
	}
	// 未知字符集：按 UTF-8 原样输出（非法序列由浏览器容错）
	return html
}

// Proxy 代取目标地址：:b64 是 base64url(目标绝对 URL)。
// HTML 走重写分支，其余透传。
func (h *BrowserHandler) Proxy(c *gin.Context) {
	// 覆盖全局 SecurityHeaders：代理响应（含 400/502 错误 JSON）都要在 iframe 内渲染，
	// 不能带 frame-ancestors 'none'/XFO DENY，否则错误页被 CSP 自锁成不透明的浏览器错误页
	hdr := c.Writer.Header()
	hdr.Set("X-Frame-Options", "SAMEORIGIN")
	hdr.Del("Content-Security-Policy")

	enc := c.Param("b64")
	raw, err := base64.RawURLEncoding.DecodeString(enc)
	if err != nil {
		dto.FailHTTP(c, 400, "代理地址非法")
		return
	}
	target := strings.TrimSpace(string(raw))
	if err := validateFetchURL(target); err != nil {
		dto.FailHTTP(c, 400, "该地址不能通过浏览器代理访问："+err.Error())
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, target, nil)
	if err != nil {
		dto.FailHTTP(c, 400, "URL 非法")
		return
	}
	// 模拟浏览器请求头，降低 CDN 基于 UA/Referer 的防盗链 403
	req.Header.Set("User-Agent", proxyUA)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	resp, err := ssrfHTTP.Do(req) // SSRF 三层防护（重定向复检 + 拨号层 DNS 复检）
	if err != nil {
		dto.FailHTTP(c, 502, "无法连接目标网站："+err.Error())
		return
	}
	defer resp.Body.Close()

	// 重定向后的最终地址才是重写分支的重写基准（302 到别的路径时 base 必须跟着走）
	finalURL := target
	if resp.Request != nil && resp.Request.URL != nil {
		finalURL = resp.Request.URL.String()
	}
	base, err := url.Parse(finalURL)
	if err != nil {
		dto.FailHTTP(c, 502, "目标地址解析失败")
		return
	}

	ct := resp.Header.Get("Content-Type")
	if strings.Contains(strings.ToLower(ct), "html") {
		body, rerr := io.ReadAll(io.LimitReader(resp.Body, browserMaxHTML+1))
		if rerr != nil {
			dto.FailHTTP(c, 502, "读取目标页面失败")
			return
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			pt := c.Query("pt")
			if pt == "" {
				pt = h.proxyToken(middleware.CurrentUser(c).ID)
			}
			html := toUTF8(body, ct, string(body))
			if len(body) > browserMaxHTML {
				// 超大页面：不重写，原样透传（可能部分资源缺失，但主体可读）
				c.Header("Content-Type", "text/html; charset=utf-8")
				c.Header("Cache-Control", "no-store")
				c.Writer.WriteHeader(resp.StatusCode)
				_, _ = c.Writer.Write(body)
				return
			}
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.Header("Cache-Control", "no-store")
			c.String(resp.StatusCode, rewriteBrowserHTML(html, base, pt))
		} else {
			// 非 200（404/500 等）：原样透传错误页主体
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.Data(resp.StatusCode, ct, body)
		}
		return
	}

	// 非 HTML：字节透传（300s 客户端缓存；上限截断防大文件打满带宽）
	c.Header("Content-Type", ct)
	c.Header("Cache-Control", "public, max-age=300")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(c.Writer, io.LimitReader(resp.Body, browserMaxRes))
}
