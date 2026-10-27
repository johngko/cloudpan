package handler

// C1 S3 兼容网关：协议/XML 层用 gofakes3（纯 Go），文件语义映射 fscore（见 s3fs.go）。
// 鉴权走自验证的 AWS SigV4（每用户一组 access key / secret，A2 scoped token 的 S3 对应物）：
// gofakes3 本身不做请求签名校验，这里逐请求重算签名比对（±15min 时窗）。
// 端点：path-style，https://<站点>/s3/<bucket>/<key>；bucket = "disk-<策略字母小写>"。
// rclone 挂载：provider=Amazon 或 Alibaba/AnyS3，endpoint=.../s3，force_path_style=true。

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/hex"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/johannesboyne/gofakes3"
)

const s3TimeSkew = 15 * time.Minute

// s3Handlers 每用户缓存一个 gofakes3 实例（backend 闭包持有该用户身份）
var (
	s3HandlersMu sync.Mutex
	s3Handlers   = map[uint]http.Handler{}
)

func s3HandlerFor(u *model.User, svc *fscore.Service) http.Handler {
	s3HandlersMu.Lock()
	defer s3HandlersMu.Unlock()
	if x, ok := s3Handlers[u.ID]; ok {
		return x
	}
	x := gofakes3.New(&s3Backend{u: u, svc: svc}).Server()
	s3Handlers[u.ID] = x
	return x
}

// awsEscape SigV4 规范要求的 URI 编码：仅 A-Za-z0-9-._~ 与 '/' 不转义
func awsEscape(s string) string {
	var sb strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
			c == '-' || c == '.' || c == '_' || c == '~' || c == '/' {
			sb.WriteByte(c)
		} else {
			sb.WriteString("%")
			sb.WriteString(strings.ToUpper(hex.EncodeToString([]byte{c})))
		}
	}
	return sb.String()
}

func hmacSHA256(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(data)
	return m.Sum(nil)
}

func s3SigningKey(secret, date, region, service string) []byte {
	k := hmacSHA256([]byte("AWS4"+secret), []byte(date))
	k = hmacSHA256(k, []byte(region))
	k = hmacSHA256(k, []byte(service))
	return hmacSHA256(k, []byte("aws4_request"))
}

// s3CanonicalQuery 查询串规范化：键值按 AWS 规则再编码后排序
func s3CanonicalQuery(q url.Values) string {
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var parts []string
	for _, k := range keys {
		vals := q[k]
		sort.Strings(vals)
		for _, v := range vals {
			parts = append(parts, awsEscape(k)+"="+awsEscape(v))
		}
	}
	return strings.Join(parts, "&")
}

// S3Serve S3 网关入口（挂在 /s3 与 /s3/*，自带 SigV4 鉴权，不走 JWT）
func (h *SiteHandler) S3Serve(c *gin.Context) {
	if GetSiteSettings()["s3_enabled"] != "true" {
		c.String(http.StatusForbidden, "S3 网关未启用（管理后台 → 站点设置）")
		return
	}
	auth := c.GetHeader("Authorization")
	if !strings.HasPrefix(auth, "AWS4-HMAC-SHA256") {
		c.String(http.StatusForbidden, "此端点要求 AWS SigV4 签名（S3 客户端），凭据在 设置 → 账号 → S3 网关 创建")
		return
	}
	// Authorization: AWS4-HMAC-SHA256 Credential=AK/scope, SignedHeaders=a;b, Signature=hex
	var cred, signedHeadersList, signature string
	for _, part := range strings.Split(strings.TrimPrefix(auth, "AWS4-HMAC-SHA256"), ",") {
		part = strings.TrimSpace(part)
		if v, ok := strings.CutPrefix(part, "Credential="); ok {
			cred = v
		} else if v, ok := strings.CutPrefix(part, "SignedHeaders="); ok {
			signedHeadersList = v
		} else if v, ok := strings.CutPrefix(part, "Signature="); ok {
			signature = v
		}
	}
	slash := strings.Split(cred, "/") // AK/date/region/service/aws4_request
	if len(slash) != 5 || slash[4] != "aws4_request" || signature == "" || signedHeadersList == "" {
		c.String(http.StatusForbidden, "签名请求格式错误")
		return
	}
	accessKey := slash[0]
	var u model.User
	if err := model.DB.Where("s3_key = ? AND disabled = false", accessKey).First(&u).Error; err != nil {
		log.Printf("[S3] 未知 access key %q from %s", accessKey, c.ClientIP())
		c.String(http.StatusForbidden, "S3 凭据无效")
		return
	}
	secret := openSecret(u.S3Secret)
	if secret == "" {
		log.Printf("[S3] 用户 %s 的 S3 secret 解密失败（密钥轮换？）", u.Username)
		c.String(http.StatusForbidden, "S3 凭据无效")
		return
	}
	// 只读凭据挡写（GET/HEAD/OPTIONS 之外全部 403）
	switch c.Request.Method {
	case "GET", "HEAD", "OPTIONS":
	default:
		if u.S3Scope == "ro" {
			c.String(http.StatusForbidden, "该 S3 凭据为只读")
			return
		}
	}
	amzDate := c.GetHeader("X-Amz-Date")
	if amzDate == "" {
		amzDate = c.GetHeader("Date")
	}
	t, err := time.Parse("20060102T150405Z", amzDate)
	if err != nil {
		if t, err = http.ParseTime(amzDate); err != nil {
			c.String(http.StatusForbidden, "缺少 X-Amz-Date")
			return
		}
	}
	if time.Since(t) > s3TimeSkew || time.Until(t) > s3TimeSkew {
		c.String(http.StatusForbidden, "请求时间偏差过大（检查客户端时钟）")
		return
	}

	signedHeaders := strings.Split(signedHeadersList, ";")
	var ch strings.Builder
	for _, name := range signedHeaders {
		var joined string
		if strings.EqualFold(name, "host") {
			joined = c.Request.Host // net/http 不把 Host 放进 Header
		} else {
			vals := c.Request.Header.Values(name)
			parts := make([]string, 0, len(vals))
			for _, v := range vals {
				parts = append(parts, strings.TrimSpace(v))
			}
			joined = strings.Join(parts, ",")
		}
		ch.WriteString(strings.ToLower(name) + ":" + joined + "\n")
	}
	payloadHash := c.GetHeader("X-Amz-Content-Sha256")
	if payloadHash == "" {
		payloadHash = hex.EncodeToString(sha256.New().Sum(nil))
	}
	canonical := c.Request.Method + "\n" +
		c.Request.URL.EscapedPath() + "\n" +
		s3CanonicalQuery(c.Request.URL.Query()) + "\n" +
		ch.String() + "\n" + signedHeadersList + "\n" + payloadHash
	crHash := sha256.Sum256([]byte(canonical))
	stringToSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + strings.Join(slash[1:], "/") + "\n" + hex.EncodeToString(crHash[:])
	want := hex.EncodeToString(hmacSHA256(s3SigningKey(secret, slash[1], slash[2], slash[3]), []byte(stringToSign)))
	if subtle.ConstantTimeCompare([]byte(want), []byte(signature)) != 1 {
		log.Printf("[S3] 签名不匹配 user=%s ip=%s（若刚轮换过密钥，请更新客户端配置）", u.Username, c.ClientIP())
		c.String(http.StatusForbidden, "签名校验失败")
		return
	}
	if u.Disabled {
		c.String(http.StatusForbidden, "账号已禁用")
		return
	}

	// 去掉 /s3 前缀交给 gofakes3（path-style：/bucket/key）
	r := c.Request.Clone(c.Request.Context())
	trimmed := strings.TrimPrefix(r.URL.Path, "/s3")
	if trimmed == "" || trimmed[0] != '/' {
		trimmed = "/" + trimmed
	}
	r.URL.Path = trimmed
	r.URL.RawPath = ""
	s3HandlerFor(&u, h.Fs).ServeHTTP(c.Writer, r)
}

// RegisterS3 挂到 gin（非 /api 前缀，自带 SigV4 鉴权，独立 IP 限流）
func RegisterS3(r *gin.Engine, h *SiteHandler) {
	limiter := middleware.NewIPRateLimiter(60, 20)
	s3 := func(c *gin.Context) {
		if !limiter.Allow(c.ClientIP()) {
			c.String(http.StatusTooManyRequests, "请求过于频繁，请稍后再试")
			return
		}
		h.S3Serve(c)
	}
	for _, m := range []string{"GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"} {
		r.Handle(m, "/s3/*rest", s3)
		r.Handle(m, "/s3", s3)
	}
}

// ---- 每用户 S3 凭据自助管理（设置 → 账号） ----

func s3RandStr(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return strings.TrimRight(base32.StdEncoding.EncodeToString(b), "=")
}

func (h *SiteHandler) S3Status(c *gin.Context) {
	u := middleware.CurrentUser(c)
	out := gin.H{"configured": u.S3Key != ""}
	if u.S3Key != "" {
		out["accessKey"] = u.S3Key
		out["scope"] = u.S3Scope
		out["createdAt"] = u.S3CreatedAt
	}
	dto.OK(c, out)
}

// S3Create/S3Reset 生成（或轮换）一组新密钥；明文 secret 只在响应里出现一次。
// 旧密钥立即失效（覆盖存储），并清掉该用户的 gofakes3 缓存不需要（密钥不缓存）。
func (h *SiteHandler) s3IssueNew(c *gin.Context, mustExist bool) {
	u := middleware.CurrentUser(c)
	if mustExist && u.S3Key == "" {
		dto.Fail(c, 400, "尚未创建 S3 凭据")
		return
	}
	var in struct {
		Scope string `json:"scope"`
	}
	_ = c.ShouldBindJSON(&in)
	scope := "rw"
	if in.Scope == "ro" {
		scope = "ro"
	}
	ak, sk := strings.ToUpper(s3RandStr(13))[:20], s3RandStr(30) // 13B→26 字符，取前 20（AWS AccessKeyId 惯例长度）
	if ak == "" || sk == "" {
		dto.Fail(c, 500, "生成凭据失败")
		return
	}
	now := time.Now()
	model.DB.Model(&model.User{}).Where("id = ?", u.ID).Updates(map[string]any{
		"s3_key": ak, "s3_secret": sealSecret(sk), "s3_scope": scope, "s3_created_at": &now,
	})
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "s3_key", Detail: "创建/轮换 S3 网关密钥（scope=" + scope + "）", IP: c.ClientIP()})
	dto.OK(c, gin.H{"accessKey": ak, "secret": sk, "scope": scope})
}

func (h *SiteHandler) S3Create(c *gin.Context)  { h.s3IssueNew(c, false) }
func (h *SiteHandler) S3Reset(c *gin.Context)   { h.s3IssueNew(c, true) }

func (h *SiteHandler) S3Delete(c *gin.Context) {
	u := middleware.CurrentUser(c)
	if u.S3Key == "" {
		dto.Fail(c, 400, "尚未创建 S3 凭据")
		return
	}
	model.DB.Model(&model.User{}).Where("id = ?", u.ID).Updates(map[string]any{
		"s3_key": "", "s3_secret": "", "s3_scope": "", "s3_created_at": nil,
	})
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "s3_key", Detail: "删除 S3 网关密钥", IP: c.ClientIP()})
	dto.OK(c, gin.H{})
}
