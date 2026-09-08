package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

// AppGate 站点级功能门控：功能被管理员停用时返回 403
func AppGate(key string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !model.AppEnabled(key) {
			c.AbortWithStatusJSON(http.StatusOK, dto.R{Code: 403, Msg: "该功能已被管理员停用"})
			return
		}
		c.Next()
	}
}

// AppGateAny 任一 key 启用即放行（如离线下载 = HTTP 或 BT 任一开启）
func AppGateAny(keys ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, k := range keys {
			if model.AppEnabled(k) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusOK, dto.R{Code: 403, Msg: "该功能已被管理员停用"})
	}
}
