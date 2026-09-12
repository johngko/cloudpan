package handler

import (
	"encoding/json"
	"errors"
	"fmt"
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
		// 配额原子提交：超限则回滚刚落盘文件（旧版本归档保留，可从版本历史恢复）
		if !commitQuotaUpload(c, x, in.Size-oldSize) {
			fscore.HashPathGone(phys)
			_ = os.Remove(phys)
			return
		}
		middleware.Audit(c, "upload-instant", p.Name+":"+parent+"/"+in.Name)
		dto.OK(c, gin.H{"instant": true, "path": parent + "/" + in.Name})
		return
	}
	dto.OK(c, gin.H{
		"instant": false, "sessionId": sess.ID, "chunkSize": sess.ChunkSize,
		"totalChunks": sess.TotalChunks, "received": received,
	})
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
	if err := h.Site.Fs.SaveChunk(sid, idx, c.Request.Body); err != nil {
		dto.Fail(c, 500, err.Error())
		return
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
	if sess.Status != "uploading" {
		dto.Fail(c, 400, "会话已完成或已取消")
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
	resolver := func(vp string) (string, error) { return fscore.PhysicalOf(d, vp) }
	if _, ok := d.(*fscore.LocalDriver); !ok {
		dto.Fail(c, 400, "该存储类型暂不支持分块上传")
		return
	}
	// 覆盖同名文件时扣减旧文件大小，避免配额虚增
	var oldSize int64
	if old, err := d.Stat(sess.ParentPath + "/" + sess.Name); err == nil && !old.IsDir {
		oldSize = old.Size
	}
	entry, err := h.Site.Fs.CompleteUpload(&sess, resolver)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	targetVP, _ := fscore.Join(sess.ParentPath, sess.Name)
	// 配额原子提交：超限则回滚刚落盘文件（会话已 completed，用户清理出空间后重新上传即可）
	if !commitQuotaUpload(c, x, entry.Size-oldSize) {
		if phys, perr := fscore.PhysicalOf(d, targetVP); perr == nil {
			fscore.HashPathGone(phys)
			_ = os.Remove(phys)
		}
		return
	}
	middleware.Audit(c, "upload", p.Name+":"+targetVP)
	dto.OK(c, gin.H{"instant": false, "entry": entry, "path": targetVP})
}

func (h *UploadHandler) Abort(c *gin.Context) {
	x := ctxOf(c)
	if err := h.Site.Fs.AbortUpload(c.Param("sid"), x.user.ID); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
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
	})
}

var _ = errors.New
