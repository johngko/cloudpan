// B5 Passkey / WebAuthn：注册（登录态下）、用户名 + 断言登录。
// 纯 Go 栈约束（modernc SQLite / 无 cgo）下选用 go-webauthn——仅标准库 crypto。
//
// challenge 会话存内存：CloudPan 单实例部署（自更新走 syscall.Exec），
// 5 分钟 TTL、一次性消费；重启丢会话只影响「半途注册/登录」，与验证码同级语义。
package handler

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/webauthn"
)

// ---- challenge 会话表 ----

type pkSession struct {
	data webauthn.SessionData
	exp  time.Time
}

var (
	pkSessions   = map[string]*pkSession{}
	pkSessionsMu sync.Mutex
)

func pkNewSession(sd webauthn.SessionData) string {
	b := make([]byte, 8)
	rand.Read(b)
	sid := hex.EncodeToString(b)
	pkSessionsMu.Lock()
	pkSessions[sid] = &pkSession{data: sd, exp: time.Now().Add(5 * time.Minute)}
	pkSessionsMu.Unlock()
	return sid
}

// pkTakeSession 一次性取出（无论成败都删除：challenge 不可复用）
func pkTakeSession(sid string) *webauthn.SessionData {
	pkSessionsMu.Lock()
	defer pkSessionsMu.Unlock()
	s := pkSessions[sid]
	delete(pkSessions, sid)
	if s == nil || time.Now().After(s.exp) {
		return nil
	}
	return &s.data
}

// ---- webauthn.User 适配：凭据整体存 JSON（PublicKey/描述符/计数器）----

type pkUser struct{ u *model.User }

func (p pkUser) WebAuthnID() []byte          { return []byte("u:" + strconv.FormatUint(uint64(p.u.ID), 10)) }
func (p pkUser) WebAuthnName() string        { return p.u.Username }
func (p pkUser) WebAuthnDisplayName() string { return p.u.Nickname }
func (p pkUser) WebAuthnIcon() string        { return "" }
func (p pkUser) WebAuthnCredentials() []webauthn.Credential {
	var rows []model.Passkey
	model.DB.Where("user_id = ?", p.u.ID).Find(&rows)
	out := make([]webauthn.Credential, 0, len(rows))
	for _, r := range rows {
		var c webauthn.Credential
		if err := json.Unmarshal([]byte(r.CredJSON), &c); err == nil {
			out = append(out, c)
		}
	}
	return out
}

func pkSaveCred(userID uint, cred *webauthn.Credential) error {
	b, err := json.Marshal(cred)
	if err != nil {
		return err
	}
	credID := hex.EncodeToString(cred.ID)
	var existing model.Passkey
	if model.DB.Where("cred_id = ?", credID).First(&existing).Error == nil {
		return model.DB.Model(&existing).UpdateColumn("cred_json", string(b)).Error
	}
	name := strings.ToUpper(hex.EncodeToString(cred.Authenticator.AAGUID))
	if name == "" || strings.Trim(name, "0") == "" {
		name = "passkey"
	}
	return model.DB.Create(&model.Passkey{UserID: userID, CredID: credID, Name: name, CredJSON: string(b)}).Error
}

// ---- 按请求 Host 构造实例（RP ID/Origins 与实际访问域名绑定）----

func pkForRequest(c *gin.Context) (*webauthn.WebAuthn, bool) {
	host := c.Request.Host
	if host == "" {
		dto.Fail(c, 400, "无法确定站点域名")
		return nil, false
	}
	u := &url.URL{Host: host}
	if net.ParseIP(u.Hostname()) != nil {
		// WebAuthn 的 RP ID 必须是域名（浏览器与库一致约束）：以 IP 直连时给出明确提示
		dto.Fail(c, 400, "Passkey 需通过域名访问（IP 直连不支持 WebAuthn）")
		return nil, false
	}
	// http 协议列入 Origins 仅对回环/内网直连部署有意义（生产走反代 https）；
	// 真实校验以浏览器上报的 origin 为准，伪造 origin 过不了断言签名
	w, err := webauthn.New(&webauthn.Config{
		RPID:          u.Hostname(),
		RPDisplayName: "CloudPan",
		RPOrigins:     []string{"https://" + host, "http://" + host},
	})
	if err != nil {
		dto.Fail(c, 500, "WebAuthn 配置失败")
		return nil, false
	}
	return w, true
}

// ---- 管理端点（登录态）----

type PasskeyHandler struct{ Secret []byte }

func (h *PasskeyHandler) BeginRegister(c *gin.Context) {
	x := middleware.CurrentUser(c)
	w, ok := pkForRequest(c)
	if !ok {
		return
	}
	pu := pkUser{u: x}
	if len(pu.WebAuthnCredentials()) >= 10 {
		dto.Fail(c, 400, "Passkey 数量已达上限（10）")
		return
	}
	options, session, err := w.BeginRegistration(pu)
	if err != nil {
		dto.Fail(c, 500, "发起注册失败: "+err.Error())
		return
	}
	dto.OK(c, gin.H{"sid": pkNewSession(*session), "options": options})
}

func (h *PasskeyHandler) FinishRegister(c *gin.Context) {
	var in struct {
		Sid      string          `json:"sid" binding:"required"`
		Response json.RawMessage `json:"response" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	session := pkTakeSession(in.Sid)
	if session == nil {
		dto.Fail(c, 400, "注册会话已过期，请重新发起")
		return
	}
	w, ok := pkForRequest(c)
	if !ok {
		return
	}
	x := middleware.CurrentUser(c)
	pu := pkUser{u: x}
	req, err := http.NewRequest(http.MethodPost, "/", bytes.NewReader(in.Response))
	if err != nil {
		dto.Fail(c, 500, "内部错误")
		return
	}
	cred, err := w.FinishRegistration(pu, *session, req)
	if err != nil {
		dto.Fail(c, 400, "注册失败: "+err.Error())
		return
	}
	if err := pkSaveCred(x.ID, cred); err != nil {
		dto.Fail(c, 500, "凭据保存失败")
		return
	}
	middleware.Audit(c, "passkey.add", "注册 Passkey")
	dto.OK(c, gin.H{"name": "registered"})
}

func (h *PasskeyHandler) List(c *gin.Context) {
	x := middleware.CurrentUser(c)
	var rows []model.Passkey
	model.DB.Where("user_id = ?", x.ID).Order("id desc").Find(&rows)
	out := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		var cr webauthn.Credential
		tail := ""
		if json.Unmarshal([]byte(r.CredJSON), &cr) == nil && len(cr.ID) > 0 {
			tail = "…" + hex.EncodeToString(cr.ID[max(0, len(cr.ID)-3):])
		}
		out = append(out, gin.H{"id": r.ID, "name": r.Name, "cred": tail, "createdAt": r.CreatedAt})
	}
	dto.OK(c, out)
}

func (h *PasskeyHandler) Delete(c *gin.Context) {
	x := middleware.CurrentUser(c)
	id := c.Query("id")
	res := model.DB.Where("id = ? AND user_id = ?", id, x.ID).Delete(&model.Passkey{})
	if res.RowsAffected == 0 {
		dto.Fail(c, 404, "Passkey 不存在")
		return
	}
	middleware.Audit(c, "passkey.del", "删除 Passkey id="+id)
	dto.OK(c, nil)
}

// ---- 登录端点（公开）----

func (h *PasskeyHandler) BeginLogin(c *gin.Context) {
	var in struct {
		Username string `json:"username"`
	}
	c.ShouldBindJSON(&in)
	username := strings.TrimSpace(in.Username)
	if username == "" {
		dto.Fail(c, 400, "请先输入用户名")
		return
	}
	var u model.User
	if err := model.DB.Where("username = ?", username).First(&u).Error; err != nil || u.Disabled {
		// 与密码登录同款：不区分「不存在 / 禁用」，防用户名枚举
		dto.Fail(c, 4001, "用户名或凭据错误")
		return
	}
	pu := pkUser{u: &u}
	if len(pu.WebAuthnCredentials()) == 0 {
		dto.Fail(c, 4001, "该账号未注册 Passkey")
		return
	}
	w, ok := pkForRequest(c)
	if !ok {
		return
	}
	options, session, err := w.BeginLogin(pu)
	if err != nil {
		dto.Fail(c, 500, "发起登录失败")
		return
	}
	dto.OK(c, gin.H{"sid": pkNewSession(*session), "options": options})
}

func (h *PasskeyHandler) FinishLogin(c *gin.Context) {
	var in struct {
		Username string          `json:"username" binding:"required"`
		Sid      string          `json:"sid" binding:"required"`
		Response json.RawMessage `json:"response" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	preKey := c.ClientIP() + "|pk|" + strings.ToLower(strings.TrimSpace(in.Username))
	if loginLocked(preKey) {
		dto.Fail(c, 4291, "失败次数过多，账号已临时锁定，请 15 分钟后再试")
		return
	}
	session := pkTakeSession(in.Sid)
	if session == nil {
		dto.Fail(c, 400, "登录会话已过期，请重试")
		return
	}
	var u model.User
	if err := model.DB.Where("username = ?", in.Username).First(&u).Error; err != nil || u.Disabled {
		dto.Fail(c, 4001, "用户名或凭据错误")
		return
	}
	pu := pkUser{u: &u}
	w, ok := pkForRequest(c)
	if !ok {
		return
	}
	req, err := http.NewRequest(http.MethodPost, "/", bytes.NewReader(in.Response))
	if err != nil {
		dto.Fail(c, 500, "内部错误")
		return
	}
	cred, err := w.FinishLogin(pu, *session, req)
	if err != nil {
		loginFail(preKey)
		dto.Fail(c, 4001, "凭据校验失败")
		return
	}
	loginFails.Delete(preKey)
	pkSaveCred(u.ID, cred) // 回写 SignCount（单调计数防克隆凭据）
	token, rt, err := (&AuthHandler{Secret: h.Secret}).issueTokens(&u)
	if err != nil {
		dto.Fail(c, 500, "签发令牌失败")
		return
	}
	now := time.Now()
	model.DB.Model(&u).UpdateColumn("last_login_at", &now)
	model.DB.Create(&model.AuditLog{UserID: u.ID, Username: u.Username, Action: "login", Detail: "Passkey 登录", IP: c.ClientIP()})
	dto.OK(c, gin.H{"token": token, "refreshToken": rt, "user": u, "isGuest": model.IsGuestUser(&u)})
}
