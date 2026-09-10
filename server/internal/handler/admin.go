package handler

import (
	"encoding/csv"
	"fmt"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

type AdminHandler struct{ Site *SiteHandler }

// ---- 仪表盘 ----

func (h *AdminHandler) Dashboard(c *gin.Context) {
	var users, shares, policies, recycle int64
	model.DB.Model(&model.User{}).Count(&users)
	model.DB.Model(&model.Share{}).Count(&shares)
	model.DB.Model(&model.Policy{}).Count(&policies)
	model.DB.Model(&model.RecycleItem{}).Count(&recycle)
	var usedSum int64
	model.DB.Model(&model.User{}).Select("COALESCE(SUM(used_bytes),0)").Scan(&usedSum)
	// 最近 7 天新增用户
	dto.OK(c, gin.H{
		"users": users, "shares": shares, "policies": policies, "recycle": recycle,
		"usedBytes": usedSum, "serverTime": nowUnix(),
	})
}

// ---- 用户管理 ----

// userOut 用户管理输出：appPerms 解析为对象便于前端直接编辑
type userOut struct {
	model.User
	AppPerms map[string]bool `json:"appPerms"`
}

func (h *AdminHandler) UserList(c *gin.Context) {
	var in dto.PageIn
	_ = c.ShouldBindQuery(&in)
	offset, limit := in.Normalize()
	q := model.DB.Model(&model.User{})
	if in.Keyword != "" {
		q = q.Where("username LIKE ? OR nickname LIKE ?", "%"+in.Keyword+"%", "%"+in.Keyword+"%")
	}
	var total int64
	q.Count(&total)
	var items []model.User
	q.Order("id").Offset(offset).Limit(limit).Find(&items)
	out := make([]userOut, 0, len(items))
	for _, u := range items {
		out = append(out, userOut{User: u, AppPerms: model.ParseAppPerms(u.AppPerms)})
	}
	dto.OK(c, dto.PageOut{Total: total, Items: out})
}

func (h *AdminHandler) UserCreate(c *gin.Context) {
	var in struct {
		Username string `json:"username" binding:"required,min=2,max=32"`
		Password string `json:"password" binding:"required,min=6,max=64"`
		Nickname string `json:"nickname"`
		Role     string `json:"role"`
		GroupID  uint   `json:"groupId"`
		QuotaMB  int64  `json:"quotaMB"` // <0=随组（默认） 0=不限量 >0=专属上限(MB)
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var n int64
	model.DB.Model(&model.User{}).Where("username = ?", in.Username).Count(&n)
	if n > 0 {
		dto.Fail(c, 400, "用户名已存在")
		return
	}
	if in.Role != "admin" && in.Role != "user" {
		in.Role = "user"
	}
	if in.GroupID == 0 {
		var g model.UserGroup
		model.DB.Where("is_default = ?", true).First(&g)
		in.GroupID = g.ID
	}
	quotaMB := normalizeQuotaMB(in.QuotaMB)
	u := model.User{Username: in.Username, PasswordHash: hashPassword(in.Password),
		Nickname: orDefault(in.Nickname, in.Username), Role: in.Role, GroupID: in.GroupID, QuotaMB: quotaMB}
	if err := model.DB.Create(&u).Error; err != nil {
		dto.Fail(c, 500, "创建失败")
		return
	}
	middleware.Audit(c, "admin", "创建用户 "+in.Username)
	dto.OK(c, userOut{User: u, AppPerms: model.ParseAppPerms(u.AppPerms)})
}

func (h *AdminHandler) UserUpdate(c *gin.Context) {
	var in struct {
		Nickname *string         `json:"nickname"`
		Role     *string         `json:"role"`
		GroupID  *uint           `json:"groupId"`
		Disabled *bool           `json:"disabled"`
		QuotaMB  *int64          `json:"quotaMB"`
		AppPerms *map[string]bool `json:"appPerms"` // 个人权限覆盖；传 {} = 全部恢复跟随用户组
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var u model.User
	if err := model.DB.First(&u, c.Param("id")).Error; err != nil {
		dto.Fail(c, 404, "用户不存在")
		return
	}
	up := map[string]interface{}{}
	if in.Nickname != nil {
		up["nickname"] = *in.Nickname
	}
	if in.Role != nil && (*in.Role == "admin" || *in.Role == "user") {
		up["role"] = *in.Role
	}
	if in.GroupID != nil {
		up["group_id"] = *in.GroupID
	}
	if in.Disabled != nil {
		up["disabled"] = *in.Disabled
	}
	if in.QuotaMB != nil {
		up["quota_mb"] = normalizeQuotaMB(*in.QuotaMB)
	}
	if in.AppPerms != nil {
		up["app_perms"] = model.AppPermsJSON(*in.AppPerms)
	}
	if len(up) > 0 {
		model.DB.Model(&u).Updates(up)
		model.DB.First(&u, c.Param("id"))
	}
	middleware.Audit(c, "admin", "更新用户 "+u.Username)
	dto.OK(c, userOut{User: u, AppPerms: model.ParseAppPerms(u.AppPerms)})
}

func (h *AdminHandler) UserResetPassword(c *gin.Context) {
	var in struct {
		Password string `json:"password" binding:"required,min=6,max=64"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var u model.User
	if err := model.DB.First(&u, c.Param("id")).Error; err != nil {
		dto.Fail(c, 404, "用户不存在")
		return
	}
	model.DB.Model(&u).UpdateColumn("password_hash", hashPassword(in.Password))
	middleware.Audit(c, "admin", "重置用户密码 "+u.Username)
	dto.OK(c, nil)
}

func (h *AdminHandler) UserDelete(c *gin.Context) {
	me := middleware.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if uint(id) == me.ID {
		dto.Fail(c, 400, "不能删除自己")
		return
	}
	var u model.User
	if err := model.DB.First(&u, id).Error; err != nil {
		dto.Fail(c, 404, "用户不存在")
		return
	}
	model.DB.Delete(&u)
	middleware.Audit(c, "admin", "删除用户 "+u.Username)
	dto.OK(c, nil)
}

// ---- 用户组 ----

// groupOut 用户组管理输出：appPerms 解析为对象便于前端直接编辑
type groupOut struct {
	model.UserGroup
	AppPerms map[string]bool `json:"appPerms"`
}

func (h *AdminHandler) GroupList(c *gin.Context) {
	var items []model.UserGroup
	model.DB.Order("id").Find(&items)
	out := make([]groupOut, 0, len(items))
	for _, g := range items {
		out = append(out, groupOut{UserGroup: g, AppPerms: model.ParseAppPerms(g.AppPerms)})
	}
	dto.OK(c, out)
}

func (h *AdminHandler) GroupSave(c *gin.Context) {
	var in struct {
		ID                   uint             `json:"id"`
		Name                 string           `json:"name" binding:"required"`
		QuotaMB              int64            `json:"quotaMB"`
		AllowShare           bool             `json:"allowShare"`
		AllowWebdav          bool             `json:"allowWebdav"`
		AllowArchive         bool             `json:"allowArchive"`
		AllowOffline         bool             `json:"allowOffline"`
		ShareAllowDownload   bool             `json:"shareAllowDownload"`
		ReadOnly             bool             `json:"readOnly"`
		DownloadSpeedKB      int64            `json:"downloadSpeedKB"`
		RecycleRetentionDays int              `json:"recycleRetentionDays"`
		KeepVersions         int              `json:"keepVersions"`
		VersionRetentionDays int              `json:"versionRetentionDays"`
		AllowedPolicyIDs     string           `json:"allowedPolicyIds"`
		AppPerms             map[string]bool  `json:"appPerms"` // 组级应用权限；缺省键 = 允许
		IsDefault            bool             `json:"isDefault"`
		Remark               string           `json:"remark"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	perms := model.AppPermsJSON(in.AppPerms)
	if in.ID == 0 {
		g := model.UserGroup{Name: in.Name, QuotaMB: in.QuotaMB, AllowShare: in.AllowShare,
			AllowWebdav: in.AllowWebdav, AllowArchive: in.AllowArchive, AllowOffline: in.AllowOffline,
			ShareAllowDownload: in.ShareAllowDownload, ReadOnly: in.ReadOnly, DownloadSpeedKB: in.DownloadSpeedKB,
			RecycleRetentionDays: in.RecycleRetentionDays, KeepVersions: in.KeepVersions,
			VersionRetentionDays: in.VersionRetentionDays, AllowedPolicyIDs: in.AllowedPolicyIDs,
			AppPerms: perms, IsDefault: in.IsDefault, Remark: in.Remark}
		if err := model.DB.Create(&g).Error; err != nil {
			dto.Fail(c, 400, "名称重复或参数错误")
			return
		}
		middleware.Audit(c, "admin", "保存用户组 "+in.Name)
		dto.OK(c, groupOut{UserGroup: g, AppPerms: model.ParseAppPerms(perms)})
		return
	}
	if err := model.DB.Model(&model.UserGroup{}).Where("id = ?", in.ID).Updates(map[string]interface{}{
		"name": in.Name, "quota_mb": in.QuotaMB, "allow_share": in.AllowShare,
		"allow_webdav": in.AllowWebdav, "allow_archive": in.AllowArchive, "allow_offline": in.AllowOffline,
		"share_allow_download": in.ShareAllowDownload, "read_only": in.ReadOnly, "download_speed_kb": in.DownloadSpeedKB,
		"recycle_retention_days": in.RecycleRetentionDays,
		"keep_versions": in.KeepVersions, "version_retention_days": in.VersionRetentionDays,
		"allowed_policy_ids": in.AllowedPolicyIDs, "app_perms": perms,
		"is_default": in.IsDefault, "remark": in.Remark,
	}).Error; err != nil {
		dto.Fail(c, 400, "保存失败")
		return
	}
	model.InvalidateAppPermCache(in.ID)
	middleware.Audit(c, "admin", "保存用户组 "+in.Name)
	var g model.UserGroup
	model.DB.First(&g, in.ID)
	dto.OK(c, groupOut{UserGroup: g, AppPerms: model.ParseAppPerms(g.AppPerms)})
}

func (h *AdminHandler) GroupDelete(c *gin.Context) {
	var n int64
	model.DB.Model(&model.User{}).Where("group_id = ?", c.Param("id")).Count(&n)
	if n > 0 {
		dto.Fail(c, 400, "仍有用户属于该组")
		return
	}
	var gid uint
	_, _ = fmt.Sscanf(c.Param("id"), "%d", &gid)
	model.DB.Delete(&model.UserGroup{}, c.Param("id"))
	model.InvalidateAppPermCache(gid)
	dto.OK(c, nil)
}

// ---- 存储策略 ----

type policyIn struct {
	Name     string `json:"name" binding:"required"`
	Letter   string `json:"letter" binding:"required"`
	Type     string `json:"type" binding:"required"`
	RootPath string `json:"rootPath"`
	Options  map[string]string `json:"options"`
}

func (h *AdminHandler) PolicyList(c *gin.Context) {
	var items []model.Policy
	model.DB.Order("letter").Find(&items)
	// admin 专用 DTO：包含 options（密钥），普通用户接口不会暴露
	out := make([]gin.H, 0, len(items))
	for _, p := range items {
		out = append(out, gin.H{
			"id": p.ID, "name": p.Name, "letter": p.Letter, "type": p.Type,
			"rootPath": p.RootPath, "options": p.Opts(), "status": p.Status,
			"statusMsg": p.StatusMsg, "usageBytes": p.UsageBytes, "createdAt": p.CreatedAt,
		})
	}
	dto.OK(c, out)
}

func (h *AdminHandler) PolicyCreate(c *gin.Context) {
	var in policyIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	u := middleware.CurrentUser(c)
	opts := "{}"
	if in.Options != nil {
		opts = marshalOpts(in.Options)
	}
	p := model.Policy{Name: in.Name, Letter: in.Letter, Type: in.Type, RootPath: in.RootPath, Options: opts, CreatedBy: u.ID}
	if in.Type == "local" {
		if in.RootPath == "" {
			dto.Fail(c, 400, "本地存储必须填写根目录")
			return
		}
		// 跨平台校验：必须为本机绝对路径；非 Windows 主机拒绝反斜杠，
		// 防止 Linux 上粘贴 E:\x 这类路径被当作相对目录名静默建到 CWD 下
		if runtime.GOOS != "windows" && strings.Contains(in.RootPath, "\\") {
			dto.Fail(c, 400, "根目录路径不合法：Linux/macOS 请使用 / 分隔的绝对路径")
			return
		}
		if !filepath.IsAbs(in.RootPath) {
			if runtime.GOOS != "windows" || !filepath.IsAbs(filepath.FromSlash(in.RootPath)) {
				dto.Fail(c, 400, "根目录必须是绝对路径（如 /data/storage）")
				return
			}
		}
		if _, err := fscore.NewLocal(in.RootPath); err != nil {
			dto.Fail(c, 400, "根目录不可用："+err.Error())
			return
		}
	}
	if err := model.DB.Create(&p).Error; err != nil {
		dto.Fail(c, 400, "盘符可能重复："+err.Error())
		return
	}
	middleware.Audit(c, "admin", "挂载存储 "+p.Name)
	dto.OK(c, p)
}

func (h *AdminHandler) PolicyUpdate(c *gin.Context) {
	var p model.Policy
	if err := model.DB.First(&p, c.Param("id")).Error; err != nil {
		dto.Fail(c, 404, "策略不存在")
		return
	}
	var in policyIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	opts := p.Options
	if in.Options != nil {
		opts = marshalOpts(in.Options)
	}
	model.DB.Model(&p).Updates(map[string]interface{}{
		"name": in.Name, "letter": in.Letter, "root_path": in.RootPath, "options": opts,
		"status": orDefault(c.Query("status"), p.Status),
	})
	h.Site.Fs.Invalidate(p.ID)
	dto.OK(c, p)
}

func (h *AdminHandler) PolicyToggle(c *gin.Context) {
	var p model.Policy
	if err := model.DB.First(&p, c.Param("id")).Error; err != nil {
		dto.Fail(c, 404, "策略不存在")
		return
	}
	var in struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	model.DB.Model(&p).UpdateColumn("status", in.Status)
	h.Site.Fs.Invalidate(p.ID)
	dto.OK(c, p)
}

func (h *AdminHandler) PolicyDelete(c *gin.Context) {
	var p model.Policy
	if err := model.DB.First(&p, c.Param("id")).Error; err != nil {
		dto.Fail(c, 404, "策略不存在")
		return
	}
	var n int64
	model.DB.Model(&model.Share{}).Where("policy_id = ?", p.ID).Count(&n)
	if n > 0 {
		dto.Fail(c, 400, "存在关联分享，请先取消")
		return
	}
	model.DB.Delete(&p)
	h.Site.Fs.Invalidate(p.ID)
	middleware.Audit(c, "admin", "卸载存储 "+p.Name)
	dto.OK(c, nil)
}

// ---- 站点设置 ----

func (h *AdminHandler) SettingsGet(c *gin.Context) {
	dto.OK(c, GetSiteSettings())
}

func (h *AdminHandler) SettingsSet(c *gin.Context) {
	var in map[string]string
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	for k, v := range in {
		model.DB.Save(&model.SiteSetting{Key: k, Value: v})
	}
	middleware.Audit(c, "admin", "更新站点设置")
	dto.OK(c, GetSiteSettings())
}

// ---- 审计日志 / 任务 ----

func (h *AdminHandler) LogList(c *gin.Context) {
	var in dto.PageIn
	_ = c.ShouldBindQuery(&in)
	offset, limit := in.Normalize()
	q := model.DB.Model(&model.AuditLog{})
	if in.Keyword != "" {
		q = q.Where("username LIKE ? OR action LIKE ? OR detail LIKE ?", "%"+in.Keyword+"%", "%"+in.Keyword+"%", "%"+in.Keyword+"%")
	}
	var total int64
	q.Count(&total)
	var items []model.AuditLog
	q.Order("id DESC").Offset(offset).Limit(limit).Find(&items)
	dto.OK(c, dto.PageOut{Total: total, Items: items})
}

// NotificationRecord 通知记录（含软清除），供管理员审计
type NotificationRecord struct {
	ID        uint      `json:"id"`
	Username  string    `json:"username"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Read      bool      `json:"read"`
	Cleared   bool      `json:"cleared"`
	CreatedAt time.Time `json:"createdAt"`
}

// NotificationList 全站通知记录（含已软清除的，审计用）；keyword 匹配类型/标题/内容/用户名
// 注意：不用 JOIN+Select(*, users.username) 扫进内嵌 struct——实测该写法会把 cleared 列误映射为 true。
// 改为直接查通知（扫描可靠，同 /api/notify），再批量取用户名在 Go 里拼装。
func (h *AdminHandler) NotificationList(c *gin.Context) {
	var in dto.PageIn
	_ = c.ShouldBindQuery(&in)
	offset, limit := in.Normalize()
	kw := in.Keyword
	q := model.DB.Model(&model.Notification{})
	if kw != "" {
		// 用户名匹配：先查出命中的用户 ID，再并入通知字段 LIKE 条件
		var uids []uint
		model.DB.Model(&model.User{}).Where("username LIKE ?", "%"+kw+"%").Pluck("id", &uids)
		if len(uids) == 0 {
			uids = []uint{0} // 空集占位，使 IN 恒假
		}
		q = q.Where("(type LIKE ? OR title LIKE ? OR content LIKE ? OR user_id IN ?)",
			"%"+kw+"%", "%"+kw+"%", "%"+kw+"%", uids)
	}
	if c.Query("cleared") == "true" {
		q = q.Where("cleared = ?", true)
	}
	var total int64
	q.Count(&total)
	var items []model.Notification
	q.Order("id DESC").Offset(offset).Limit(limit).Find(&items)
	// 批量取本页涉及的用户名
	uidSet := map[uint]struct{}{}
	for _, n := range items {
		uidSet[n.UserID] = struct{}{}
	}
	userMap := map[uint]string{}
	if len(uidSet) > 0 {
		uidSlice := make([]uint, 0, len(uidSet))
		for id := range uidSet {
			uidSlice = append(uidSlice, id)
		}
		var users []model.User
		model.DB.Where("id IN ?", uidSlice).Find(&users)
		for _, u := range users {
			userMap[u.ID] = u.Username
		}
	}
	out := make([]NotificationRecord, 0, len(items))
	for _, n := range items {
		out = append(out, NotificationRecord{
			ID: n.ID, Username: userMap[n.UserID], Type: n.Type, Title: n.Title,
			Content: n.Content, Read: n.Read, Cleared: n.Cleared, CreatedAt: n.CreatedAt,
		})
	}
	dto.OK(c, dto.PageOut{Total: total, Items: out})
}

// LogExport 审计日志 CSV 导出（流式，最多 20000 条；支持 keyword 过滤）
func (h *AdminHandler) LogExport(c *gin.Context) {
	keyword := c.Query("keyword")
	const maxRows = 20000
	q := model.DB.Model(&model.AuditLog{})
	if keyword != "" {
		q = q.Where("username LIKE ? OR action LIKE ? OR detail LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="audit-logs-%s.csv"`, time.Now().Format("20060102-150405")))
	// UTF-8 BOM：Excel 直接打开不乱码
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"时间", "用户", "操作", "详情", "IP"})
	w.Flush()
	const batchSize = 500
	var written int
	for offset := 0; offset < maxRows; offset += batchSize {
		var items []model.AuditLog
		q.Order("id DESC").Offset(offset).Limit(batchSize).Find(&items)
		if len(items) == 0 {
			break
		}
		for _, it := range items {
			_ = w.Write([]string{
				it.CreatedAt.Format("2006-01-02 15:04:05"),
				it.Username, it.Action, it.Detail, it.IP,
			})
			written++
		}
		w.Flush()
		if len(items) < batchSize {
			break
		}
	}
	w.Flush()
	middleware.Audit(c, "log_export", fmt.Sprintf("导出审计日志 %d 条（keyword=%q）", written, keyword))
}

func (h *AdminHandler) TaskList(c *gin.Context) {
	var items []model.Task
	model.DB.Order("id DESC").Limit(100).Find(&items)
	dto.OK(c, items)
}

// ShareAudit 全站分享审计
func (h *AdminHandler) ShareAudit(c *gin.Context) {
	var in dto.PageIn
	_ = c.ShouldBindQuery(&in)
	offset, limit := in.Normalize()
	q := model.DB.Model(&model.Share{})
	if in.Keyword != "" {
		q = q.Where("name LIKE ?", "%"+in.Keyword+"%")
	}
	var total int64
	q.Count(&total)
	var items []model.Share
	q.Order("id DESC").Offset(offset).Limit(limit).Find(&items)
	// 附上分享者用户名
	out := make([]gin.H, 0, len(items))
	for _, s := range items {
		var u model.User
		model.DB.Select("username", "nickname").First(&u, s.UserID)
		out = append(out, gin.H{
			"id": s.ID, "name": s.Name, "isDir": s.IsDir, "owner": u.Nickname, "ownerName": u.Username,
			"hasPassword": s.PasswordHash != "", "views": s.Views, "downloads": s.Downloads,
			"allowDownload": s.AllowDownload, "expiresAt": s.ExpiresAt, "createdAt": s.CreatedAt,
		})
	}
	dto.OK(c, dto.PageOut{Total: total, Items: out})
}

func (h *AdminHandler) ShareDelete(c *gin.Context) {
	model.DB.Delete(&model.Share{}, c.Param("id"))
	middleware.Audit(c, "admin", "管理员取消分享 #" + c.Param("id"))
	dto.OK(c, nil)
}

// ---- 辅助 ----

// normalizeQuotaMB 归一化个人配额输入：<0 → -1（随组），0 → 0（不限量），>0 封顶 1PB
func normalizeQuotaMB(mb int64) int64 {
	if mb < 0 {
		return -1
	}
	if mb > 1024*1024 { // 1PB
		return 1024 * 1024
	}
	return mb
}

func orDefault(v, d string) string {
	if v == "" {
		return d
	}
	return v
}

func marshalOpts(m map[string]string) string {
	b, _ := jsonMarshal(m)
	return string(b)
}

