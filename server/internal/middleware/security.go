package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
)

// SecurityHeaders 全局安全响应头。
// CSP 说明：script-src/frame-src 放行 https: 是因为 ONLYOFFICE 文档服务器地址可配置，
// DocsAPI 会从该域名动态注入脚本与 iframe；对自托管场景如需收紧，可在此改为具体来源。
func SecurityHeaders() gin.HandlerFunc {
	const csp = "default-src 'self'; " +
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
		"style-src 'self' 'unsafe-inline' https:; " +
		"img-src 'self' data: blob: https:; " +
		"media-src 'self' blob: https:; " +
		"connect-src 'self' https:; " +
		"font-src 'self' data:; " +
		"frame-src 'self' https:; " +
		"frame-ancestors 'none'; " +
		"object-src 'none'; " +
		"base-uri 'self'; " +
		"form-action 'self'"
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Content-Security-Policy", csp)
		c.Next()
	}
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
