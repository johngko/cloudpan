package handler

// B4 文件收集（CollectOnly 分享）：匿名访客分片上传。
// 会话复用普通上传的 UploadSession/分片管道，但属主记分享创建者（UserID），
// 并用 ShareToken 绑定分享：chunk/complete 凭「token + 提取码 st」校验（guard），
// 不要求登录。落盘目录固定为分享根（扁平收集），配额计入创建者（发起收集即其责任）。
// 秒传对匿名关闭（hash 传空）：避免访客借秒传探测他人盘内容，也让收集必然产生副本。

import (
	"fmt"
	"log"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
)

// 单分享并发收集会话上限（防刷爆 upload_tmp）
const collectActiveCap = 5

type collectInitIn struct {
	Name      string `json:"name" binding:"required"`
	Size      int64  `json:"size" binding:"required"`
	ChunkSize int64  `json:"chunkSize"`
}

func (h *ShareHandler) CollectInit(c *gin.Context) {
	sh, owner, ok := h.guard(c)
	if !ok {
		return
	}
	if !sh.CollectOnly || !sh.IsDir {
		dto.Fail(c, 400, "该链接不是文件收集分享")
		return
	}
	var in collectInitIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if in.Size <= 0 || in.Size > 2<<30 {
		dto.Fail(c, 400, "文件大小非法（收集模式单文件上限 2GB）")
		return
	}
	if in.ChunkSize < 1<<10 || in.ChunkSize > 64<<20 {
		in.ChunkSize = 4 << 20
	}
	name, err := fscore.SanitizeName(in.Name)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	parent, err := fscore.Clean(sh.Path)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	if _, err := fscore.Join(parent, name); err != nil {
		dto.Fail(c, 400, "文件名非法")
		return
	}
	// 落盘属主 = 分享创建者：按属主解析驱动 + 扣配额
	var g model.UserGroup
	if err := model.DB.First(&g, owner.GroupID).Error; err != nil {
		dto.Fail(c, 400, "分享创建者用户组不存在")
		return
	}
	if quotaExceeded(owner, &g, in.Size) {
		limit, _ := effectiveQuotaBytes(owner, &g)
		dto.Fail(c, 403, fmt.Sprintf("收集目标空间不足（创建者配额已满，上限 %dMB）", limit>>20))
		return
	}
	var act int64
	model.DB.Model(&model.UploadSession{}).
		Where("share_token = ? AND status IN ?", sh.Token, []string{"uploading", "merging"}).Count(&act)
	if act >= collectActiveCap {
		dto.Fail(c, 429, "该收集链接进行中的上传过多，请稍后再试")
		return
	}
	p, d, err := h.Site.Fs.Resolve(owner, &g, sh.PolicyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	if !d.Capabilities().Upload || p.ReadOnly {
		dto.Fail(c, 400, "该存储不支持上传")
		return
	}
	// hash 传空：关闭秒传（匿名场景见文件头注释）
	sess, received, _, err := h.Site.Fs.InitUpload(owner.ID, 0, sh.PolicyID, parent, name, in.Size, in.ChunkSize, "")
	if err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	if err := model.DB.Model(&model.UploadSession{}).Where("id = ?", sess.ID).
		UpdateColumn("share_token", sh.Token).Error; err != nil {
		dto.Fail(c, 500, "会话登记失败")
		return
	}
	middleware.Audit(c, "collect-init", p.Name+":"+parent+"/"+name)
	dto.OK(c, gin.H{
		"sessionId": sess.ID, "chunkSize": sess.ChunkSize,
		"totalChunks": sess.TotalChunks, "received": received,
	})
}

// collectSession 校验分片/complete 请求对应一个合法的本分享匿名会话
func (h *ShareHandler) collectSession(c *gin.Context, sid string) (*model.Share, *model.UploadSession, bool) {
	sh, _, ok := h.guard(c)
	if !ok {
		return nil, nil, false
	}
	if !sh.CollectOnly {
		dto.Fail(c, 400, "该链接不是文件收集分享")
		return nil, nil, false
	}
	var sess model.UploadSession
	if err := model.DB.First(&sess, "id = ?", sid).Error; err != nil || sess.ShareToken != sh.Token {
		dto.Fail(c, 403, "会话不存在")
		return nil, nil, false
	}
	return sh, &sess, true
}

func (h *ShareHandler) CollectChunk(c *gin.Context) {
	var idx int
	if _, err := fmt.Sscanf(c.Param("idx"), "%d", &idx); err != nil {
		dto.Fail(c, 400, "分片序号非法")
		return
	}
	_, sess, ok := h.collectSession(c, c.Param("sid"))
	if !ok {
		return
	}
	if sess.Status != "uploading" {
		dto.Fail(c, 400, "会话已完成或已取消")
		return
	}
	got, err := h.Site.Fs.SaveChunk(sess.ID, idx, c.Request.Body)
	if err != nil {
		log.Printf("[CloudPan] 收集分片 %s#%d 失败: %v", sess.ID, idx, err)
		dto.Fail(c, 500, err.Error())
		return
	}
	_ = got
	dto.OK(c, nil)
}

func (h *ShareHandler) CollectComplete(c *gin.Context) {
	var in struct {
		SessionID string `json:"sessionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	sh, sess, ok := h.collectSession(c, in.SessionID)
	if !ok {
		return
	}
	// 幂等（同普通 Complete）
	switch sess.Status {
	case "merging":
		dto.OK(c, gin.H{"status": "merging", "sessionId": sess.ID})
		return
	case "completed":
		dto.OK(c, gin.H{"status": "completed", "sessionId": sess.ID})
		return
	case "uploading":
	default:
		dto.Fail(c, 400, "会话已完成或已取消")
		return
	}
	received := sess.ReceivedList()
	if len(received) != sess.TotalChunks {
		dto.Fail(c, 400, fmt.Sprintf("分片不完整: %d/%d", len(received), sess.TotalChunks))
		return
	}
	var owner model.User
	if err := model.DB.First(&owner, sh.UserID).Error; err != nil {
		dto.Fail(c, 400, "分享创建者不存在")
		return
	}
	var g model.UserGroup
	if err := model.DB.First(&g, owner.GroupID).Error; err != nil {
		dto.Fail(c, 400, "分享创建者用户组不存在")
		return
	}
	var p model.Policy
	if err := model.DB.First(&p, sess.PolicyID).Error; err != nil {
		dto.Fail(c, 400, "存储策略不存在")
		return
	}
	d, err := h.Site.Fs.DriverFor(&p, &owner)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	var oldSize int64
	if old, err := d.Stat(sess.ParentPath + "/" + sess.Name); err == nil && !old.IsDir {
		oldSize = old.Size
	}
	res := model.DB.Model(&model.UploadSession{}).
		Where("id = ? AND status = ?", sess.ID, "uploading").
		Updates(map[string]interface{}{"status": "merging", "error": ""})
	if res.Error != nil {
		dto.Fail(c, 500, "启动合并失败，请重试")
		return
	}
	if res.RowsAffected == 0 {
		dto.OK(c, gin.H{"status": "merging", "sessionId": sess.ID})
		return
	}
	select {
	case mergeSem <- struct{}{}:
	default:
		model.DB.Model(&model.UploadSession{}).
			Where("id = ? AND status = ?", sess.ID, "merging").UpdateColumn("status", "uploading")
		dto.Fail(c, 503, "服务端合并繁忙，请稍后重试")
		return
	}
	up := &UploadHandler{Site: h.Site}
	go up.runMerge(ctx3{user: &owner, group: &g}, sess, &p, oldSize)
	middleware.Audit(c, "collect-complete", sess.Name)
	// 通知创建者：有人交了文件
	Notify(owner.ID, "task", "收到收集文件", fmt.Sprintf("文件收集「%s」收到新文件：%s", sh.Name, sess.Name), 0)
	dto.OK(c, gin.H{"status": "merging", "sessionId": sess.ID})
}
