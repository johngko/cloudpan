package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

type Claims struct {
	UID  uint   `json:"uid"`
	Role string `json:"role"`
	Ver  uint   `json:"ver"` // 用户令牌版本（User.TokenVer）：改密后旧令牌立即失效
	Kind string `json:"kind"`
	jwt.RegisteredClaims
}

// 令牌用途（Claims.Kind）：访问令牌只能用于访问受保护端点，刷新令牌只能用于
// /auth/refresh 续期。二者分离后，泄露的访问令牌无法再"续成"新的长期刷新令牌。
// 存量令牌无 kind 字段（解析为空），访问侧按访问令牌兼容处理，刷新侧一律拒绝
// （旧刷新令牌仅需重新登录一次）。
const (
	TokenKindAccess  = "access"
	TokenKindRefresh = "refresh"
)

func MakeToken(uid uint, role, kind string, ver uint, secret []byte, ttl time.Duration) (string, error) {
	claims := Claims{UID: uid, Role: role, Kind: kind, Ver: ver,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)), IssuedAt: jwt.NewNumericDate(time.Now())}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func ParseToken(tokenStr string, secret []byte) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) { return secret, nil })
	if err != nil {
		return nil, err
	}
	if claims, ok := t.Claims.(*Claims); ok && t.Valid {
		return claims, nil
	}
	return nil, jwt.ErrTokenInvalidClaims
}

// ---- API 令牌（cpt_ 前缀，见 model.ApiToken）----
// 长期第三方凭据：库内只存 SHA-256，鉴权时对呈现值做哈希比对；
// ro（只读）令牌在鉴权处直接拒绝非 GET/HEAD/OPTIONS（读端点全部是 GET，见 router）。
// 改密（TokenVer 自增）不影响 API 令牌——这是应用专用密码的通用语义（rclone 等
// 第三方工具无法跟随网页端改密轮转）；撤销走令牌管理页，禁用账号即刻生效。

var (
	apiTokenUseMu  sync.Mutex
	apiTokenUseAt  = map[uint]time.Time{} // LastUsedAt 写库节流（≥60s 一次），防每请求一行 UPDATE
)

// apiTokenAuth 校验 cpt_ 令牌；返回 (令牌, 用户, 错误码 0=通过)。
func apiTokenAuth(raw string) (*model.ApiToken, *model.User) {
	sum := sha256.Sum256([]byte(raw))
	var t model.ApiToken
	if model.DB.Where("key_hash = ?", hex.EncodeToString(sum[:])).First(&t).Error != nil {
		return nil, nil
	}
	if t.ExpiresAt != nil && time.Now().After(*t.ExpiresAt) {
		return nil, nil
	}
	var u model.User
	if model.DB.First(&u, t.UserID).Error != nil || u.Disabled {
		return nil, nil
	}
	apiTokenUseMu.Lock()
	if time.Since(apiTokenUseAt[t.ID]) > 60*time.Second {
		apiTokenUseAt[t.ID] = time.Now()
		now := time.Now()
		model.DB.Model(&model.ApiToken{}).Where("id = ?", t.ID).UpdateColumn("last_used_at", &now)
	}
	apiTokenUseMu.Unlock()
	return &t, &u
}

// Auth JWT 登录鉴权，并把 User 挂到上下文
// 支持三种载体：Authorization 头（axios）、?t= 查询参数（img/video/a 标签直链）、
// 以及 cpt_ 前缀的 API 令牌（同样支持上述两种载体）
func Auth(secret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			if t := c.Query("t"); t != "" {
				h = "Bearer " + t
			}
		}
		if !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "未登录"})
			return
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		// API 令牌分支（与 JWT 互斥，按前缀区分）
		if strings.HasPrefix(tokenStr, "cpt_") {
			t, u := apiTokenAuth(tokenStr)
			if t == nil || u == nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "API 令牌无效或已过期"})
				return
			}
			if t.Scopes == "ro" {
				switch c.Request.Method {
				case "GET", "HEAD", "OPTIONS":
				default:
					c.AbortWithStatusJSON(http.StatusForbidden, dto.R{Code: 403, Msg: "该 API 令牌为只读"})
					return
				}
			}
			c.Set("user", u)
			c.Set("apiToken", t)
			c.Next()
			return
		}
		claims, err := ParseToken(tokenStr, secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "登录已过期"})
			return
		}
		// 刷新令牌不得当作访问令牌使用（只能在 /auth/refresh 续期）；空 kind = 存量访问令牌，兼容放行
		if claims.Kind == TokenKindRefresh {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "令牌类型错误"})
			return
		}
		var user model.User
		if err := model.DB.First(&user, claims.UID).Error; err != nil || user.Disabled {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "账号不可用"})
			return
		}
		// 令牌版本比对：改密/重置密码后旧令牌作废（存量令牌无 ver 字段解析为 0，与默认 TokenVer 一致）
		if user.TokenVer != claims.Ver {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "登录状态已失效，请重新登录"})
			return
		}
		c.Set("user", &user)
		c.Next()
	}
}

// CurrentUser 返回上下文中的登录用户；未经过 Auth（或 Auth 未挂载用户）时返回 nil。
// 调用方必须判空——直接类型断言会在公开路由误用时 panic 成 500。
func CurrentUser(c *gin.Context) *model.User {
	u, ok := c.Get("user")
	if !ok || u == nil {
		return nil
	}
	user, _ := u.(*model.User)
	return user
}

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "未登录"})
			return
		}
		if u.Role != "admin" {
			dto.Fail(c, 403, "需要管理员权限")
			c.Abort()
			return
		}
		c.Next()
	}
}

// 用户组缓存：GroupOf 在几乎每个端点都要调用，原先每请求一次 DB 查询。
// key=GroupID；哨兵键 0 表示"默认组"（组 ID 自增从 1 开始，0 不会被占用）。
var (
	groupCacheMu sync.RWMutex
	groupCache   = map[uint]groupCacheEntry{}
)

type groupCacheEntry struct {
	g  model.UserGroup
	at time.Time
}

const groupCacheTTL = 30 * time.Second

func groupByID(id uint) (model.UserGroup, bool) {
	groupCacheMu.RLock()
	e, ok := groupCache[id]
	groupCacheMu.RUnlock()
	if ok && time.Since(e.at) < groupCacheTTL {
		return e.g, true
	}
	var g model.UserGroup
	if err := model.DB.First(&g, id).Error; err != nil {
		return g, false
	}
	groupCacheMu.Lock()
	groupCache[id] = groupCacheEntry{g: g, at: time.Now()}
	groupCacheMu.Unlock()
	return g, true
}

func defaultGroup() (model.UserGroup, bool) {
	groupCacheMu.RLock()
	e, ok := groupCache[0]
	groupCacheMu.RUnlock()
	if ok && time.Since(e.at) < groupCacheTTL {
		return e.g, true
	}
	var g model.UserGroup
	if err := model.DB.Where("is_default = ?", true).First(&g).Error; err != nil {
		return g, false
	}
	groupCacheMu.Lock()
	groupCache[0] = groupCacheEntry{g: g, at: time.Now()}
	groupCacheMu.Unlock()
	return g, true
}

// InvalidateGroupCache 用户组增删改后调用，避免最长 30s 的权限陈旧窗口
func InvalidateGroupCache() {
	groupCacheMu.Lock()
	groupCache = map[uint]groupCacheEntry{}
	groupCacheMu.Unlock()
}

// GroupOf 返回用户所在用户组（用户缺失或组记录不存在时回落到默认组，保证返回值非 nil）
func GroupOf(c *gin.Context) *model.UserGroup {
	u := CurrentUser(c)
	if u != nil {
		if g, ok := groupByID(u.GroupID); ok {
			return &g
		}
	}
	if g, ok := defaultGroup(); ok {
		return &g
	}
	return &model.UserGroup{}
}

// Audit 记录审计日志；用户缺失时静默跳过（审计不应成为请求链路的新崩溃点）
func Audit(c *gin.Context, action, detail string) {
	u := CurrentUser(c)
	if u == nil {
		return
	}
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: action, Detail: detail, IP: c.ClientIP()})
}
