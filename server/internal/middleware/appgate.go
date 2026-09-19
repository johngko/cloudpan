package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

// UserOrNil 取当前登录用户；未登录/无 Auth 中间件（如公开分享链接）返回 nil
func UserOrNil(c *gin.Context) *model.User {
	if v, ok := c.Get("user"); ok && v != nil {
		if u, ok := v.(*model.User); ok {
			return u
		}
	}
	return nil
}

// AppGate 功能门控：全局停用、或当前用户（组/个人）无权限时返回 403
func AppGate(key string) gin.HandlerFunc {
	return func(c *gin.Context) {
		u := UserOrNil(c)
		if !model.AppAllowed(key, u) {
			msg := "该功能已被管理员停用"
			if model.AppEnabled(key) && u != nil && u.Role != "admin" {
				msg = "你的账号无权使用此功能"
			}
			c.AbortWithStatusJSON(http.StatusOK, dto.R{Code: 403, Msg: msg})
			return
		}
		c.Next()
	}
}

// AppGateAny 任一 key 对当前用户放行即通过（如离线下载 = HTTP 或 BT 任一开启）
func AppGateAny(keys ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		u := UserOrNil(c)
		for _, k := range keys {
			if model.AppAllowed(k, u) {
				c.Next()
				return
			}
		}
		msg := "该功能已被管理员停用"
		for _, k := range keys {
			if model.AppEnabled(k) {
				msg = "你的账号无权使用此功能"
				break
			}
		}
		c.AbortWithStatusJSON(http.StatusOK, dto.R{Code: 403, Msg: msg})
	}
}
