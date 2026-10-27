package handler

// A3 两步验证（TOTP + 恢复码），pquerna/otp 纯 Go：
// - 绑定流程：setup 生成 otpauth URI（密封落库但未启用）→ 用户用手机扫码后
//   带当前验证码调 enable → 启用 + 生成一次性恢复码（只展示一次）+ TokenVer 自增
//   踢掉全部旧会话（重签发当前会话令牌随响应返回）。
// - 登录：口令通过后若已启用 TOTP，需再带 6 位验证码（或一次性恢复码）。
// - 管理员强制：站点设置 totp_enforce=true 后，未绑定用户的全部写接口返回 428
//   （见 enforceTotpWrite），自助绑定路由不受限。
// - Passkey 登录不走 TOTP（WebAuthn 本身即强因素，叠加反而逼用户降级用口令登录）。

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"encoding/json"
	"image/png"
	"log"
	"strings"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// totpGetKey 从密封存储解析出 TOTP Key（存的是完整 otpauth URI，保证二维码/手输 secret 与 issuer 一致）
func totpGetKey(u *model.User) (*otp.Key, bool) {
	uri := openSecret(u.TOTPSeed)
	if uri == "" {
		return nil, false
	}
	key, err := otp.NewKeyFromURL(uri)
	if err != nil || key.Secret() == "" {
		log.Printf("[totp] 用户 %s 的 TOTPSeed 无法解析（密钥轮换或数据损坏）", u.Username)
		return nil, false
	}
	return key, true
}

// totpVerify 校验验证码：先 TOTP（±1 个周期窗口），再匹配未消费的恢复码（命中即删）。
// 输入归一化：去掉空格/连字符，恢复码哈希按大写 base32 原文计算。
func totpVerify(u *model.User, code string) bool {
	code = strings.NewReplacer(" ", "", "-", "", "\t", "").Replace(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	if key, ok := totpGetKey(u); ok {
		// 窗口放宽 ±30s：容忍客户端与服务端的轻微时钟漂移
		now := time.Now()
		for _, delta := range []int{-30, 0, 30} {
			if ok, _ := totp.ValidateCustom(code, key.Secret(), now.Add(time.Duration(delta)*time.Second), totp.ValidateOpts{Period: 30, Skew: 0, Digits: otp.DigitsSix, Algorithm: otp.AlgorithmSHA1}); ok {
				return true
			}
		}
	}
	if u.TOTPRecovery != "" {
		var hashes []string
		_ = json.Unmarshal([]byte(u.TOTPRecovery), &hashes)
		sum := sha256.Sum256([]byte(code))
		h := hex.EncodeToString(sum[:])
		for i, hh := range hashes {
			if hh == h {
				hashes = append(hashes[:i], hashes[i+1:]...)
				b, _ := json.Marshal(hashes)
				model.DB.Model(&model.User{}).Where("id = ?", u.ID).UpdateColumn("totp_recovery", string(b))
				model.DB.Model(u).UpdateColumn("totp_recovery", string(b))
				return true
			}
		}
	}
	return false
}

// genRecoveryCodes 生成 10 个一次性恢复码：10 字节随机 → 16 位 base32（8+8 分组展示）。
// 返回展示码与待存哈希。
func genRecoveryCodes() (shown []string, hashes []string) {
	for i := 0; i < 10; i++ {
		buf := make([]byte, 10)
		if _, err := rand.Read(buf); err != nil {
			return nil, nil
		}
		raw := strings.TrimRight(base32.StdEncoding.EncodeToString(buf), "=") // 恰 16 字符
		sum := sha256.Sum256([]byte(raw))
		hashes = append(hashes, hex.EncodeToString(sum[:]))
		shown = append(shown, raw[:8]+"-"+raw[8:])
	}
	return
}

func (h *AuthHandler) TotpStatus(c *gin.Context) {
	u := middleware.CurrentUser(c)
	dto.OK(c, gin.H{"enabled": u.TOTPEnabled, "seedPending": u.TOTPSeed != ""})
}

// TotpSetup 生成（或重新生成）待启用密钥；已启用需先关闭，防止旧设备无声失效
func (h *AuthHandler) TotpSetup(c *gin.Context) {
	u := middleware.CurrentUser(c)
	if u.TOTPEnabled {
		dto.Fail(c, 400, "两步验证已启用，请先关闭后再重新绑定")
		return
	}
	s := GetSiteSettings()
	issuer := s["site_name"]
	if issuer == "" {
		issuer = "CloudPan"
	}
	key, err := totp.Generate(totp.GenerateOpts{Issuer: issuer, AccountName: u.Username})
	if err != nil {
		dto.Fail(c, 500, "生成密钥失败")
		return
	}
	model.DB.Model(&model.User{}).Where("id = ?", u.ID).UpdateColumn("totp_seed", sealSecret(key.URL()))
	u.TOTPSeed = sealSecret(key.URL())
	dto.OK(c, gin.H{"otpauth": key.URL(), "secret": key.Secret()})
}

// TotpQrcode 待绑定密钥的二维码 PNG（仅未启用且有待存密钥时可得；URI 里已含 issuer/账号，
// 认证器扫出的条目与手工录入一致）
func (h *AuthHandler) TotpQrcode(c *gin.Context) {
	u := middleware.CurrentUser(c)
	if u.TOTPEnabled || u.TOTPSeed == "" {
		dto.Fail(c, 400, "当前没有待绑定的两步验证密钥")
		return
	}
	key, ok := totpGetKey(u)
	if !ok {
		dto.Fail(c, 500, "密钥解析失败")
		return
	}
	img, err := key.Image(240, 240)
	if err != nil {
		dto.Fail(c, 500, "生成二维码失败")
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Status(200)
	_ = png.Encode(c.Writer, img)
}

// TotpEnable 校验验证码并启用；成功后一次性返回恢复码，并 bump TokenVer 踢旧会话
func (h *AuthHandler) TotpEnable(c *gin.Context) {
	var in struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	u := middleware.CurrentUser(c)
	if u.TOTPEnabled {
		dto.Fail(c, 400, "两步验证已启用")
		return
	}
	if u.TOTPSeed == "" {
		dto.Fail(c, 400, "请先生成密钥")
		return
	}
	key, ok := totpGetKey(u)
	if !ok {
		dto.Fail(c, 400, "密钥无效，请重新生成")
		return
	}
	if !totp.Validate(in.Code, key.Secret()) {
		dto.Fail(c, 400, "验证码不正确")
		return
	}
	shown, hashes := genRecoveryCodes()
	if shown == nil {
		dto.Fail(c, 500, "生成恢复码失败")
		return
	}
	hb, _ := json.Marshal(hashes)
	// TokenVer 自增踢掉全部旧会话（开启 2FA 视为安全状态变更）；当前会话换新令牌随响应回传
	model.DB.Model(&model.User{}).Where("id = ?", u.ID).Updates(map[string]any{
		"totp_enabled": true, "totp_recovery": string(hb), "token_ver": u.TokenVer + 1,
	})
	u.TokenVer++
	token, rt, err := h.issueTokens(u)
	if err != nil {
		dto.Fail(c, 500, "签发令牌失败")
		return
	}
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "totp_enable", Detail: "开启两步验证", IP: c.ClientIP()})
	dto.OK(c, gin.H{"recoveryCodes": shown, "token": token, "refreshToken": rt})
}

// TotpDisable 关闭：需当前验证码或恢复码（防会话被盗后一键摘掉 2FA）
func (h *AuthHandler) TotpDisable(c *gin.Context) {
	var in struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	u := middleware.CurrentUser(c)
	if !u.TOTPEnabled {
		dto.Fail(c, 400, "两步验证未启用")
		return
	}
	if !totpVerify(u, in.Code) {
		dto.Fail(c, 400, "验证码不正确")
		return
	}
	model.DB.Model(&model.User{}).Where("id = ?", u.ID).Updates(map[string]any{
		"totp_enabled": false, "totp_seed": "", "totp_recovery": "",
	})
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "totp_disable", Detail: "关闭两步验证", IP: c.ClientIP()})
	dto.OK(c, gin.H{})
}

// TotpRegen 重新签发恢复码（需当前验证码；旧码全部作废）
func (h *AuthHandler) TotpRegen(c *gin.Context) {
	var in struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	u := middleware.CurrentUser(c)
	if !u.TOTPEnabled {
		dto.Fail(c, 400, "两步验证未启用")
		return
	}
	if !totpVerify(u, in.Code) {
		dto.Fail(c, 400, "验证码不正确")
		return
	}
	shown, hashes := genRecoveryCodes()
	hb, _ := json.Marshal(hashes)
	model.DB.Model(&model.User{}).Where("id = ?", u.ID).UpdateColumn("totp_recovery", string(hb))
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "totp_regen", Detail: "重新生成恢复码", IP: c.ClientIP()})
	dto.OK(c, gin.H{"recoveryCodes": shown})
}

// enforceTotpWrite 站点强制两步验证（totp_enforce）：已登录但未绑定的用户，
// 全部写操作返回 428；自助绑定路由与只读放行。游客是系统托管账号（无口令、
// 无法绑定）不适用；Passkey 不影响（登录即强因素）。
func enforceTotpWrite(c *gin.Context) {
	switch c.Request.Method {
	case "GET", "HEAD", "OPTIONS":
		c.Next()
		return
	}
	if GetSiteSettings()["totp_enforce"] != "true" {
		c.Next()
		return
	}
	u := middleware.CurrentUser(c)
	if u == nil || u.TOTPEnabled || model.IsGuestUser(u) {
		c.Next()
		return
	}
	p := c.Request.URL.Path
	if strings.HasPrefix(p, "/api/me/totp") || strings.HasPrefix(p, "/api/users/me") || strings.HasPrefix(p, "/api/auth/") {
		c.Next()
		return
	}
	dto.FailHTTP(c, 428, "本站已强制两步验证：请到 设置 → 账号 绑定两步验证（TOTP）后再操作")
	c.Abort() // 必须终止链：只写响应不 Abort，后续 handler 会继续执行并二次写 body
}
