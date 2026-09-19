package handler

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// ---- 站内通知：emitter + 每用户 API + SSE 实时推送 ----

// notifyHub 每用户内存广播：SSE 订阅者收新通知事件（单实例部署语义；
// 缓冲满时丢弃而非阻塞写入路径）。
type notifyHub struct {
	mu   sync.Mutex
	subs map[uint]map[chan *model.Notification]struct{}
}

var hub = &notifyHub{subs: map[uint]map[chan *model.Notification]struct{}{}}

func (h *notifyHub) subscribe(userID uint) chan *model.Notification {
	ch := make(chan *model.Notification, 16)
	h.mu.Lock()
	if h.subs[userID] == nil {
		h.subs[userID] = map[chan *model.Notification]struct{}{}
	}
	h.subs[userID][ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *notifyHub) unsubscribe(userID uint, ch chan *model.Notification) {
	h.mu.Lock()
	if m, ok := h.subs[userID]; ok {
		delete(m, ch)
		if len(m) == 0 {
			delete(h.subs, userID)
		}
	}
	h.mu.Unlock()
}

func (h *notifyHub) publish(userID uint, n *model.Notification) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs[userID] {
		select {
		case ch <- n:
		default: // 订阅者消费不过来：丢弃，前端 30s 轮询兜底
		}
	}
}

// Notify 给用户写入一条站内通知（低频路径同步调用；每用户仅保留最近 200 条），并广播给 SSE 订阅者
func Notify(userID uint, typ, title, content string, refID uint) {
	if userID == 0 || model.DB == nil {
		return
	}
	content = truncateRunes(content, 512)
	n := &model.Notification{UserID: userID, Type: typ, Title: title, Content: content, RefID: refID}
	if err := model.DB.Create(n).Error; err != nil {
		return
	}
	var ids []uint
	model.DB.Model(&model.Notification{}).Where("user_id = ?", userID).Order("id DESC").Limit(200).Pluck("id", &ids)
	if len(ids) > 0 {
		model.DB.Where("user_id = ? AND id NOT IN ?", userID, ids).Delete(&model.Notification{})
	}
	hub.publish(userID, n)
	dispatchOutbound(userID, n)
}

// ---- 通知外发（webhook / 邮件）：Notify() 单点触发，异步尽力而为，失败只打日志 ----

type outboundPayload struct {
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	At       string `json:"at"`
}

func dispatchOutbound(userID uint, n *model.Notification) {
	go func() {
		defer func() { _ = recover() }()
		ss := GetSiteSettings()
		var username string
		var u model.User
		if err := model.DB.First(&u, userID).Error; err == nil {
			username = u.Username
		}
		p := outboundPayload{UserID: userID, Username: username, Type: n.Type, Title: n.Title, Content: n.Content, At: time.Now().Format(time.RFC3339)}
		sendWebhook(ss, p)
		if ss["notify_email_enabled"] == "true" {
			sendNotifyEmail(ss, p)
		}
	}()
}

func sendWebhook(ss map[string]string, p outboundPayload) {
	url := strings.TrimSpace(ss["notify_webhook_url"])
	if url == "" {
		return
	}
	body, _ := json.Marshal(p)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "CloudPan-Notify/1.0")
	if tok := strings.TrimSpace(ss["notify_webhook_token"]); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[notify] webhook 外发失败: %v", err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("[notify] webhook 外发返回 HTTP %d", resp.StatusCode)
	}
}

// sendNotifyEmail 通过 SMTP 外发邮件：465 走隐式 TLS，其余走 smtp.SendMail（自动 STARTTLS）
func sendNotifyEmail(ss map[string]string, p outboundPayload) {
	host := strings.TrimSpace(ss["notify_email_host"])
	port := strings.TrimSpace(ss["notify_email_port"])
	user := strings.TrimSpace(ss["notify_email_user"])
	pass := ss["notify_email_pass"]
	toRaw := strings.TrimSpace(ss["notify_email_to"])
	if host == "" || user == "" || toRaw == "" {
		return
	}
	if port == "" {
		port = "587"
	}
	from := strings.TrimSpace(ss["notify_email_from"])
	if from == "" {
		from = user
	}
	var tos []string
	for _, t := range strings.Split(toRaw, ",") {
		if t = strings.TrimSpace(t); t != "" {
			tos = append(tos, t)
		}
	}
	if len(tos) == 0 {
		return
	}
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n%s",
		from, strings.Join(tos, ", "),
		base64.StdEncoding.EncodeToString([]byte("=?UTF-8?B?"+base64.StdEncoding.EncodeToString([]byte("[CloudPan] "+p.Title))+"?=")),
		base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("用户: %s\n类型: %s\n时间: %s\n\n%s\n", p.Username, p.Type, p.At, p.Content))))
	addr := net.JoinHostPort(host, port)
	if port == "465" {
		if err := smtpSendImplicitTLS(addr, user, pass, from, tos, msg); err != nil {
			log.Printf("[notify] 邮件外发失败: %v", err)
		}
		return
	}
	auth := smtp.PlainAuth("", user, pass, host)
	if err := smtp.SendMail(addr, auth, from, tos, []byte(msg)); err != nil {
		log.Printf("[notify] 邮件外发失败: %v", err)
	}
}

// smtpSendImplicitTLS 465 端口隐式 TLS 发送
func smtpSendImplicitTLS(addr, user, pass, from string, tos []string, msg string) error {
	host := strings.SplitN(addr, ":", 2)[0]
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return err
	}
	defer conn.Close()
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer c.Close()
	if err := c.Auth(smtp.PlainAuth("", user, pass, host)); err != nil {
		return err
	}
	if err := c.Mail(from); err != nil {
		return err
	}
	for _, t := range tos {
		if err := c.Rcpt(t); err != nil {
			return err
		}
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return err
	}
	return c.Close()
}

func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// NotifyQuotaExceeded 配额超限提醒：每用户 24 小时内至多一条，避免上传重试刷屏
func NotifyQuotaExceeded(userID uint, quotaMB, usedBytes int64) {
	var n int64
	model.DB.Model(&model.Notification{}).
		Where("user_id = ? AND type = 'quota' AND created_at > ?", userID, time.Now().Add(-24*time.Hour)).
		Count(&n)
	if n > 0 {
		return
	}
	Notify(userID, "quota", "存储空间超限",
		fmt.Sprintf("已用 %dMB / 上限 %dMB，请删除部分文件或联系管理员提高配额。", usedBytes>>20, quotaMB), 0)
}

type NotifyHandler struct{}

// List GET /api/notify?limit=50
func (h *NotifyHandler) List(c *gin.Context) {
	x := ctxOf(c)
	limit := 50
	fmt.Sscanf(c.Query("limit"), "%d", &limit)
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var items []model.Notification
	model.DB.Where("user_id = ? AND cleared = ?", x.user.ID, false).Order("id DESC").Limit(limit).Find(&items)
	dto.OK(c, items)
}

// Unread GET /api/notify/unread
func (h *NotifyHandler) Unread(c *gin.Context) {
	x := ctxOf(c)
	var n int64
	model.DB.Model(&model.Notification{}).Where("user_id = ? AND `read` = ? AND cleared = ?", x.user.ID, false, false).Count(&n)
	dto.OK(c, gin.H{"count": n})
}

// Clear POST /api/notify/clear — 一键软清除：把当前用户所有未清除通知标记为已清除
// （从通知中心隐藏，数据保留在库供管理员审计），并写一条审计日志记录清除动作与条数。
func (h *NotifyHandler) Clear(c *gin.Context) {
	x := ctxOf(c)
	res := model.DB.Model(&model.Notification{}).
		Where("user_id = ? AND cleared = ?", x.user.ID, false).
		UpdateColumn("cleared", true)
	n := res.RowsAffected
	middleware.Audit(c, "notify_clear", fmt.Sprintf("一键清除 %d 条通知（软清除，数据保留）", n))
	dto.OK(c, gin.H{"cleared": n})
}

// Stream GET /api/notify/stream — SSE 实时推送新通知（前端 30s 轮询兜底）。
// 鉴权走 ?t= JWT（EventSource 无法自定义请求头），该参数已在访问日志脱敏集内。
func (h *NotifyHandler) Stream(c *gin.Context) {
	x := ctxOf(c)
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	ch := hub.subscribe(x.user.ID)
	defer hub.unsubscribe(x.user.ID, ch)
	// 注意：c.SSEvent 只渲染不 flush，必须每次显式 Flush，否则事件滞留在
	// Go http 响应缓冲（4KB）里，客户端永远收不到第一个事件。
	c.SSEvent("hello", gin.H{"ts": time.Now().Unix()})
	c.Writer.Flush()
	beat := time.NewTicker(15 * time.Second)
	defer beat.Stop()
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case n := <-ch:
			c.SSEvent("notify", n)
			c.Writer.Flush()
		case <-beat.C:
			c.SSEvent("ping", time.Now().Unix())
			c.Writer.Flush()
		}
	}
}

// Read POST /api/notify/read  {id} 单条已读 / {all:true} 全部已读
func (h *NotifyHandler) Read(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		ID  uint `json:"id"`
		All bool `json:"all"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || (!in.All && in.ID == 0) {
		dto.Fail(c, 400, "参数错误")
		return
	}
	q := model.DB.Model(&model.Notification{}).Where("user_id = ? AND `read` = ?", x.user.ID, false)
	if in.All {
		q.UpdateColumn("read", true)
		middleware.Audit(c, "notify", "全部标记已读")
	} else {
		q.Where("id = ?", in.ID).UpdateColumn("read", true)
	}
	dto.OK(c, nil)
}
