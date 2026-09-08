package handler

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// UserShareHandler 站内用户共享：把目录共享给其他注册用户（ro 只读 / rw 可写）
type UserShareHandler struct{ Site *SiteHandler }

// Users 列出可共享目标用户（登录即可见，仅基础字段）
func (h *UserShareHandler) Users(c *gin.Context) {
	var items []model.User
	model.DB.Where("disabled = false").Select("id, username, nickname, avatar").Find(&items)
	dto.OK(c, items)
}

type userShareCreateIn struct {
	PolicyID uint   `json:"policyId" binding:"required"`
	Path     string `json:"path" binding:"required"`
	TargetID uint   `json:"targetId" binding:"required"`
	Perm     string `json:"perm"`
}

func (h *UserShareHandler) Create(c *gin.Context) {
	x := ctxOf(c)
	if !x.group.AllowShare {
		dto.Fail(c, 403, "当前用户组不允许共享")
		return
	}
	var in userShareCreateIn
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if in.TargetID == x.user.ID {
		dto.Fail(c, 400, "不能共享给自己")
		return
	}
	var target model.User
	if err := model.DB.Where("id = ? AND disabled = false", in.TargetID).First(&target).Error; err != nil {
		dto.Fail(c, 404, "目标用户不存在")
		return
	}
	_, d, err := h.Site.Fs.Resolve(x.user.ID, x.user.Role, x.group, in.PolicyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return
	}
	vp, err := fscore.Clean(in.Path)
	if err != nil || vp == "/" {
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
	// 去重：同目标同目录只保留一条
	var n int64
	model.DB.Model(&model.UserShare{}).
		Where("owner_id = ? AND target_id = ? AND policy_id = ? AND path = ?", x.user.ID, in.TargetID, in.PolicyID, vp).Count(&n)
	if n > 0 {
		dto.Fail(c, 400, "已共享给该用户")
		return
	}
	us := model.UserShare{OwnerID: x.user.ID, TargetID: in.TargetID, PolicyID: in.PolicyID, Path: vp, Name: e.Name, Perm: perm}
	if err := model.DB.Create(&us).Error; err != nil {
		dto.Fail(c, 500, "创建共享失败")
		return
	}
	middleware.Audit(c, "usershare", fmt.Sprintf("共享 %s 给 %s (%s)", vp, target.Username, perm))
	dto.OK(c, us)
}

// Mine 我共享出去的
func (h *UserShareHandler) Mine(c *gin.Context) {
	x := ctxOf(c)
	var items []model.UserShare
	model.DB.Where("owner_id = ?", x.user.ID).Order("id DESC").Find(&items)
	dto.OK(c, h.decorate(items))
}

// WithMe 共享给我的
func (h *UserShareHandler) WithMe(c *gin.Context) {
	x := ctxOf(c)
	var items []model.UserShare
	model.DB.Where("target_id = ?", x.user.ID).Order("id DESC").Find(&items)
	dto.OK(c, h.decorate(items))
}

func (h *UserShareHandler) decorate(items []model.UserShare) []gin.H {
	out := make([]gin.H, 0, len(items))
	for _, s := range items {
		var owner model.User
		model.DB.Select("username, nickname").First(&owner, s.OwnerID)
		out = append(out, gin.H{
			"id": s.ID, "name": s.Name, "perm": s.Perm, "path": s.Path,
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
	x := ctxOf(c)
	var sh model.UserShare
	if err := model.DB.Where("id = ? AND target_id = ?", c.Param("id"), x.user.ID).First(&sh).Error; err != nil {
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
	d, err := h.Site.Fs.DriverOf(&p)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return nil, nil, false
	}
	return &sh, d, true
}

// full 计算 rel 相对共享根的绝对虚拟路径（防越界）
func userShareFull(sh *model.UserShare, rel string) (string, bool) {
	rel = strings.TrimPrefix(rel, "/")
	full, err := fscore.Clean(sh.Path + "/" + rel)
	if err != nil {
		return "", false
	}
	if full != sh.Path && !strings.HasPrefix(full, sh.Path+"/") {
		return "", false
	}
	return full, true
}

// Info 共享根信息
func (h *UserShareHandler) Info(c *gin.Context) {
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
	defer rc.Close()
	rc = wrapThrottle(rc, ctxOf(c).group.DownloadSpeedKB)
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename*=UTF-8''%s`, urlEscape(e.Name)))
	httpServe(c, e.Name, modTimeOf(rc), rc)
}

// Download 共享文件下载（文件直下 / 目录 zip）
func (h *UserShareHandler) Download(c *gin.Context) {
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
	dto.OK(c, gin.H{"path": vp})
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
	for _, rel := range in.Rels {
		full, ok := userShareFull(sh, rel)
		if !ok || full == sh.Path {
			continue
		}
		_ = d.Delete(full)
	}
	dto.OK(c, nil)
}
