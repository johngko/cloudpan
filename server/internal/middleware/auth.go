package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"cloudpan/internal/config"
	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

type Claims struct {
	UID  uint   `json:"uid"`
	Role string `json:"role"`
	Ver  uint   `json:"ver"` // 用户令牌版本（User.TokenVer）：改密后旧令牌立即失效
	jwt.RegisteredClaims
}

func MakeToken(uid uint, role string, ver uint, secret []byte, ttl time.Duration) (string, error) {
	claims := Claims{UID: uid, Role: role, Ver: ver,
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

// Auth JWT 登录鉴权，并把 User 挂到上下文
// 支持两种令牌载体：Authorization 头（axios）与 ?t= 查询参数（img/video/a 标签直链）
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
		claims, err := ParseToken(strings.TrimPrefix(h, "Bearer "), secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.R{Code: 401, Msg: "登录已过期"})
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

func CurrentUser(c *gin.Context) *model.User {
	u, _ := c.Get("user")
	return u.(*model.User)
}

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		if CurrentUser(c).Role != "admin" {
			dto.Fail(c, 403, "需要管理员权限")
			c.Abort()
			return
		}
		c.Next()
	}
}

// GroupOf 返回用户所在用户组（带缓存兜底查询）
func GroupOf(c *gin.Context) *model.UserGroup {
	u := CurrentUser(c)
	var g model.UserGroup
	if err := model.DB.First(&g, u.GroupID).Error; err != nil {
		model.DB.Where("is_default = ?", true).First(&g)
	}
	return &g
}

// Audit 记录审计日志
func Audit(c *gin.Context, action, detail string) {
	u := CurrentUser(c)
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: action, Detail: detail, IP: c.ClientIP()})
}

var _ = config.Config{} // keep import alignment
