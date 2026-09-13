package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

// dsOrigins 读取站点配置的 ONLYOFFICE 文档服务器 origin 列表（scheme://host，可多台）。
// 多 DS 列表（onlyoffice_dses）优先，回退单 DS 设置（onlyoffice_url）。
// 站点设置变更最多 10 秒后生效（下方 TTL 缓存）。
func dsOrigins() []string {
	var rows []model.SiteSetting
	model.DB.Where("key IN ?", []string{"onlyoffice_dses", "onlyoffice_url"}).Find(&rows)
	vals := map[string]string{}
	for _, r := range rows {
		vals[r.Key] = r.Value
	}
	var out []string
	add := func(u string) {
		u = strings.TrimRight(strings.TrimSpace(u), "/")
		if u == "" {
			return
		}
		pu, err := url.Parse(u)
		if err != nil || pu.Host == "" || (pu.Scheme != "http" && pu.Scheme != "https") {
			return
		}
		origin := pu.Scheme + "://" + pu.Host
		for _, x := range out {
			if x == origin {
				return
			}
		}
		out = append(out, origin)
	}
	if raw := strings.TrimSpace(vals["onlyoffice_dses"]); raw != "" && raw != "[]" {
		var list []struct {
			URL string `json:"url"`
		}
		if err := json.Unmarshal([]byte(raw), &list); err == nil {
			for _, d := range list {
				add(d.URL)
			}
			if len(out) > 0 {
				return out
			}
		}
	}
	add(vals["onlyoffice_url"])
	return out
}

// buildCSP 按当前 ONLYOFFICE 来源生成 CSP。
// 收紧点（相对旧版）：
//  - 移除 'unsafe-eval' 与 script/style/connect/frame 的 https: 通配——
//    原写法等于允许任意第三方站点注入脚本/建立连接，是存储型 XSS 的放大器；
//  - ONLYOFFICE 文档服务器是动态配置的第三方来源，DocsAPI 需要从其加载脚本、
//    建 iframe、发起 API 连接，按配置值精确放行该 origin 即可。
func buildCSP(origins []string) string {
	joined := strings.Join(origins, " ")
	csp := "default-src 'self'; " +
		"script-src 'self' 'unsafe-inline'; " +
		"style-src 'self' 'unsafe-inline'; " +
		"img-src 'self' data: blob:; " +
		"media-src 'self' blob:; " +
		// api.open-meteo.com：小组件天气卡的数据源（免费公共天气 API，只读 GET，无 key），
		// 精确放行该主机；离线时前端优雅降级显示「暂无法获取天气」
		"connect-src 'self' https://api.open-meteo.com; " +
		"font-src 'self' data:; " +
		"frame-src 'self'; " +
		"frame-ancestors 'none'; " +
		"object-src 'none'; " +
		"base-uri 'self'; " +
		"form-action 'self'"
	if joined != "" {
		csp = strings.ReplaceAll(csp, "script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' "+joined)
		csp = strings.ReplaceAll(csp, "connect-src 'self'", "connect-src 'self' "+joined)
		csp = strings.ReplaceAll(csp, "frame-src 'self'", "frame-src 'self' "+joined)
		csp = strings.ReplaceAll(csp, "img-src 'self' data: blob:", "img-src 'self' data: blob: "+joined)
		csp = strings.ReplaceAll(csp, "media-src 'self' blob:", "media-src 'self' blob: "+joined)
		csp = strings.ReplaceAll(csp, "font-src 'self' data:", "font-src 'self' data: "+joined)
	}
	return csp
}

// SecurityHeaders 全局安全响应头（CSP 按请求生成，10 秒 TTL 缓存避免每请求查库）
func SecurityHeaders() gin.HandlerFunc {
	var (
		mu       sync.Mutex
		cached   string
		cachedAt time.Time
	)
	return func(c *gin.Context) {
		mu.Lock()
		if time.Since(cachedAt) > 10*time.Second {
			cached = buildCSP(dsOrigins())
			cachedAt = time.Now()
		}
		csp := cached
		mu.Unlock()
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// vendor 页面（mindmap host.html / pdfjs viewer / drawio / poster）需要被主应用窗口
		// 以同源 iframe 嵌入，frame-ancestors 放宽为 'self'（仍禁止跨站嵌入防点击劫持）；
		// 其余页面保持 'none' + XFO DENY。
		if frameableVendorPath(c.Request.URL.Path) {
			h.Set("X-Frame-Options", "SAMEORIGIN")
			csp = strings.Replace(csp, "frame-ancestors 'none'; ", "frame-ancestors 'self'; ", 1)
		} else {
			h.Set("X-Frame-Options", "DENY")
		}
		// 海报设计（vendored poster-design）的 vue-i18n 运行时消息编译器依赖 new Function，
		// 无 'unsafe-eval' 时 $t 渲染整块失效（保存/下载按钮消失）。仅对该 vendored 子树放宽，
		// 其余路径维持严格 CSP。
		if strings.HasPrefix(c.Request.URL.Path, "/vendor/poster/") {
			csp = strings.Replace(csp, "script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'", 1)
		}
		h.Set("Content-Security-Policy", csp)
		c.Next()
	}
}

// frameableVendorPath 判断是否为允许被同源 iframe 嵌入的 vendor 页面：
// 思维导图（host.html）、PDF 阅读器（web/viewer.html）、流程图（drawio index）、海报设计（index.html）。
func frameableVendorPath(p string) bool {
	return strings.HasPrefix(p, "/vendor/mindmap/") ||
		strings.HasPrefix(p, "/vendor/pdfjs/") ||
		strings.HasPrefix(p, "/vendor/drawio") ||
		strings.HasPrefix(p, "/vendor/poster/")
}

// redactQueryValues 将 "path?query" 串中指定参数的值打码（保留参数顺序与其它参数原样）
func redactQueryValues(pathQuery string, set map[string]struct{}) string {
	i := strings.IndexByte(pathQuery, '?')
	if i < 0 {
		return pathQuery
	}
	parts := strings.Split(pathQuery[i+1:], "&")
	for j, kv := range parts {
		key := kv
		if eq := strings.IndexByte(kv, '='); eq >= 0 {
			key = kv[:eq]
		}
		if _, ok := set[key]; ok {
			parts[j] = key + "=***"
		}
	}
	return pathQuery[:i+1] + strings.Join(parts, "&")
}

// redactShareToken 将路径中的分享主令牌（/api/s/<token>/...）打码。
// 分享令牌即访问凭据（持 URL 可取内容），与 query 里的凭据同等对待。
func redactShareToken(pathQuery string) string {
	const marker = "/s/"
	i := strings.Index(pathQuery, marker)
	if i < 0 {
		return pathQuery
	}
	rest := pathQuery[i+len(marker):]
	if j := strings.IndexByte(rest, '/'); j >= 0 {
		return pathQuery[:i+len(marker)] + "***" + rest[j:]
	}
	return pathQuery[:i+len(marker)] + "***"
}

// AccessLogger 与 gin.Logger() 同格式的访问日志，但会打码敏感凭据
// （?t= 的 JWT、直链 ?token=、分享提取码 ?st=、路径里的分享主令牌 /s/<token>），
// 防止有效凭证明文进入服务器日志。
// 格式镜像 gin v1.12 defaultLogFormatter；gin 的 Logger 在请求开始时即读取 RawQuery，
// 因此无法用"先脱敏再还原"的中间件实现，只能在 Formatter 层处理。
func AccessLogger(redactParams ...string) gin.HandlerFunc {
	set := make(map[string]struct{}, len(redactParams))
	for _, k := range redactParams {
		set[k] = struct{}{}
	}
	formatter := func(param gin.LogFormatterParams) string {
		param.Path = redactShareToken(redactQueryValues(param.Path, set))
		var statusColor, methodColor, resetColor, latencyColor string
		if param.IsOutputColor() {
			statusColor = param.StatusCodeColor()
			methodColor = param.MethodColor()
			resetColor = param.ResetColor()
			latencyColor = param.LatencyColor()
		}
		latency := param.Latency
		switch {
		case latency > time.Minute:
			latency = latency.Truncate(time.Second * 10)
		case latency > time.Second:
			latency = latency.Truncate(time.Millisecond * 10)
		case latency > time.Millisecond:
			latency = latency.Truncate(time.Microsecond * 10)
		}
		return fmt.Sprintf("[GIN] %v |%s %3d %s|%s %8v %s| %15s |%s %-7s %s %#v\n%s",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			statusColor, param.StatusCode, resetColor,
			latencyColor, latency, resetColor,
			param.ClientIP,
			methodColor, param.Method, resetColor,
			param.Path,
			param.ErrorMessage,
		)
	}
	return gin.LoggerWithConfig(gin.LoggerConfig{Formatter: formatter})
}

// IPRateLimiter 每 IP 内存令牌桶（用于登录/注册防暴破）。
// 桶随空闲超时被回收，内存不会无限增长。
type IPRateLimiter struct {
	mu      sync.Mutex
	rate    float64 // 令牌/秒
	burst   float64
	buckets map[string]*ipBucket
}

type ipBucket struct {
	tok  float64
	last time.Time
}

// NewIPRateLimiter ratePerMin: 每 IP 每分钟允许次数；burst: 瞬时突发上限
func NewIPRateLimiter(ratePerMin int, burst int) *IPRateLimiter {
	l := &IPRateLimiter{rate: float64(ratePerMin) / 60, burst: float64(burst), buckets: map[string]*ipBucket{}}
	go l.gc()
	return l
}

func (l *IPRateLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	b := l.buckets[ip]
	if b == nil {
		l.buckets[ip] = &ipBucket{tok: l.burst - 1, last: now}
		return true
	}
	b.tok += now.Sub(b.last).Seconds() * l.rate
	if b.tok > l.burst {
		b.tok = l.burst
	}
	b.last = now
	if b.tok < 1 {
		return false
	}
	b.tok--
	return true
}

func (l *IPRateLimiter) gc() {
	for range time.Tick(10 * time.Minute) {
		l.mu.Lock()
		cutoff := time.Now().Add(-10 * time.Minute)
		for ip, b := range l.buckets {
			if b.last.Before(cutoff) {
				delete(l.buckets, ip)
			}
		}
		l.mu.Unlock()
	}
}

// RateLimit 按来源 IP 限速；超限返回 429
func RateLimit(l *IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !l.Allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, dto.R{Code: 429, Msg: "操作过于频繁，请稍后再试"})
			return
		}
		c.Next()
	}
}
