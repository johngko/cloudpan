package dto

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// R 统一响应：{code, msg, data}，code=0 成功
type R struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, R{Code: 0, Msg: "ok", Data: data})
}

func Fail(c *gin.Context, code int, msg string) {
	c.JSON(http.StatusOK, R{Code: code, Msg: msg})
}

func FailHTTP(c *gin.Context, httpCode int, msg string) {
	c.JSON(httpCode, R{Code: -1, Msg: msg})
}

// PageIn 通用分页入参
type PageIn struct {
	Page    int    `form:"page"`
	Size    int    `form:"size"`
	Keyword string `form:"keyword"`
}

func (p *PageIn) Normalize() (offset, limit int) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Size < 1 || p.Size > 200 {
		p.Size = 20
	}
	return (p.Page - 1) * p.Size, p.Size
}

// PageOut 通用分页出参
type PageOut struct {
	Total int64       `json:"total"`
	Items interface{} `json:"items"`
}
