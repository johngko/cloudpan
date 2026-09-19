package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// UploadHandler 分块上传（断点续传 + 秒传）
type UploadHandler struct{ Site *SiteHandler }

// mergeSem 服务端合并并发上限：大文件合并+哈希需数分钟，complete 立即返回、
// 客户端轮询状态跟踪；池满时拒绝并让客户端稍后重试（会话状态回滚，可重发 complete）
var mergeSem = make(chan struct{}, 2)

type uploadInitIn struct {
	PolicyID  uint   `json:"policyId" binding:"required"`
	Parent    string `json:"parent"`
	Name      string `json:"name" binding:"required"`
	Size      int64  `json:"size"` // 允许 0：空文件是合法上传（文件夹里常见），required 会把 0 拒掉
	ChunkSize int64  `json:"chunkSize"`
	Hash      string `json:"hash"`
}

func (h *UploadHandler) Init(c *gin.Context) {
	if !requireWritable(c) {
		return
	}
	x := ctxOf(c)
	var in uploadInitIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	parent, err := fscore.Clean(in.Parent)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	if _, err := fscore.Join(parent, in.Name); err != nil {
		dto.Fail(c, 400, "文件名非法")
		return
	}
	// Windows：创建前规范化各路径段（去尾部空格/点，拒绝保留设备名与非法字符），
	// 否则 Windows 静默截断名称后前后路径不一致，报"找不到请求的文件或目录"(267)
	if sp, err := fscore.SanitizeNewPath(parent); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	} else {
		parent = sp
	}
	if sn, err := fscore.SanitizeName(in.Name); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	} else {
		in.Name = sn
	}
	// 单文件上限 20GB（0 字节合法：空文件）；分片尺寸收敛到 [1KB, 64MB]，防不限额组用超大分片声明刷盘
	if in.Size < 0 || in.Size > 20<<30 {
		dto.Fail(c, 400, "文件大小非法（上限 20GB）")
		return
	}
	if in.ChunkSize < 1<<10 || in.ChunkSize > 64<<20 {
		in.ChunkSize = 8 << 20
	}
	p, d, err := h.Site.Fs.Resolve(x.user, x.group, in.PolicyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	if p.ReadOnly {
		dto.Fail(c, 403, "内置资源库为只读，不可修改")
		return
	}
	if !d.Capabilities().Upload {
		dto.Fail(c, 400, "该存储不支持上传")
		return
	}
	// 配额（用户个人覆盖优先，其次用户组）
	{
		var u model.User
		if model.DB.First(&u, x.user.ID).Error == nil {
			if limit, limited := effectiveQuotaBytes(&u, x.group); limited && u.UsedBytes+in.Size > limit {
				NotifyQuotaExceeded(x.user.ID, limit>>20, u.UsedBytes)
				dto.Fail(c, 403, fmt.Sprintf("超出配额：已用 %dMB / 上限 %dMB", u.UsedBytes>>20, limit>>20))
				return
			}
		}
	}
	// 活跃会话上限：防无限并发会话把 upload_tmp 写爆（每会话 = 一份完整分片暂存）
	var act int64
	model.DB.Model(&model.UploadSession{}).
		Where("user_id = ? AND status IN ?", x.user.ID, []string{"uploading", "merging"}).Count(&act)
	if act >= 10 {
		dto.Fail(c, 429, "进行中的上传会话过多（上限 10），请等待先前上传完成")
		return
	}
	sess, received, instant, err := h.Site.Fs.InitUpload(x.user.ID, in.PolicyID, parent, in.Name, in.Size, in.ChunkSize, in.Hash)
	if err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	if instant {
		// 秒传：直接从哈希索引落盘
		fh := h.Site.Fs.LookupHash(in.Hash, in.Size)
		if fh == nil {
			dto.Fail(c, 500, "秒传源丢失")
			return
		}
		phys, err := fscore.PhysicalOf(d, parent+"/"+in.Name)
		if err != nil {
			dto.Fail(c, 400, "仅本地存储支持秒传")
			return
		}
		vp := parent + "/" + in.Name
		// 覆盖同名文件时扣减旧文件大小，避免配额虚增
		var oldSize int64
		if old, err := d.Stat(vp); err == nil && !old.IsDir {
			oldSize = old.Size
		}
		if err := h.Site.Fs.InstantPut(fh, phys, x.user.ID, in.PolicyID, vp); err != nil {
			dto.Fail(c, 500, "秒传失败："+err.Error())
			return
		}
		// 游客秒传：硬链接会继承源文件 mtime（可能已远超 24h），
		// 而游客文件按 mtime 做 24h TTL 清理——必须把时间戳重置为"现在"，
		// 否则游客秒传的文件会被立即清掉
		if model.IsGuestUser(x.user) {
			_ = os.Chtimes(phys, time.Now(), time.Now())
		}
		// 配额原子提交（按落盘目录属主记账）：超限则回滚刚落盘文件（旧版本归档保留，可从版本历史恢复）
		if !commitQuotaUpload(c, x, quotaAccountOwner(x, p, d, vp), in.Size-oldSize) {
			fscore.HashPathGone(phys)
			_ = os.Remove(phys)
			return
		}
		touchPolicyUsage(p.ID) // 秒传落盘，盘用量立即失效重算
		middleware.Audit(c, "upload-instant", p.Name+":"+parent+"/"+in.Name)
		h.recordInstantTask(x.user.ID, parent, in.Name, in.Size)
		dto.OK(c, gin.H{"instant": true, "path": parent + "/" + in.Name})
		return
	}
	// 任务中心任务行（新建或失败后续传：重置为进行中）
	progress := 0
	if sess.TotalChunks > 0 {
		progress = int(float64(len(received)) / float64(sess.TotalChunks) * 100)
	}
	touchUploadTask(x.user.ID, uploadTaskProps{SID: sess.ID, Name: sess.Name, Parent: sess.ParentPath, Size: sess.Size, Phase: "chunk"}, progress)
	dto.OK(c, gin.H{
		"instant": false, "sessionId": sess.ID, "chunkSize": sess.ChunkSize,
		"totalChunks": sess.TotalChunks, "received": received,
	})
}

// recordInstantTask 秒传完成的任务行（一次性，无会话 sid）
func (h *UploadHandler) recordInstantTask(uid uint, parent, name string, size int64) {
	props, _ := json.Marshal(uploadTaskProps{Name: name, Parent: parent, Size: size, Instant: true})
	model.DB.Create(&model.Task{UserID: uid, Type: "upload", Status: "finished", Progress: 100, Props: string(props)})
}

// ---- 上传任务行（type=upload）：任务中心统一展示。
// 上传由客户端驱动、不提交 TaskPool 执行器，这里只维护任务行可见性/跨刷新状态。
// sid 存于 Props JSON，用 LIKE 定位（sid 为 hex 串，无 LIKE 通配符）。

type uploadTaskProps struct {
	SID     string `json:"sid,omitempty"`
	Name    string `json:"name"`
	Parent  string `json:"parent"`
	Size    int64  `json:"size"`
	Phase   string `json:"phase,omitempty"` // chunk 分片上传中 | merge 服务端合并中
	Instant bool   `json:"instant,omitempty"`
}

func uploadTaskPropsJSON(p uploadTaskProps) string {
	b, _ := json.Marshal(p)
	return string(b)
}

func findUploadTask(sid string) (model.Task, bool) {
	var t model.Task
	err := model.DB.Where("type = ? AND props LIKE ?", "upload", `%"sid":"`+sid+`"%`).
		Order("id DESC").First(&t).Error
	return t, err == nil
}

// touchUploadTask 确保会话对应任务行存在；error/canceled 的旧行重置为进行中（失败后重试）
func touchUploadTask(uid uint, p uploadTaskProps, progress int) {
	if p.SID == "" {
		return
	}
	var t model.Task
	err := model.DB.Where("type = ? AND props LIKE ?", "upload", `%"sid":"`+p.SID+`"%`).
		Order("id DESC").First(&t).Error
	if err != nil {
		model.DB.Create(&model.Task{UserID: uid, Type: "upload", Status: "processing", Progress: progress, Props: uploadTaskPropsJSON(p)})
		return
	}
	switch t.Status {
	case "error", "canceled":
		model.DB.Model(&t).Updates(map[string]interface{}{"status": "processing", "progress": progress, "error": "", "props": uploadTaskPropsJSON(p)})
	case "processing":
		if t.Progress < progress {
			model.DB.Model(&t).Updates(map[string]interface{}{"progress": progress, "props": uploadTaskPropsJSON(p)})
		}
	}
}

func finishUploadTask(sid string) {
	t, ok := findUploadTask(sid)
	if !ok {
		return
	}
	model.DB.Model(&t).Updates(map[string]interface{}{"status": "finished", "progress": 100, "error": ""})
	Notify(t.UserID, "task", "上传完成", "上传完成："+taskTargetName(&t), t.ID)
}

func failUploadTask(sid string, errMsg string) {
	t, ok := findUploadTask(sid)
	if !ok {
		return
	}
	model.DB.Model(&t).Updates(map[string]interface{}{"status": "error", "error": truncateRunes(errMsg, 500)})
	Notify(t.UserID, "task", "上传失败", "上传失败："+truncateRunes(errMsg, 120), t.ID)
}

func cancelUploadTask(sid string) {
	t, ok := findUploadTask(sid)
	if !ok {
		return
	}
	if t.Status == "queued" || t.Status == "processing" {
		model.DB.Model(&t).UpdateColumn("status", "canceled")
	}
}

func (h *UploadHandler) Chunk(c *gin.Context) {
	if !requireWritable(c) {
		return
	}
	x := ctxOf(c)
	sid := c.Param("sid")
	var idx int
	if _, err := fmt.Sscanf(c.Param("idx"), "%d", &idx); err != nil {
		dto.Fail(c, 400, "分片序号非法")
		return
	}
	var sess model.UploadSession
	if err := model.DB.First(&sess, "id = ?", sid).Error; err != nil || sess.UserID != x.user.ID {
		dto.Fail(c, 403, "会话不存在")
		return
	}
	got, err := h.Site.Fs.SaveChunk(sid, idx, c.Request.Body)
	if err != nil {
		// 落盘/记账失败（如远端 DB 抖动）：返回错误让客户端重试该分片（幂等覆盖写）
		log.Printf("[CloudPan] 保存分片 %s#%d 失败: %v", sid, idx, err)
		dto.Fail(c, 500, err.Error())
		return
	}
	// 任务行进度节流更新（每 5 片或全部收齐，避免远端 DB 每片一次额外写入）
	if got%5 == 0 || got == sess.TotalChunks {
		if t, ok := findUploadTask(sid); ok && t.Status == "processing" {
			model.DB.Model(&t).UpdateColumn("progress", int(float64(got)/float64(max(sess.TotalChunks, 1))*100))
		}
	}
	dto.OK(c, nil)
}

func (h *UploadHandler) Complete(c *gin.Context) {
	if !requireWritable(c) {
		return
	}
	x := ctxOf(c)
	var in struct {
		SessionID string `json:"sessionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var sess model.UploadSession
	if err := model.DB.First(&sess, "id = ?", in.SessionID).Error; err != nil || sess.UserID != x.user.ID {
		dto.Fail(c, 403, "会话不存在")
		return
	}
	// 幂等：已在合并/已完成时直接返回状态（客户端超时重试、双标签页撞车都安全）
	switch sess.Status {
	case "merging":
		dto.OK(c, gin.H{"status": "merging", "sessionId": sess.ID})
		return
	case "completed":
		dto.OK(c, gin.H{"status": "completed", "sessionId": sess.ID})
		return
	case "uploading":
		// 继续
	default:
		dto.Fail(c, 400, "会话已完成或已取消")
		return
	}
	received := sess.ReceivedList()
	if len(received) != sess.TotalChunks {
		dto.Fail(c, 400, fmt.Sprintf("分片不完整: %d/%d", len(received), sess.TotalChunks))
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, sess.PolicyID).Error; err != nil {
		dto.Fail(c, 400, "存储策略不存在")
		return
	}
	if p.ReadOnly {
		dto.Fail(c, 403, "内置资源库为只读，不可修改")
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, x.user)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	// 管理员本地盘视图（AdminLocalDriver）同样支持分块上传：按目标路径路由到具体物理根
	if fscore.LocalRoot(d, sess.ParentPath+"/"+sess.Name) == nil {
		dto.Fail(c, 400, "该存储类型暂不支持分块上传")
		return
	}
	// 覆盖同名文件时扣减旧文件大小，避免配额虚增（合并落位后结算）
	var oldSize int64
	if old, err := d.Stat(sess.ParentPath + "/" + sess.Name); err == nil && !old.IsDir {
		oldSize = old.Size
	}
	// 状态跃迁 uploading → merging（条件更新防并发双提交），并清空上轮失败原因
	res := model.DB.Model(&model.UploadSession{}).
		Where("id = ? AND status = ?", sess.ID, "uploading").
		Updates(map[string]interface{}{"status": "merging", "error": ""})
	if res.Error != nil {
		log.Printf("[CloudPan] 上传会话 %s 跃迁 merging 失败: %v", sess.ID, res.Error)
		dto.Fail(c, 500, "启动合并失败，请重试")
		return
	}
	if res.RowsAffected == 0 {
		// 并发下已被别处置为 merging
		dto.OK(c, gin.H{"status": "merging", "sessionId": sess.ID})
		return
	}
	// 合并槽位：已有 2 个合并进行中则回滚状态，客户端稍后重试 complete 即可
	select {
	case mergeSem <- struct{}{}:
	default:
		model.DB.Model(&model.UploadSession{}).
			Where("id = ? AND status = ?", sess.ID, "merging").UpdateColumn("status", "uploading")
		dto.Fail(c, 503, "服务端合并繁忙，请稍后重试")
		return
	}
	// 任务行：进入合并阶段（进度 100，等待落盘）
	if t, ok := findUploadTask(sess.ID); ok && t.Status == "processing" {
		model.DB.Model(&t).Updates(map[string]interface{}{
			"progress": 100,
			"props":    uploadTaskPropsJSON(uploadTaskProps{SID: sess.ID, Name: sess.Name, Parent: sess.ParentPath, Size: sess.Size, Phase: "merge"}),
		})
	}
	go h.runMerge(x, &sess, &p, oldSize)
	dto.OK(c, gin.H{"status": "merging", "sessionId": sess.ID})
}

// runMerge 服务端异步合并（百度网盘式）：complete 立即返回，客户端关页面/断网
// 不影响合并进行；任务中心跨刷新可见 合并中 → 完成/失败。
func (h *UploadHandler) runMerge(x ctx3, sess *model.UploadSession, p *model.Policy, oldSize int64) {
	defer func() { <-mergeSem }()
	d, err := h.Site.Fs.DriverFor(p, x.user)
	if err != nil {
		h.mergeFailed(sess, "获取存储驱动失败: "+err.Error())
		return
	}
	resolver := func(vp string) (string, error) { return fscore.PhysicalOf(d, vp) }
	entry, err := h.Site.Fs.CompleteUpload(sess, resolver)
	if err != nil {
		h.mergeFailed(sess, err.Error())
		return
	}
	targetVP, _ := fscore.Join(sess.ParentPath, sess.Name)
	// 配额原子提交（异步上下文无 HTTP 响应，按落盘目录属主记账）：超限回滚刚落盘文件 + 站内通知
	if ok, msg := commitQuotaCore(x, quotaAccountOwner(x, p, d, targetVP), entry.Size-oldSize); !ok {
		if phys, perr := fscore.PhysicalOf(d, targetVP); perr == nil {
			fscore.HashPathGone(phys)
			_ = os.Remove(phys)
		}
		h.mergeFailed(sess, msg)
		return
	}
	// 审计（异步路径无 gin 上下文，直接落库；IP 留空）
	model.DB.Create(&model.AuditLog{UserID: x.user.ID, Username: x.user.Username, Action: "upload", Detail: p.Name + ":" + targetVP})
	touchPolicyUsage(p.ID) // 合并落盘，盘用量立即失效重算
	finishUploadTask(sess.ID)
}

// mergeFailed 合并失败：会话回 uploading（客户端可重发 complete 重试合并），
// 失败原因写入会话与任务行供状态轮询/任务中心展示。
// 条件更新：会话若已被取消（aborted）则不回滚、不动状态。
func (h *UploadHandler) mergeFailed(sess *model.UploadSession, errMsg string) {
	log.Printf("[CloudPan] 上传合并失败 %s: %v", sess.ID, errMsg)
	model.DB.Model(&model.UploadSession{}).
		Where("id = ? AND status = ?", sess.ID, "merging").
		Updates(map[string]interface{}{"status": "uploading", "error": truncateRunes(errMsg, 500)})
	failUploadTask(sess.ID, errMsg)
}

func (h *UploadHandler) Abort(c *gin.Context) {
	x := ctxOf(c)
	if err := h.Site.Fs.AbortUpload(c.Param("sid"), x.user.ID); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	cancelUploadTask(c.Param("sid"))
	dto.OK(c, nil)
}

func (h *UploadHandler) Status(c *gin.Context) {
	x := ctxOf(c)
	sid := c.Param("sid")
	var sess model.UploadSession
	if err := model.DB.First(&sess, "id = ?", sid).Error; err != nil || sess.UserID != x.user.ID {
		dto.Fail(c, 403, "会话不存在")
		return
	}
	// 解析 received JSON
	received := []int{}
	if err := json.Unmarshal([]byte(sess.Received), &received); err != nil {
		received = []int{}
	}
	// 计算进度
	progress := 0
	if sess.TotalChunks > 0 {
		progress = int(float64(len(received)) / float64(sess.TotalChunks) * 100)
	}
	dto.OK(c, gin.H{
		"status":      sess.Status,
		"progress":    progress,
		"received":    len(received),
		"totalChunks": sess.TotalChunks,
		"size":        sess.Size,
		"uploaded":    int64(len(received)) * sess.ChunkSize,
		"error":       sess.Error, // 异步合并失败原因（空 = 无）
	})
}

var _ = errors.New
