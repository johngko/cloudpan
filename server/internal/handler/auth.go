package handler

import (
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

type AuthHandler struct{ Secret []byte }

// issueTokens 签发「访问令牌 + 刷新令牌」对：
// 访问 7 天（游客 24h），刷新 30 天（游客 7 天）。二者共用同一 Claims 结构
// 与 TokenVer 版本化——改密后旧刷新令牌同样失效，无额外安全面。
func (h *AuthHandler) issueTokens(u *model.User) (string, string, error) {
	ttl, refresh := 7*24*time.Hour, 30*24*time.Hour
	if model.IsGuestUser(u) {
		ttl, refresh = 24*time.Hour, 7*24*time.Hour
	}
	token, err := middleware.MakeToken(u.ID, u.Role, middleware.TokenKindAccess, u.TokenVer, h.Secret, ttl)
	if err != nil {
		return "", "", err
	}
	rt, err := middleware.MakeToken(u.ID, u.Role, middleware.TokenKindRefresh, u.TokenVer, h.Secret, refresh)
	return token, rt, err
}

// 登录防爆破：同 IP+用户名 15 分钟内失败 5 次即锁定
var loginFails sync.Map // key -> *failInfo

type failInfo struct {
	count int
	until time.Time
}

// dummyPasswordHash 用于抹平"用户不存在/账号禁用"与"密码错误"两条返回路径的
// bcrypt 耗时差（前者若直接返回会比后者快 ~50ms，可被按响应时长枚举用户名）。
// 进程启动时生成一次；比较结果恒被丢弃。
var dummyPasswordHash = func() string {
	b, _ := bcrypt.GenerateFromPassword([]byte("cloudpan-timing-equalizer"), bcrypt.DefaultCost)
	return string(b)
}()

// dummyCompare 在"用户不存在/禁用"路径上执行一次等价耗时的 bcrypt 比较，抹平时序侧信道
func dummyCompare(pwd string) {
	_ = bcrypt.CompareHashAndPassword([]byte(dummyPasswordHash), []byte(pwd))
}

func loginLocked(key string) bool {
	if v, ok := loginFails.Load(key); ok {
		f := v.(*failInfo)
		if time.Now().Before(f.until) {
			return true
		}
		if !f.until.IsZero() {
			loginFails.Delete(key) // 仅清除已过期的锁，保留计数中的条目
		}
	}
	return false
}

func loginFail(key string) {
	var f *failInfo
	if v, ok := loginFails.Load(key); ok {
		f = v.(*failInfo)
	} else {
		f = &failInfo{}
		loginFails.Store(key, f)
	}
	f.count++
	if f.count >= 5 {
		f.until = time.Now().Add(15 * time.Minute)
		f.count = 0
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var in struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	// 锁定键规范化：用户名大小写不敏感（MySQL utf8mb4_unicode_ci 下 admin/Admin 命中同一账号），
	// 若直接用原始输入，轮换大小写变体即可为每个变体建独立计数桶、绕过 5 次锁定。
	// 先查库、命中后用规范用户名；未命中时用 lowercase(trim) 兜底。
	preKey := c.ClientIP() + "|" + strings.ToLower(strings.TrimSpace(in.Username))
	if loginLocked(preKey) {
		dto.Fail(c, 4291, "失败次数过多，账号已临时锁定，请 15 分钟后再试")
		return
	}
	var u model.User
	if err := model.DB.Where("username = ?", in.Username).First(&u).Error; err != nil {
		dummyCompare(in.Password) // 抹平与密码错误路径的耗时差，防时序枚举
		loginFail(preKey)
		dto.Fail(c, 4001, "用户名或密码错误")
		return
	}
	lockKey := c.ClientIP() + "|" + strings.ToLower(u.Username)
	if loginLocked(lockKey) {
		dto.Fail(c, 4291, "失败次数过多，账号已临时锁定，请 15 分钟后再试")
		return
	}
	// 枚举防护：账号禁用与密码错误返回完全一致的提示，避免借响应差异枚举有效用户名
	if u.Disabled {
		dummyCompare(in.Password)
		dto.Fail(c, 4001, "用户名或密码错误")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) != nil {
		loginFail(lockKey)
		dto.Fail(c, 4001, "用户名或密码错误")
		return
	}
	loginFails.Delete(lockKey)
	loginFails.Delete(preKey)
	now := time.Now()
	model.DB.Model(&u).UpdateColumn("last_login_at", &now)
	token, rt, err := h.issueTokens(&u)
	if err != nil {
		dto.Fail(c, 500, "签发令牌失败")
		return
	}
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "login", Detail: "用户登录", IP: c.ClientIP()})
	dto.OK(c, gin.H{"token": token, "refreshToken": rt, "user": u, "isGuest": model.IsGuestUser(&u)})
}

// Refresh 刷新令牌静默续期（TabOS /auth/refresh 同款模式）：
// 前端收到 401 时用刷新令牌换新令牌对并重试原请求，用户无感知。
// 刷新令牌 = 更长有效期的同构 JWT（TokenVer 版本化，改密即失效），IP 限流防刷。
func (h *AuthHandler) Refresh(c *gin.Context) {
	var in struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	claims, err := middleware.ParseToken(in.RefreshToken, h.Secret)
	if err != nil {
		dto.Fail(c, 401, "刷新令牌无效或已过期，请重新登录")
		return
	}
	// 只接受刷新令牌：访问令牌不得续期成新的长期刷新令牌（泄露的访问令牌不能无限延长会话）
	if claims.Kind != middleware.TokenKindRefresh {
		dto.Fail(c, 401, "刷新令牌无效或已过期，请重新登录")
		return
	}
	var u model.User
	if err := model.DB.First(&u, claims.UID).Error; err != nil || u.Disabled || u.TokenVer != claims.Ver {
		dto.Fail(c, 401, "登录状态已失效，请重新登录")
		return
	}
	token, rt, err := h.issueTokens(&u)
	if err != nil {
		dto.Fail(c, 500, "签发令牌失败")
		return
	}
	dto.OK(c, gin.H{"token": token, "refreshToken": rt, "user": u, "isGuest": model.IsGuestUser(&u)})
}

// GuestLogin 游客登录：登录页「游客登录」入口。
// 无需凭据，直接为共享游客账号（guest，访客组）签发短时效令牌（24h）。
// 前置：站点开关 guest_login 非 "false"（默认开）且游客账号存在且未被禁用。
func (h *AuthHandler) GuestLogin(c *gin.Context) {
	s := GetSiteSettings()
	if s["guest_login"] == "false" {
		dto.Fail(c, 403, "游客登录未开启")
		return
	}
	var u model.User
	if err := model.DB.Where("username = ?", model.GuestUsername).First(&u).Error; err != nil || u.Disabled {
		dto.Fail(c, 403, "游客登录未开启")
		return
	}
	now := time.Now()
	model.DB.Model(&u).UpdateColumn("last_login_at", &now)
	token, rt, err := h.issueTokens(&u)
	if err != nil {
		dto.Fail(c, 500, "签发令牌失败")
		return
	}
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "guest-login", Detail: "游客登录", IP: c.ClientIP()})
	dto.OK(c, gin.H{"token": token, "refreshToken": rt, "user": u, "isGuest": true})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var in struct {
		Username   string `json:"username" binding:"required,min=2,max=32"`
		Password   string `json:"password" binding:"required,min=6,max=64"`
		Nickname   string `json:"nickname"`
		InviteCode string `json:"inviteCode"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误：用户名 2-32 位，密码至少 6 位")
		return
	}
	if msg := validNewUsername(in.Username); msg != "" {
		dto.Fail(c, 400, msg)
		return
	}
	settings := GetSiteSettings()
	if settings["register_open"] != "true" {
		dto.Fail(c, 4003, "本站未开放注册")
		return
	}
	if code := settings["register_invite_code"]; code != "" && code != in.InviteCode {
		dto.Fail(c, 4004, "邀请码错误")
		return
	}
	var n int64
	model.DB.Model(&model.User{}).Where("username = ?", in.Username).Count(&n)
	if n > 0 {
		dto.Fail(c, 4005, "用户名已存在")
		return
	}
	var g model.UserGroup
	if err := model.DB.Where("is_default = ?", true).First(&g).Error; err != nil {
		dto.Fail(c, 500, "默认用户组缺失")
		return
	}
	nickname := in.Nickname
	if nickname == "" {
		nickname = in.Username
	}
	u := model.User{Username: in.Username, PasswordHash: hashPassword(in.Password), Nickname: nickname, Role: "user", GroupID: g.ID}
	if err := model.DB.Create(&u).Error; err != nil {
		dto.Fail(c, 500, "注册失败")
		return
	}
	token, rt, _ := h.issueTokens(&u)
	dto.OK(c, gin.H{"token": token, "refreshToken": rt, "user": u, "isGuest": false})
}

func (h *AuthHandler) Me(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var g model.UserGroup
	model.DB.First(&g, u.GroupID)
	// isGuest：前端据此隐藏账号自管理入口（改密/改昵称/WebDAV 密码等）；
	// 后端兜底拦截见 middleware.GuestReadOnly
	dto.OK(c, gin.H{"user": u, "group": g, "isGuest": model.IsGuestUser(u)})
}

func (h *AuthHandler) UpdateMe(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var in struct {
		Nickname *string `json:"nickname"`
		Avatar   *int    `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	up := map[string]interface{}{}
	if in.Nickname != nil {
		up["nickname"] = strings.TrimSpace(*in.Nickname)
	}
	if in.Avatar != nil {
		up["avatar"] = *in.Avatar
	}
	if len(up) > 0 {
		model.DB.Model(u).Updates(up)
	}
	dto.OK(c, u)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var in struct {
		Old string `json:"old" binding:"required"`
		New string `json:"new" binding:"required,min=6,max=64"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误：新密码至少 6 位")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Old)) != nil {
		dto.Fail(c, 4006, "原密码错误")
		return
	}
	// 令牌版本自增：改密后该用户其余会话的旧 JWT 立即失效
	model.DB.Model(u).Updates(map[string]interface{}{
		"password_hash": hashPassword(in.New),
		"token_ver":     u.TokenVer + 1,
	})
	middleware.Audit(c, "password", "修改登录密码")
	dto.OK(c, nil)
}

// SetWebdavPassword 设置/重置 WebDAV 独立密码
func (h *AuthHandler) SetWebdavPassword(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var in struct {
		Password string `json:"password" binding:"required,min=6,max=64"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误：密码至少 6 位")
		return
	}
	model.DB.Model(u).UpdateColumn("webdav_password_hash", hashPassword(in.Password))
	dto.OK(c, nil)
}

func hashPassword(pwd string) string {
	b, _ := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	return string(b)
}

// validNewUsername 新建账号（注册 / 管理员创建）的用户名约束，返回空串表示合法：
// 禁首尾空白、禁空白与控制字符（防 " admin"、"ad\nmin" 之类仅靠排序规则侥幸区分的名字），
// 禁系统托管账号名 guest（IsGuestUser 按用户名精确匹配，必须杜绝任何同名变体被创建）。
// 允许非 ASCII（如中文用户名），只做安全相关的收紧。
func validNewUsername(name string) string {
	if name == "" {
		return "用户名不能为空"
	}
	if name != strings.TrimSpace(name) {
		return "用户名首尾不能含空白"
	}
	if n := len([]rune(name)); n < 2 || n > 32 {
		return "用户名长度需 2-32 位"
	}
	for _, r := range name {
		if r < 0x21 || r == 0x7f || unicode.IsSpace(r) {
			return "用户名不能包含空白或控制字符"
		}
	}
	if strings.EqualFold(name, model.GuestUsername) {
		return "该用户名为系统保留"
	}
	return ""
}

// MyLogs 当前用户自己的操作记录（只读）。
// 用途：设置页「操作记录」——把审计日志的可见范围开放到本人，
// 严格按 user_id 过滤，任何情况下都不返回他人记录（管理员查全量走 /api/admin/logs）。
func (h *AuthHandler) MyLogs(c *gin.Context) {
	u := middleware.CurrentUser(c)
	if u == nil {
		dto.Fail(c, 401, "未登录")
		return
	}
	var in dto.PageIn
	_ = c.ShouldBindQuery(&in)
	offset, limit := in.Normalize()
	q := model.DB.Model(&model.AuditLog{}).Where("user_id = ?", u.ID)
	if in.Keyword != "" {
		q = q.Where("action LIKE ? OR detail LIKE ?", "%"+in.Keyword+"%", "%"+in.Keyword+"%")
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		dto.Fail(c, 500, "查询失败")
		return
	}
	var items []model.AuditLog
	if err := q.Order("id DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		dto.Fail(c, 500, "查询失败")
		return
	}
	dto.OK(c, dto.PageOut{Total: total, Items: items})
}
