package handler

import (
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

type AuthHandler struct{ Secret []byte }

// 登录防爆破：同 IP+用户名 15 分钟内失败 5 次即锁定
var loginFails sync.Map // key -> *failInfo

type failInfo struct {
	count int
	until time.Time
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
	lockKey := c.ClientIP() + "|" + in.Username
	if loginLocked(lockKey) {
		dto.Fail(c, 4291, "失败次数过多，账号已临时锁定，请 15 分钟后再试")
		return
	}
	var u model.User
	if err := model.DB.Where("username = ?", in.Username).First(&u).Error; err != nil {
		loginFail(lockKey)
		dto.Fail(c, 4001, "用户名或密码错误")
		return
	}
	if u.Disabled {
		dto.Fail(c, 4002, "账号已被禁用")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) != nil {
		loginFail(lockKey)
		dto.Fail(c, 4001, "用户名或密码错误")
		return
	}
	loginFails.Delete(lockKey)
	now := time.Now()
	model.DB.Model(&u).UpdateColumn("last_login_at", &now)
	token, err := middleware.MakeToken(u.ID, u.Role, h.Secret, 7*24*time.Hour)
	if err != nil {
		dto.Fail(c, 500, "签发令牌失败")
		return
	}
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "login", Detail: "用户登录", IP: c.ClientIP()})
	dto.OK(c, gin.H{"token": token, "user": u})
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
	token, _ := middleware.MakeToken(u.ID, u.Role, h.Secret, 7*24*time.Hour)
	dto.OK(c, gin.H{"token": token, "user": u})
}

func (h *AuthHandler) Me(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var g model.UserGroup
	model.DB.First(&g, u.GroupID)
	dto.OK(c, gin.H{"user": u, "group": g})
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
	model.DB.Model(u).UpdateColumn("password_hash", hashPassword(in.New))
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
