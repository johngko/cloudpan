package handler

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// UserShareHandler 站内用户共享：把目录共享给其他注册用户（ro 只读 / rw 可写）
type UserShareHandler struct{ Site *SiteHandler }

// Users 列出可共享目标用户（登录即可见，仅基础字段）。
// 游客（共享账号）无共享发起能力，不开放用户枚举接口
func (h *UserShareHandler) Users(c *gin.Context) {
	if model.IsGuestUser(ctxOf(c).user) {
		dto.Fail(c, 403, "游客不能使用该功能")
		return
	}
	var items []model.User
	model.DB.Where("disabled = false").Select("id, username, nickname, avatar").Find(&items)
	dto.OK(c, items)
}

// Groups 列出用户组（共享对话框选组用；登录即可见，仅 id+名称）。游客同上
func (h *UserShareHandler) Groups(c *gin.Context) {
	if model.IsGuestUser(ctxOf(c).user) {
		dto.Fail(c, 403, "游客不能使用该功能")
		return
	}
	var items []model.UserGroup
	model.DB.Select("id, name").Order("id").Find(&items)
	dto.OK(c, items)
}

type userShareCreateIn struct {
	PolicyID   uint   `json:"policyId" binding:"required"`
	Path       string `json:"path" binding:"required"`
	TargetType string `json:"targetType"` // user | group | all，缺省 user（兼容旧客户端）
	TargetID   uint   `json:"targetId"`
	Perm       string `json:"perm"`
}

func (h *UserShareHandler) Create(c *gin.Context) {
	x := ctxOf(c)
	// 管理员豁免用户组共享限制（用户与管理员均可发起共享，目标可选所有人/组/用户）
	if x.user.Role != "admin" && !x.group.AllowShare {
		dto.Fail(c, 403, "当前用户组不允许共享")
		return
	}
	var in userShareCreateIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	tt := in.TargetType
	if tt == "" {
		tt = "user"
	}
	if tt != "user" && tt != "group" && tt != "all" {
		dto.Fail(c, 400, "共享范围非法")
		return
	}
	targetID := in.TargetID
	targetName := ""
	switch tt {
	case "all":
		targetID = 0
		targetName = "所有人"
	case "group":
		if targetID == 0 {
			dto.Fail(c, 400, "请选择用户组")
			return
		}
		var g model.UserGroup
		if err := model.DB.First(&g, targetID).Error; err != nil {
			dto.Fail(c, 404, "用户组不存在")
			return
		}
		targetName = g.Name
	default: // user
		if targetID == 0 {
			dto.Fail(c, 400, "请选择用户")
			return
		}
		if targetID == x.user.ID {
			dto.Fail(c, 400, "不能共享给自己")
			return
		}
		var target model.User
		if err := model.DB.Where("id = ? AND disabled = false", targetID).First(&target).Error; err != nil {
			dto.Fail(c, 404, "目标用户不存在")
			return
		}
		targetName = target.Username
	}
	p, d, err := h.Site.Fs.Resolve(x.user, x.group, in.PolicyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	// 内置资源库（builtin，如 T:）仅管理员可见/可共享：非管理员一律不能把内置库共享给他人
	if p.Type == "builtin" && x.user.Role != "admin" {
		dto.Fail(c, 403, "内置资源库不能共享")
		return
	}
	vp, err := fscore.Clean(in.Path)
	if err != nil || vp == "" {
		dto.Fail(c, 400, "请选择要共享的文件夹")
		return
	}
	e, err := d.Stat(vp)
	if err != nil {
		dto.Fail(c, 404, "目录不存在")
		return
	}
	if !e.IsDir {
		dto.Fail(c, 400, "只能共享文件夹")
		return
	}
	perm := in.Perm
	if perm != "rw" {
		perm = "ro"
	}
	// 整盘共享（path="/"）：根目录 Stat 名为 "/"，展示名改用策略名+盘符，如「本地磁盘 (D:)」
	name := e.Name
	if vp == "/" {
		name = p.Name
		if p.Letter != "" {
			name += " (" + p.Letter + ":)"
		}
	}
	// 去重：同范围同目标同目录只保留一条
	var n int64
	model.DB.Model(&model.UserShare{}).
		Where("owner_id = ? AND target_type = ? AND target_id = ? AND policy_id = ? AND path = ?", x.user.ID, tt, targetID, in.PolicyID, vp).Count(&n)
	if n > 0 {
		dto.Fail(c, 400, "已共享给该范围")
		return
	}
	us := model.UserShare{OwnerID: x.user.ID, TargetType: tt, TargetID: targetID, PolicyID: in.PolicyID, Path: vp, Name: name, Perm: perm}
	if err := model.DB.Create(&us).Error; err != nil {
		dto.Fail(c, 500, "创建共享失败")
		return
	}
	middleware.Audit(c, "usershare", fmt.Sprintf("共享 %s 给 %s (%s)", vp, targetName, perm))
	dto.OK(c, us)
}

// Mine 我共享出去的
func (h *UserShareHandler) Mine(c *gin.Context) {
	x := ctxOf(c)
	var items []model.UserShare
	model.DB.Where("owner_id = ?", x.user.ID).Order("id DESC").Find(&items)
	dto.OK(c, h.decorate(items))
}

// shareVisibleWhere 三路可见性条件：共享给我本人 / 共享给我所在用户组 / 共享给所有人
// （target_type 空串 = 历史数据，按 user 处理；AND 优先级高于 OR，括号已显式标注）
func shareVisibleWhere(uid, gid uint) (string, []interface{}) {
	return "(target_type = 'user' OR target_type = '') AND target_id = ? OR (target_type = 'group' AND target_id = ?) OR target_type = 'all'",
		[]interface{}{uid, gid}
}

// WithMe 共享给我的（含共享给我所在用户组、共享给所有人的）
func (h *UserShareHandler) WithMe(c *gin.Context) {
	if !shareFeatureOn(c) {
		return
	}
	x := ctxOf(c)
	var items []model.UserShare
	q, args := shareVisibleWhere(x.user.ID, x.user.GroupID)
	model.DB.Where(q, args...).Order("id DESC").Find(&items)
	dto.OK(c, h.decorate(items))
}

func (h *UserShareHandler) decorate(items []model.UserShare) []gin.H {
	out := make([]gin.H, 0, len(items))
	for _, s := range items {
		var owner model.User
		model.DB.Select("username, nickname").First(&owner, s.OwnerID)
		tt := s.TargetType
		if tt == "" {
			tt = "user"
		}
		targetName := "所有人"
		if tt == "user" {
			var tu model.User
			model.DB.Select("username").First(&tu, s.TargetID)
			targetName = tu.Username
		} else if tt == "group" {
			var g model.UserGroup
			model.DB.Select("name").First(&g, s.TargetID)
			targetName = g.Name
		}
		out = append(out, gin.H{
			"id": s.ID, "name": s.Name, "perm": s.Perm, "path": s.Path,
			"targetType": tt, "targetName": targetName,
			"ownerId": s.OwnerID, "owner": owner.Nickname, "ownerName": owner.Username,
			"createdAt": s.CreatedAt,
		})
	}
	return out
}

func (h *UserShareHandler) Cancel(c *gin.Context) {
	x := ctxOf(c)
	model.DB.Where("id = ? AND owner_id = ?", c.Param("id"), x.user.ID).Delete(&model.UserShare{})
	dto.OK(c, nil)
}

// ---- 共享内容访问（被共享者视角） ----

func (h *UserShareHandler) loadForTarget(c *gin.Context) (*model.UserShare, fscore.Driver, bool) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	return h.loadShareByID(c, uint(id))
}

// loadShareByID 按显式 id 加载共享（供 /office/config?shareId= 等非 :id 路由复用）
func (h *UserShareHandler) loadShareByID(c *gin.Context, id uint) (*model.UserShare, fscore.Driver, bool) {
	x := ctxOf(c)
	var sh model.UserShare
	q, args := shareVisibleWhere(x.user.ID, x.user.GroupID)
	if err := model.DB.Where("id = ? AND ("+q+")", append([]interface{}{id}, args...)...).First(&sh).Error; err != nil {
		dto.Fail(c, 404, "共享不存在或已取消")
		return nil, nil, false
	}
	var p model.Policy
	if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
		dto.Fail(c, 404, "存储已失效")
		return nil, nil, false
	}
	if p.Status == "disabled" {
		dto.Fail(c, 400, "存储已停用")
		return nil, nil, false
	}
	// 共享内容属于创建者：必须用创建者的隔离目录解析
	d, err := h.Site.Fs.DriverForShare(&p, userOfID(sh.OwnerID))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return nil, nil, false
	}
	return &sh, d, true
}

// full 计算 rel 相对共享根的绝对虚拟路径（防越界）
func userShareFull(sh *model.UserShare, rel string) (string, bool) {
	rel = strings.TrimPrefix(rel, "/")
	if sh.Path == "/" {
		// 整盘共享：Clean 已拒绝 ".." 穿越，任何规整后的绝对路径都在根内
		full, err := fscore.Clean("/" + rel)
		return full, err == nil
	}
	full, err := fscore.Clean(sh.Path + "/" + rel)
	if err != nil {
		return "", false
	}
	if full != sh.Path && !strings.HasPrefix(full, sh.Path+"/") {
		return "", false
	}
	return full, true
}

// shareFeatureOn 消费端点（看共享）只受全局「内部共享」开关约束：
// 共享目标由创建者显式指定（用户/组/所有人），被共享者本人的 usershare 权限
// 只控制"发起共享"，不能反过来把自己被共享到的内容挡住（否则共享给访客永远不可见）
func shareFeatureOn(c *gin.Context) bool {
	if !model.AppEnabled("usershare") {
		dto.Fail(c, 403, "该功能已被管理员停用")
		return false
	}
	return true
}

// bumpUserShare 共享访问计数原子自增（共享审计展示用）：col = views | downloads
func bumpUserShare(id uint, col string) {
	model.DB.Model(&model.UserShare{}).Where("id = ?", id).
		UpdateColumn(col, gorm.Expr(col+" + 1"))
}

// Info 共享根信息
func (h *UserShareHandler) Info(c *gin.Context) {
	if !shareFeatureOn(c) {
		return
	}
	sh, _, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	var owner model.User
	model.DB.Select("nickname, username").First(&owner, sh.OwnerID)
	dto.OK(c, gin.H{"name": sh.Name, "perm": sh.Perm, "owner": owner.Nickname, "ownerName": owner.Username})
}

// List 列出共享目录内容（rel 相对共享根）
func (h *UserShareHandler) List(c *gin.Context) {
	if !shareFeatureOn(c) {
		return
	}
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	full, ok := userShareFull(sh, c.Query("rel"))
	if !ok {
		dto.Fail(c, 403, "路径越界")
		return
	}
	entries, err := d.List(full)
	if err != nil {
		dto.Fail(c, 404, "目录不存在")
		return
	}
	bumpUserShare(sh.ID, "views")
	rootPrefix := sh.Path + "/"
	items := make([]gin.H, 0, len(entries))
	for _, e := range entries {
		childFull, _ := fscore.Join(full, e.Name)
		rel, _ := fscore.RelTo(sh.Path, childFull)
		items = append(items, gin.H{
			"name": e.Name, "isDir": e.IsDir, "size": e.Size, "modTime": e.ModTime,
			"ext": e.Ext, "relPath": rel,
		})
	}
	dto.OK(c, gin.H{"items": items, "perm": sh.Perm, "name": sh.Name, "rel": strings.TrimPrefix(c.Query("rel"), "/")})
	_ = rootPrefix
}

// Raw 共享文件预览（inline 流式）
func (h *UserShareHandler) Raw(c *gin.Context) {
	if !shareFeatureOn(c) {
		return
	}
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	full, ok := userShareFull(sh, c.Query("rel"))
	if !ok {
		dto.FailHTTP(c, 403, "路径越界")
		return
	}
	e, err := d.Stat(full)
	if err != nil || e.IsDir {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	rc, err := d.Open(full)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	bumpUserShare(sh.ID, "views")
	defer rc.Close()
	rc = wrapThrottle(rc, ctxOf(c).group.DownloadSpeedKB)
	c.Header("Content-Disposition", fmt.Sprintf(`%s; filename*=UTF-8''%s`, dispositionOf(e.Name), urlEscape(e.Name)))
	httpServe(c, e.Name, modTimeOf(rc), rc)
}

// Download 共享文件下载（文件直下 / 目录 zip）
func (h *UserShareHandler) Download(c *gin.Context) {
	if !shareFeatureOn(c) {
		return
	}
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	full, ok := userShareFull(sh, c.Query("rel"))
	if !ok {
		dto.FailHTTP(c, 403, "路径越界")
		return
	}
	e, err := d.Stat(full)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	bumpUserShare(sh.ID, "downloads")
	if e.IsDir {
		tmpZip := tempZipName()
		defer osRemove(tmpZip)
		if _, err := h.Site.Fs.BuildZip(d, []fscore.ZipItem{{Path: full}}, tmpZip, nil); err != nil {
			dto.FailHTTP(c, 500, "打包失败")
			return
		}
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(e.Name+".zip")))
		c.File(tmpZip)
		return
	}
	rc, err := d.Open(full)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	rc = wrapThrottle(rc, ctxOf(c).group.DownloadSpeedKB)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(e.Name)))
	httpServe(c, e.Name, modTimeOf(rc), rc)
}

// Mkdir 共享目录内新建文件夹（rw）
func (h *UserShareHandler) Mkdir(c *gin.Context) {
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	if sh.Perm != "rw" {
		dto.Fail(c, 403, "此共享为只读")
		return
	}
	var in struct {
		Rel  string `json:"rel"`
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	full, ok := userShareFull(sh, in.Rel)
	if !ok {
		dto.Fail(c, 403, "路径越界")
		return
	}
	vp, err := fscore.Join(full, in.Name)
	if err != nil {
		dto.Fail(c, 400, "名称非法")
		return
	}
	if err := d.Mkdir(vp); err != nil {
		dto.Fail(c, 400, "创建失败："+err.Error())
		return
	}
	dto.OK(c, nil)
}

// Upload 共享目录内上传（rw，multipart 直传）
func (h *UserShareHandler) Upload(c *gin.Context) {
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	if sh.Perm != "rw" {
		dto.Fail(c, 403, "此共享为只读")
		return
	}
	fh, err := c.FormFile("file")
	if err != nil {
		dto.Fail(c, 400, "缺少文件")
		return
	}
	full, ok := userShareFull(sh, c.PostForm("rel"))
	if !ok {
		dto.Fail(c, 403, "路径越界")
		return
	}
	vp, err := fscore.Join(full, fh.Filename)
	if err != nil {
		dto.Fail(c, 400, "文件名非法")
		return
	}
	// 覆盖同名文件、落盘、秒传台账一致性统一由 LocalDriver.CreateFile 负责
	// （覆盖前摘掉旧内容的副本记录 + 边写边算哈希登记新内容），调用点不再自行实现
	//
	// B13 协作硬锁：目标文件被他人编辑器持锁时拒绝（覆盖写会打断编辑会话）
	if rejectIfEditLocked(c, sh.PolicyID, vp) {
		return
	}
	// 配额：共享盘写入落在「共享创建者」的隔离目录里（用的是创建者的盘），
	// 因此按创建者的配额预检并计入创建者的用量；超额则拒绝，不让被共享者把创建者的空间写爆
	owner := userOfID(sh.OwnerID)
	add := fh.Size - existingSize(d, vp)
	if !ownerQuotaPrecheck(c, owner, add) {
		return
	}
	f, err := fh.Open()
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	defer f.Close()
	if err := d.CreateFile(vp, f); err != nil {
		dto.Fail(c, 500, "上传失败："+err.Error())
		return
	}
	// 原子提交：预检与落盘之间仍可能被其他写入挤爆配额，这里以条件更新兜底，超限回滚刚落盘的文件
	if owner != nil {
		x := ctxOf(c)
		if !commitQuotaUpload(c, x, owner, add) {
			if phys, perr := fscore.PhysicalOf(d, vp); perr == nil {
				fscore.HashPathGone(phys)
				_ = os.Remove(phys)
			}
			return
		}
	}
	dto.OK(c, gin.H{"path": vp})
}

// UploadInit 共享盘「分片」上传的初始化（rw）。
//
// 与普通上传共用同一条链路：本接口只建会话，之后客户端直接复用
// /api/upload/chunk/:sid/:idx、/api/upload/complete、/api/upload/:sid/status、DELETE /api/upload/:sid
// （这些端点按会话归属鉴权，上传者即会话属主）。
// 唯一区别是会话里记下「落盘属主 = 共享创建者」：合并时按创建者的隔离目录落盘、计入创建者的配额，
// 于是大文件也能走分片 + 秒传 + 断点续传 + 重试，而不是单次 FormData 直传。
func (h *UserShareHandler) UploadInit(c *gin.Context) {
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	if sh.Perm != "rw" {
		dto.Fail(c, 403, "此共享为只读")
		return
	}
	var in struct {
		Rel       string `json:"rel"`
		Name      string `json:"name" binding:"required"`
		Size      int64  `json:"size"`
		ChunkSize int64  `json:"chunkSize"`
		Hash      string `json:"hash"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	// 与普通上传同一套约束：单文件 20GB 上限、分片尺寸收敛到 [1KB, 64MB]
	if in.Size < 0 || in.Size > 20<<30 {
		dto.Fail(c, 400, "文件大小非法（上限 20GB）")
		return
	}
	if in.ChunkSize < 1<<10 || in.ChunkSize > 64<<20 {
		in.ChunkSize = 8 << 20
	}
	if sn, err := fscore.SanitizeName(in.Name); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	} else {
		in.Name = sn
	}
	full, ok := userShareFull(sh, in.Rel)
	if !ok {
		dto.Fail(c, 403, "路径越界")
		return
	}
	vp, err := fscore.Join(full, in.Name)
	if err != nil {
		dto.Fail(c, 400, "文件名非法")
		return
	}
	// B13 协作硬锁（Init 早失败 + Complete 兜底在普通上传链路，共享 Init 这里查一次）
	if rejectIfEditLocked(c, sh.PolicyID, vp) {
		return
	}
	x := ctxOf(c)
	owner := userOfID(sh.OwnerID)
	// 活跃会话上限（与普通上传一致）：防并发会话把 upload_tmp 写爆
	var act int64
	model.DB.Model(&model.UploadSession{}).
		Where("user_id = ? AND status IN ?", x.user.ID, []string{"uploading", "merging"}).Count(&act)
	if act >= 10 {
		dto.Fail(c, 429, "进行中的上传会话过多（上限 10），请等待先前上传完成")
		return
	}
	// 配额预检：按共享创建者（落盘属主）的配额
	if !ownerQuotaPrecheck(c, owner, in.Size-existingSize(d, vp)) {
		return
	}
	sess, received, instant, err := h.Site.Fs.InitUpload(x.user.ID, sh.OwnerID, sh.PolicyID, full, in.Name, in.Size, in.ChunkSize, in.Hash)
	if err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	if instant {
		var p model.Policy
		if err := model.DB.First(&p, sh.PolicyID).Error; err != nil {
			dto.Fail(c, 400, "存储策略不存在")
			return
		}
		up := &UploadHandler{Site: h.Site}
		up.instantUpload(c, x, owner, &p, d, vp, full, in.Name, in.Hash, in.Size)
		return
	}
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

// ownerQuotaPrecheck 共享盘写入的配额预检：按落盘目录属主（= 共享创建者）的配额判定。
// 未限制配额（QuotaMB=0 / 跟随的组不限量）时放行；超限时写 403 并给属主发站内通知。
// 提示语点名"共享创建者"，避免被共享者看到一串数字却不知道是谁的空间满了。
func ownerQuotaPrecheck(c *gin.Context, owner *model.User, add int64) bool {
	if owner == nil || add <= 0 {
		return true
	}
	var u model.User
	if err := model.DB.Select("id", "quota_mb", "group_id", "used_bytes").First(&u, owner.ID).Error; err != nil {
		return true
	}
	var g model.UserGroup
	if u.GroupID > 0 {
		if err := model.DB.First(&g, u.GroupID).Error; err != nil {
			return true
		}
	}
	limit, limited := effectiveQuotaBytes(&u, &g)
	if !limited || u.UsedBytes+add <= limit {
		return true
	}
	NotifyQuotaExceeded(u.ID, limit>>20, u.UsedBytes)
	dto.Fail(c, 403, fmt.Sprintf("共享创建者的存储空间已满：已用 %dMB / 上限 %dMB", u.UsedBytes>>20, limit>>20))
	return false
}

// Delete 共享内容删除（rw）
func (h *UserShareHandler) Delete(c *gin.Context) {
	sh, d, ok := h.loadForTarget(c)
	if !ok {
		return
	}
	if sh.Perm != "rw" {
		dto.Fail(c, 403, "此共享为只读")
		return
	}
	var in struct {
		Rels []string `json:"rels" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	// B13 协作硬锁：不能删除他人正在编辑的文件
	for _, rel := range in.Rels {
		if full, ok := userShareFull(sh, rel); ok {
			if rejectIfEditLocked(c, sh.PolicyID, full) {
				return
			}
		}
	}
	var released int64
	for _, rel := range in.Rels {
		full, ok := userShareFull(sh, rel)
		if !ok || full == sh.Path {
			continue
		}
		// 释放量必须在删除前统计；目录要算递归总大小（Size 只是目录项自身大小），
		// 否则退款不足、创建者用量只会涨不会落
		if e, serr := d.Stat(full); serr == nil {
			sz := e.Size
			if e.IsDir {
				if s2, e2 := entryBytes(d, full); e2 == nil {
					sz = s2
				}
			}
			released += sz
		}
		// 共享删除是永久删除：须一并清理版本记录与物理版本文件（与 /fs/delete 同一语义）。
		// 否则版本文件成为不可达垃圾，且其副本记录会让秒传索引永远无法释放
		// （索引保留指向用户已看不到、也删不掉的 .versions 文件）。
		if vp, err := fscore.Clean(full); err == nil {
			if e, serr := d.Stat(full); serr == nil {
				if e.IsDir {
					fscore.PurgeDirVersions(sh.PolicyID, vp)
				} else {
					fscore.DeleteVersions(sh.PolicyID, vp)
				}
			}
		}
		_ = d.Delete(full)
		emitFileEvent(middleware.CurrentUser(c), "file.delete", sh.PolicyID, full, webhookBase(full), map[string]interface{}{"sharedBy": sh.OwnerID})
	}
	// 上传时计入的是共享创建者的用量，删除同样退还给创建者（对称记账）
	if released > 0 {
		addQuota(sh.OwnerID, -released)
	}
	dto.OK(c, nil)
}
