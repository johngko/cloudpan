package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// ---- API 令牌（应用专用凭据，见 model.ApiToken）----
// 明文只在创建时返回一次；库内仅存 SHA-256。凭据格式 cpt_ + 32 hex。
// 鉴权入口在 middleware.Auth（Bearer 头与 ?t= 均可携带）；ro 令牌拒绝非 GET。
// 每用户最多 20 条；游客账号（guest 写白名单外）由 GuestReadOnly 中间件挡住创建/撤销。

const maxTokensPerUser = 20

type TokenHandler struct{}

// tokenPrefixOf 展示用前缀（可辨识、不足以还原凭据）
func tokenPrefixOf(raw string) string {
	if len(raw) < 10 {
		return raw
	}
	return raw[:10] + "…"
}

func (h *TokenHandler) List(c *gin.Context) {
	x := ctxOf(c)
	var rows []model.ApiToken
	model.DB.Where("user_id = ?", x.user.ID).Order("id DESC").Find(&rows)
	dto.OK(c, rows)
}

// Create 签发新令牌；响应里的 token 字段 = 明文，仅此一次
func (h *TokenHandler) Create(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		Name       string `json:"name"`
		Scopes     string `json:"scopes"`     // rw | ro
		ExpireDays int    `json:"expireDays"` // 0 = 永不过期；上限 3650 天
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	name := in.Name
	if len([]rune(name)) < 1 || len([]rune(name)) > 40 {
		dto.Fail(c, 400, "令牌名称需 1-40 位")
		return
	}
	if in.Scopes != "rw" && in.Scopes != "ro" {
		in.Scopes = "rw"
	}
	if in.ExpireDays < 0 || in.ExpireDays > 3650 {
		dto.Fail(c, 400, "有效期需 0-3650 天（0 = 永久）")
		return
	}
	var n int64
	model.DB.Model(&model.ApiToken{}).Where("user_id = ?", x.user.ID).Count(&n)
	if n >= maxTokensPerUser {
		dto.Fail(c, 400, fmt.Sprintf("API 令牌数量已达上限（%d）", maxTokensPerUser))
		return
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		dto.Fail(c, 500, "生成失败")
		return
	}
	raw := "cpt_" + hex.EncodeToString(buf)
	sum := sha256.Sum256([]byte(raw))
	t := model.ApiToken{
		UserID:  x.user.ID,
		Name:    name,
		KeyHash: hex.EncodeToString(sum[:]),
		Prefix:  tokenPrefixOf(raw),
		Scopes:  in.Scopes,
	}
	if in.ExpireDays > 0 {
		e := time.Now().AddDate(0, 0, in.ExpireDays)
		t.ExpiresAt = &e
	}
	if err := model.DB.Create(&t).Error; err != nil {
		dto.Fail(c, 500, "创建失败")
		return
	}
	middleware.Audit(c, "api_token_create", fmt.Sprintf("创建 API 令牌 %s（%s）", name, in.Scopes))
	dto.OK(c, gin.H{"id": t.ID, "token": raw})
}

// Delete 撤销令牌（按 ID 且必须属主）
func (h *TokenHandler) Delete(c *gin.Context) {
	x := ctxOf(c)
	var t model.ApiToken
	if model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).First(&t).Error != nil {
		dto.Fail(c, 404, "令牌不存在")
		return
	}
	model.DB.Delete(&t)
	middleware.Audit(c, "api_token_delete", fmt.Sprintf("撤销 API 令牌 %s", t.Name))
	dto.OK(c, nil)
}
