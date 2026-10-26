package handler

// B16 文件事件 Webhook：把「创建/修改/删除/改名/分享」等变更外发成 HTTP 事件，
// 供 n8n / HomeAssistant / 自建自动化接管（借鉴 Nextcloud Webhooks、Gitea webhooks）。
//
// 设计要点：
//   - 两层钩子：user_id=0 为全局钩子（管理员配，对所有人所有事件生效）；
//     user_id>0 为用户自建（只管自己的文件事件），走 AppGate("webhook")（未知键默认放行）。
//   - 持久化队列（webhook_deliveries 行）：投递在重启后继续重试；worker 每 5s 扫
//     pending 且 next_try<=now 的行，指数退避（30s→2m→10m→1h），5 次后判 failed。
//   - 出站安全：URL 保存时与投递时都过 validateFetchURL + ssrfCheckRedirect
//     （与离线下载同一套 SSRF 三层防护），内网地址默认拒绝。
//   - 签名：配了 secret 时带 X-CloudPan-Signature: hex(HMAC-SHA256(secret, body))，
//     接收端可验证来源（GitHub Webhooks 同款方案）。
//   - 队列保鲜：启动/清扫时丢弃创建超 24h 的 pending（陈旧事件重放只会误导自动化），
//     delivered 行保留 7 天后清除。

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
)

// 事件目录（UI 与 API 共用同一集合；空 Events = 订阅全部）
var webhookEvents = []string{
	"file.create", // 上传落盘
	"file.mkdir",
	"file.write", // 文本保存/覆盖写
	"file.rename",
	"file.move",
	"file.copy",
	"file.delete",
	"file.restore", // 版本还原
	"share.create",
	"share.cancel",
}

var webhookEventOK = func() map[string]bool {
	m := map[string]bool{}
	for _, e := range webhookEvents {
		m[e] = true
	}
	return m
}()

// regexCache 钩子的路径正则编译缓存（钩子更新/删除时失效）
var webhookRegexCache sync.Map // hookID -> *regexp.Regexp|nil

func webhookRegex(id uint, pattern string) *regexp.Regexp {
	if pattern == "" {
		return nil
	}
	if v, ok := webhookRegexCache.Load(id); ok {
		if re, _ := v.(*regexp.Regexp); re != nil {
			return re
		}
		return nil
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		re = nil
	}
	webhookRegexCache.Store(id, re)
	return re
}

// webhookAllowPrivateURL webhook 出站 URL 校验。默认套用与离线下载同一套 SSRF
// 三层防护（内网/回环一律拒绝）；自托管的 n8n/HomeAssistant 几乎都部署在同一
// 局域网，管理员可设 CP_WEBHOOK_ALLOW_PRIVATE=1 显式放开——这是 Gitea
// ALLOW_LOCAL_WEBHOOKS 同款的全局运维开关，只影响 webhook 出站，不影响离线下载。
func webhookAllowPrivateURL() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("CP_WEBHOOK_ALLOW_PRIVATE")))
	return v == "1" || v == "true"
}

func webhookValidateURL(raw string) error {
	if webhookAllowPrivateURL() {
		// 放开的是「同机/同内网」，云元数据段（169.254/16）与未指定地址仍然拒绝——
		// 无论开关与否都不给 SSRF 打云凭据的主通道留缝。
		u, err := url.Parse(strings.TrimSpace(raw))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return fmt.Errorf("仅支持 http/https 链接")
		}
		if host := u.Hostname(); host != "" {
			if ip := net.ParseIP(host); ip != nil {
				if ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
					return fmt.Errorf("该地址属于保留网段，webhook 也不能投递到它")
				}
			}
		}
		return nil
	}
	return validateFetchURL(raw)
}

// webhookBase 虚拟路径的文件名段
func webhookBase(vp string) string {
	if i := strings.LastIndex(vp, "/"); i >= 0 && i < len(vp)-1 {
		return vp[i+1:]
	}
	return vp
}

// emitFileEvent 事件入口（各写路径成功后调用；失败只记日志，绝不影响业务响应）。
// path 为「属主 policy 视角」的虚拟路径，与文件列表一致。
func emitFileEvent(actor *model.User, event string, policyID uint, path string, name string, extra map[string]interface{}) {
	if !webhookEventOK[event] {
		return
	}
	if !model.AppEnabled("webhook") && (actor == nil || actor.Role != "admin") {
		return // 管理员全局停用（AppGate 同源开关）
	}
	var actorName string
	uid := uint(0)
	if actor != nil {
		actorName, uid = actor.Username, actor.ID
	}
	var hooks []model.Webhook
	if err := model.DB.Where("enabled = ? AND (user_id = 0 OR user_id = ?)", true, uid).Find(&hooks).Error; err != nil || len(hooks) == 0 {
		return
	}
	var letter string
	var pol model.Policy
	if model.DB.Select("letter").First(&pol, policyID).Error == nil {
		letter = pol.Letter
	}
	// payload 里的 path/name 在 hook 过滤前先定稿（同一事件对所有命中钩子内容一致）
	matches := func(hook model.Webhook) bool {
		if hook.Events != "" {
			var evs []string
			_ = json.Unmarshal([]byte(hook.Events), &evs)
			hit := false
			for _, e := range evs {
				if e == event {
					hit = true
					break
				}
			}
			if !hit {
				return false
			}
		}
		if re := webhookRegex(hook.ID, hook.PathRegex); re != nil && !re.MatchString(path) {
			return false
		}
		return true
	}
	body := func() string {
		payload := map[string]interface{}{
			"event":    event,
			"time":     time.Now().Format(time.RFC3339),
			"user":     actorName,
			"policyId": policyID,
			"policy":   letter,
			"path":     path,
			"name":     name,
		}
		if extra != nil {
			payload["extra"] = extra
		}
		b, _ := json.Marshal(payload)
		return string(b)
	}
	var created int
	var payload string
	for _, h := range hooks {
		if !matches(h) {
			continue
		}
		if payload == "" {
			payload = body()
		}
		model.DB.Create(&model.WebhookDelivery{HookID: h.ID, Payload: payload, Status: "pending", NextTry: time.Now()})
		created++
	}
	_ = created
}

// ---- 投递 worker ----

var webhookBackoff = []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, time.Hour}

func webhookDeliver(d model.WebhookDelivery) {
	var hook model.Webhook
	if err := model.DB.First(&hook, d.HookID).Error; err != nil {
		model.DB.Model(&d).UpdateColumns(map[string]interface{}{"status": "failed", "last_error": "钩子已删除"})
		return
	}
	if !hook.Enabled {
		model.DB.Model(&d).UpdateColumns(map[string]interface{}{"status": "failed", "last_error": "钩子已停用"})
		return
	}
	// 投递时再校验一次：保存后 DNS 重绑定/配置漂移也不能绕过 SSRF 防线
	if err := webhookValidateURL(hook.URL); err != nil {
		model.DB.Model(&d).UpdateColumns(map[string]interface{}{"status": "failed", "last_error": "URL 未过 SSRF 校验: " + err.Error()})
		return
	}
	redirectCheck := ssrfCheckRedirect
	if webhookAllowPrivateURL() {
		redirectCheck = nil // 显式允许私有网段时，重定向复检同步放宽（运维知情选择）
	}
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: redirectCheck}
	req, err := http.NewRequest("POST", hook.URL, strings.NewReader(d.Payload))
	if err != nil {
		model.DB.Model(&d).UpdateColumns(map[string]interface{}{"status": "failed", "last_error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "CloudPan-Webhook/1.0")
	var evOnly struct {
		Event string `json:"event"`
	}
	_ = json.Unmarshal([]byte(d.Payload), &evOnly)
	req.Header.Set("X-CloudPan-Event", evOnly.Event)
	if hook.Secret != "" {
		mac := hmac.New(sha256.New, []byte(hook.Secret))
		mac.Write([]byte(d.Payload))
		req.Header.Set("X-CloudPan-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}
	resp, err := client.Do(req)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode < 300 {
			model.DB.Model(&d).UpdateColumns(map[string]interface{}{"status": "delivered", "attempts": d.Attempts + 1, "last_error": ""})
			return
		}
		err = fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	next := d.Attempts + 1
	if next > len(webhookBackoff) {
		model.DB.Model(&d).UpdateColumns(map[string]interface{}{"status": "failed", "attempts": next, "last_error": truncate(err.Error(), 500)})
		log.Printf("[webhook] hook#%d 投递最终失败: %v", hook.ID, err)
		return
	}
	model.DB.Model(&d).UpdateColumns(map[string]interface{}{
		"attempts": next, "next_try": time.Now().Add(webhookBackoff[next-1]), "last_error": truncate(err.Error(), 500),
	})
}

// startWebhookWorker 随 TaskPool 的清扫协程一起拉起（同一生命周期，无需单独接线）。
func startWebhookWorker() {
	go func() {
		t := time.NewTicker(5 * time.Second)
		tick := 0
		for range t.C {
			var pend []model.WebhookDelivery
			if err := model.DB.Where("status = ? AND next_try <= ?", "pending", time.Now()).
				Order("id").Limit(20).Find(&pend).Error; err == nil {
				for _, d := range pend {
					webhookDeliver(d)
				}
			}
			tick++
			if tick%720 == 0 { // ~每小时清扫
				model.DB.Where("status = ? AND created_at < ?", "delivered", time.Now().Add(-7*24*time.Hour)).Delete(&model.WebhookDelivery{})
				// 陈旧 pending 重放只会误导自动化：超 24h 直接作废
				model.DB.Where("status = ? AND created_at < ?", "pending", time.Now().Add(-24*time.Hour)).
					UpdateColumn("status", "failed")
			}
		}
	}()
}

// ---- CRUD ----

type webhookIn struct {
	Name      string   `json:"name"`
	URL       string   `json:"url"`
	Secret    string   `json:"secret"`
	Events    []string `json:"events"`
	PathRegex string   `json:"pathRegex"`
	Enabled   *bool    `json:"enabled"`
	Global    bool     `json:"global"` // 仅管理员可用：建全局钩子
}

func (h *WebhookHandler) sanitize(c *gin.Context, in *webhookIn) (string, bool) {
	in.Name = strings.TrimSpace(in.Name)
	in.URL = strings.TrimSpace(in.URL)
	if in.Name == "" || len(in.Name) > 100 {
		return "名称必填（≤100 字）", false
	}
	if err := webhookValidateURL(in.URL); err != nil {
		return "URL 非法: " + err.Error(), false
	}
	if len(in.Secret) > 128 || len(in.PathRegex) > 255 {
		return "secret/pathRegex 过长", false
	}
	if in.PathRegex != "" {
		if _, err := regexp.Compile(in.PathRegex); err != nil {
			return "路径正则非法: " + err.Error(), false
		}
	}
	for _, e := range in.Events {
		if !webhookEventOK[e] {
			return "未知事件: " + e, false
		}
	}
	return "", true
}

type WebhookHandler struct{}

func (h *WebhookHandler) List(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var hooks []model.Webhook
	q := model.DB.Where("user_id = ?", u.ID)
	if u.Role == "admin" && c.Query("scope") == "global" {
		q = model.DB.Where("user_id = 0")
	}
	q.Order("id DESC").Find(&hooks)
	dto.OK(c, hooks)
}

func (h *WebhookHandler) Create(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var in webhookIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if in.Global && u.Role != "admin" {
		dto.Fail(c, 403, "仅管理员可建全局钩子")
		return
	}
	if msg, ok := h.sanitize(c, &in); !ok {
		dto.Fail(c, 400, msg)
		return
	}
	ev, _ := json.Marshal(in.Events)
	owner := u.ID
	if in.Global {
		owner = 0
	}
	hk := model.Webhook{UserID: owner, Name: in.Name, URL: in.URL, Secret: in.Secret, Events: string(ev), PathRegex: in.PathRegex, Enabled: true}
	if in.Enabled != nil {
		hk.Enabled = *in.Enabled
	}
	if err := model.DB.Create(&hk).Error; err != nil {
		dto.Fail(c, 500, "创建失败")
		return
	}
	middleware.Audit(c, "webhook.create", hk.Name)
	dto.OK(c, hk)
}

func (h *WebhookHandler) Update(c *gin.Context) {
	u := middleware.CurrentUser(c)
	hk := h.own(c, u)
	if hk.ID == 0 {
		return
	}
	var in webhookIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if msg, ok := h.sanitize(c, &in); !ok {
		dto.Fail(c, 400, msg)
		return
	}
	ev, _ := json.Marshal(in.Events)
	upd := map[string]interface{}{"name": in.Name, "url": in.URL, "secret": in.Secret, "events": string(ev), "path_regex": in.PathRegex}
	if in.Enabled != nil {
		upd["enabled"] = *in.Enabled
	}
	if err := model.DB.Model(&hk).UpdateColumns(upd).Error; err != nil {
		dto.Fail(c, 500, "更新失败")
		return
	}
	webhookRegexCache.Delete(hk.ID)
	dto.OK(c, gin.H{"done": true})
}

func (h *WebhookHandler) Delete(c *gin.Context) {
	u := middleware.CurrentUser(c)
	hk := h.own(c, u)
	if hk.ID == 0 {
		return
	}
	model.DB.Delete(&model.Webhook{}, hk.ID)
	model.DB.Where("hook_id = ? AND status = ?", hk.ID, "pending").UpdateColumn("status", "failed")
	webhookRegexCache.Delete(hk.ID)
	dto.OK(c, gin.H{"done": true})
}

// own 按 id 取钩子：普通用户只能动自己的；管理员可动全局（user_id=0）
func (h *WebhookHandler) own(c *gin.Context, u *model.User) model.Webhook {
	var hk model.Webhook
	id := parseUintQuery(c, "id")
	if err := model.DB.First(&hk, id).Error; err != nil {
		dto.Fail(c, 404, "钩子不存在")
		return hk
	}
	if hk.UserID != u.ID && !(u.Role == "admin" && hk.UserID == 0) {
		dto.Fail(c, 403, "无权操作该钩子")
		return model.Webhook{}
	}
	return hk
}

// ListEvents 事件目录（前端渲染订阅多选）
func (h *WebhookHandler) ListEvents(c *gin.Context) {
	dto.OK(c, webhookEvents)
}

// TestFire 管理员/用户手动触发一条测试事件（走真实队列与签名路径，验证接收端）
func (h *WebhookHandler) TestFire(c *gin.Context) {
	u := middleware.CurrentUser(c)
	hk := h.own(c, u)
	if hk.ID == 0 {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"event": "__test__", "time": time.Now().Format(time.RFC3339),
		"user": u.Username, "policyId": 0, "policy": "", "path": "/__webhook_test__", "name": "__webhook_test__",
	})
	model.DB.Create(&model.WebhookDelivery{HookID: hk.ID, Payload: string(payload), Status: "pending", NextTry: time.Now()})
	dto.OK(c, gin.H{"queued": true})
}

// RecentDeliveries 最近投递记录（排查用）
func (h *WebhookHandler) RecentDeliveries(c *gin.Context) {
	u := middleware.CurrentUser(c)
	var ids []uint
	model.DB.Model(&model.Webhook{}).Where("user_id = ?", u.ID).Pluck("id", &ids)
	if u.Role == "admin" {
		var gids []uint
		model.DB.Model(&model.Webhook{}).Where("user_id = 0").Pluck("id", &gids)
		ids = append(ids, gids...)
	}
	if len(ids) == 0 {
		dto.OK(c, []model.WebhookDelivery{})
		return
	}
	var rows []model.WebhookDelivery
	model.DB.Where("hook_id IN ?", ids).Order("id DESC").Limit(50).Find(&rows)
	dto.OK(c, rows)
}
