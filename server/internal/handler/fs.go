package handler

import (
	"bytes"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif" // 注册解码器
	"image/jpeg"
	_ "image/png" // 注册解码器
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // 注册 webp 解码器
	"gorm.io/gorm"

	"cloudpan/internal/config"
	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// SiteHandler 全局依赖
type SiteHandler struct {
	Cfg     *config.Config
	Fs      *fscore.Service
	ZipTmp  string
}

func GetSiteSettings() map[string]string {
	m := map[string]string{}
	var rows []model.SiteSetting
	model.DB.Find(&rows)
	for _, r := range rows {
		m[r.Key] = r.Value
	}
	return m
}

// ---- 公开站点信息（无需登录） ----

func (h *SiteHandler) PublicInfo(c *gin.Context) {
	s := GetSiteSettings()
	regOpen := s["register_open"] == "true"
	invite := s["register_invite_code"] != ""
	dto.OK(c, gin.H{
		"siteName": s["site_name"], "registerOpen": regOpen, "needInviteCode": invite,
		"officeConfigured": s["onlyoffice_url"] != "",
		"announcement":     s["announcement"],
	})
}

// Policies 用户可见的存储策略列表（含用量，10 分钟缓存）
func (h *SiteHandler) Policies(c *gin.Context) {
	x := ctxOf(c)
	var list []model.Policy
	model.DB.Where("status != ?", "disabled").Order("letter").Find(&list)
	out := make([]model.Policy, 0, len(list))
	for _, p := range list {
		if x.user.Role != "admin" && !x.group.CanUsePolicy(p.ID) {
			continue
		}
		if p.Type == "local" && (p.UsageAt == nil || time.Since(*p.UsageAt) > 10*time.Minute) {
			if d, err := h.Fs.DriverFor(&p, x.user); err == nil { // 本地策略按用户隔离目录计用量
				if used, _, err := d.Quota(); err == nil {
					p.UsageBytes = used
					now := time.Now()
					model.DB.Model(&p).Updates(map[string]interface{}{"usage_bytes": used, "usage_at": &now})
				}
			}
		}
		out = append(out, p)
	}
	dto.OK(c, out)
}

// 用户上下文三元组
type ctx3 struct {
	user  *model.User
	group *model.UserGroup
}

func ctxOf(c *gin.Context) ctx3 {
	return ctx3{user: middleware.CurrentUser(c), group: middleware.GroupOf(c)}
}

// userOfID 按 ID 加载用户（后台任务/分享等无请求上下文的场景定位数据属主）
func userOfID(id uint) *model.User {
	var u model.User
	if err := model.DB.First(&u, id).Error; err != nil {
		return nil
	}
	return &u
}

func (h *SiteHandler) resolve(c *gin.Context) (*model.Policy, fscore.Driver, bool) {
	var in struct {
		PolicyID uint `form:"policyId"`
	}
	if err := c.ShouldBindQuery(&in); err != nil || in.PolicyID == 0 {
		dto.Fail(c, 400, "缺少 policyId")
		return nil, nil, false
	}
	return h.resolveByID(in.PolicyID, c)
}

// resolveByID 不消费请求体的策略解析（POST 接口先绑 JSON 再调用）
func (h *SiteHandler) resolveByID(policyID uint, c *gin.Context) (*model.Policy, fscore.Driver, bool) {
	x := ctxOf(c)
	if policyID == 0 {
		dto.Fail(c, 400, "缺少 policyId")
		return nil, nil, false
	}
	p, d, err := h.Fs.Resolve(x.user, x.group, policyID)
	if err != nil {
		dto.Fail(c, 403, err.Error())
		return nil, nil, false
	}
	return p, d, true
}

// ---- 文件列表 ----

func (h *SiteHandler) List(c *gin.Context) {
	p, d, ok := h.resolve(c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	entries, err := d.List(vp)
	if err != nil {
		dto.Fail(c, 404, "目录不存在或不可访问")
		return
	}
	// 收藏标记
	var stars []model.UserStar
	model.DB.Where("user_id = ? AND policy_id = ?", ctxOf(c).user.ID, p.ID).Find(&stars)
	starMap := map[string]bool{}
	for _, s := range stars {
		starMap[s.Path] = true
	}
	items := make([]gin.H, 0, len(entries))
	for _, e := range entries {
		full, _ := fscore.Join(vp, e.Name)
		items = append(items, gin.H{
			"name": e.Name, "isDir": e.IsDir, "size": e.Size, "modTime": e.ModTime, "ext": e.Ext,
			"path": full, "starred": starMap[full],
		})
	}
	dto.OK(c, gin.H{"policy": p, "path": vp, "items": items})
}

// ---- 单目录操作 ----

type fsOpIn struct {
	PolicyID uint     `json:"policyId"`
	Path     string   `json:"path"`
	Name     string   `json:"name"`
	NewName  string   `json:"newName"`
	DstDir   string   `json:"dstDir"`
	Paths    []string `json:"paths"`
	Keyword  string   `json:"keyword"`
}

func (h *SiteHandler) Mkdir(c *gin.Context) {
	var in fsOpIn
	if err := c.ShouldBindJSON(&in); err != nil || in.Name == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	parent, err := fscore.Clean(in.Path)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	vp, err := fscore.Join(parent, in.Name)
	if err != nil {
		dto.Fail(c, 400, "目录名非法")
		return
	}
	if san, err := fscore.SanitizeNewPath(vp); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	} else {
		vp = san
	}
	if err := d.Mkdir(vp); err != nil {
		dto.Fail(c, 400, "创建失败："+err.Error())
		return
	}
	middleware.Audit(c, "mkdir", p.Name+":"+vp)
	dto.OK(c, gin.H{"path": vp})
}

func (h *SiteHandler) Rename(c *gin.Context) {
	var in fsOpIn
	if err := c.ShouldBindJSON(&in); err != nil || in.Path == "" || in.NewName == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	if sn, err := fscore.SanitizeName(in.NewName); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	} else {
		in.NewName = sn
	}
	if err := d.Rename(in.Path, in.NewName); err != nil {
		dto.Fail(c, 400, "重命名失败："+err.Error())
		return
	}
	// 版本历史跟随文件迁移
	if ld, ok := d.(*fscore.LocalDriver); ok {
		if oldVP, err := fscore.Clean(in.Path); err == nil {
			if newVP, err := fscore.Join(parentOf(oldVP), in.NewName); err == nil {
				if e, err := d.Stat(newVP); err == nil {
					fscore.MigrateVersions(ld, p.ID, oldVP, newVP, e.IsDir)
				}
			}
		}
	}
	middleware.Audit(c, "rename", p.Name+":"+in.Path+" -> "+in.NewName)
	dto.OK(c, nil)
}

func (h *SiteHandler) Move(c *gin.Context) {
	var in fsOpIn
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Paths) == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	dst, err := fscore.Clean(in.DstDir)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	if dst != "/" {
		if e, err := d.Stat(dst); err != nil || !e.IsDir {
			dto.Fail(c, 400, "目标目录不存在")
			return
		}
	}
	ld, _ := d.(*fscore.LocalDriver)
	for _, src := range in.Paths {
		if filepath := parentOf(src); filepath == dst {
			continue
		}
		srcClean, _ := fscore.Clean(src)
		var isDir bool
		if e, err := d.Stat(src); err == nil {
			isDir = e.IsDir
		}
		if err := d.Move(src, dst); err != nil {
			dto.Fail(c, 400, fmt.Sprintf("移动 %s 失败: %s", src, err.Error()))
			return
		}
		// 版本历史跟随文件迁移
		if ld != nil {
			if newVP, err := fscore.Join(dst, baseOf(srcClean)); err == nil {
				fscore.MigrateVersions(ld, p.ID, srcClean, newVP, isDir)
			}
		}
	}
	middleware.Audit(c, "move", fmt.Sprintf("%s: %v -> %s", p.Name, in.Paths, dst))
	dto.OK(c, nil)
}

// entryBytes 递归计算路径占用的字节数（目录含全部子项；子项失败时返回已累计部分）
func entryBytes(d fscore.Driver, vp string) (int64, error) {
	e, err := d.Stat(vp)
	if err != nil {
		return 0, err
	}
	if !e.IsDir {
		return e.Size, nil
	}
	var total int64
	children, err := d.List(vp)
	if err != nil {
		return total, nil
	}
	for _, ch := range children {
		cp, jerr := fscore.Join(vp, ch.Name)
		if jerr != nil {
			continue
		}
		s, serr := entryBytes(d, cp)
		if serr != nil {
			continue
		}
		total += s
	}
	return total, nil
}

// effectiveQuotaBytes 用户生效配额（字节, 是否受限）
// 优先级：用户个人覆盖（User.QuotaMB，<0=随组 / 0=不限量 / >0=专属上限）> 用户组配额
func effectiveQuotaBytes(u *model.User, g *model.UserGroup) (int64, bool) {
	if u != nil && u.QuotaMB >= 0 {
		if u.QuotaMB == 0 {
			return 0, false
		}
		return u.QuotaMB << 20, true
	}
	if g != nil && g.QuotaMB > 0 {
		return g.QuotaMB << 20, true
	}
	return 0, false
}

// checkQuota 增容操作前的配额预检（未限制配额时直接放行），不通过时已写入 403 响应
func checkQuota(c *gin.Context, x ctx3, add int64) bool {
	if add <= 0 {
		return true
	}
	var u model.User
	if err := model.DB.First(&u, x.user.ID).Error; err != nil {
		return true
	}
	limit, limited := effectiveQuotaBytes(&u, x.group)
	if !limited {
		return true
	}
	if u.UsedBytes+add > limit {
		dto.Fail(c, 403, fmt.Sprintf("超出配额：已用 %dMB / 上限 %dMB", u.UsedBytes>>20, limit>>20))
		return false
	}
	return true
}

// addQuota 记录用量增减（负值下限为 0，与既有记账惯用法一致）
func addQuota(userID uint, delta int64) {
	if delta == 0 {
		return
	}
	model.DB.Model(&model.User{}).Where("id = ?", userID).
		UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes + ?, 0)", delta))
}

func (h *SiteHandler) Copy(c *gin.Context) {
	var in fsOpIn
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Paths) == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	dst, err := fscore.Clean(in.DstDir)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	// 复制产生新副本：先算总增量做配额预检，成功后记账
	x := ctxOf(c)
	var add int64
	for _, src := range in.Paths {
		sz, serr := entryBytes(d, src)
		if serr != nil {
			dto.Fail(c, 404, fmt.Sprintf("源 %s 不存在", src))
			return
		}
		add += sz
	}
	if !checkQuota(c, x, add) {
		return
	}
	for _, src := range in.Paths {
		if err := d.Copy(src, dst); err != nil {
			dto.Fail(c, 400, fmt.Sprintf("复制 %s 失败: %s", src, err.Error()))
			return
		}
	}
	addQuota(x.user.ID, add)
	middleware.Audit(c, "copy", fmt.Sprintf("%s: %v -> %s", p.Name, in.Paths, dst))
	dto.OK(c, nil)
}

// ---- 跨存储复制 / 移动（源与目标策略可不同） ----

type crossCopyItem struct {
	PolicyID uint   `json:"policyId"`
	Path     string `json:"path"`
}

type crossCopyIn struct {
	DstPolicyID uint            `json:"dstPolicyId"`
	DstDir      string          `json:"dstDir"`
	Items       []crossCopyItem `json:"items"`
}

// splitNameExt 拆分文件名与扩展名，用于重名自增（"a.txt" -> "a", ".txt"）
func splitNameExt(name string) (base, ext string) {
	if i := strings.LastIndex(name, "."); i > 0 && i < len(name)-1 {
		return name[:i], name[i:]
	}
	return name, ""
}

// uniqueName 在 dir 下生成不与已有条目冲突的名称，冲突时按 "name (n).ext" 递增
func uniqueName(d fscore.Driver, dir, name string) (string, error) {
	base, ext := splitNameExt(name)
	candidate := name
	for i := 1; i <= 9999; i++ {
		vp, err := fscore.Join(dir, candidate)
		if err != nil {
			return "", err
		}
		if _, statErr := d.Stat(vp); statErr != nil {
			return vp, nil // 不存在即可用
		}
		candidate = fmt.Sprintf("%s (%d)%s", base, i, ext)
	}
	return "", fmt.Errorf("无法生成唯一名称: %s", name)
}

// crossCopyEntry 将 src（位于 sd）递归复制到 dd 的 dstDir 下；目标同名自动加 (1)
func crossCopyEntry(sd, dd fscore.Driver, src, dstDir string) error {
	e, err := sd.Stat(src)
	if err != nil {
		return fmt.Errorf("读取源失败 %s: %w", src, err)
	}
	dst, err := uniqueName(dd, dstDir, path.Base(src))
	if err != nil {
		return err
	}
	if e.IsDir {
		if err := dd.Mkdir(dst); err != nil {
			return fmt.Errorf("创建目录失败 %s: %w", dst, err)
		}
		children, err := sd.List(src)
		if err != nil {
			return fmt.Errorf("列目录失败 %s: %w", src, err)
		}
		for _, ch := range children {
			childPath, _ := fscore.Join(src, ch.Name)
			if err := crossCopyEntry(sd, dd, childPath, dst); err != nil {
				return err
			}
		}
		return nil
	}
	rc, err := sd.Open(src)
	if err != nil {
		return fmt.Errorf("打开文件失败 %s: %w", src, err)
	}
	defer rc.Close()
	if err := dd.CreateFile(dst, rc); err != nil {
		return fmt.Errorf("写入目标失败 %s: %w", dst, err)
	}
	return nil
}

// removeSource 删除源：本地策略送入回收站（与其它删除一致），否则物理删除
func (h *SiteHandler) removeSource(d fscore.Driver, p *model.Policy, src string, x ctx3) error {
	if phys, err := fscore.PhysicalOf(d, src); err == nil {
		recycleUserDir := filepath.Join(h.Fs.RecycleDir, fmt.Sprint(x.user.ID))
		_ = os.MkdirAll(recycleUserDir, 0o755)
		e, err := d.Stat(src)
		if err != nil {
			return err
		}
		// 目录需记递归总大小（与 Delete 一致），否则清空回收站时配额退款不足；
		// 必须在移入回收站之前统计
		size := e.Size
		if e.IsDir {
			if sz, serr := entryBytes(d, src); serr == nil {
				size = sz
			}
		}
		ts := time.Now().Format("20060102150405")
		trashRel := ts + "_" + e.Name
		if err := os.Rename(phys, filepath.Join(recycleUserDir, trashRel)); err != nil {
			return err
		}
		model.DB.Create(&model.RecycleItem{UserID: x.user.ID, PolicyID: p.ID, OrigPath: parentOf(src),
			TrashPath: trashRel, Name: e.Name, IsDir: e.IsDir, Size: size, DeletedAt: time.Now()})
		return nil
	}
	return d.Delete(src)
}

// resolveDriverByID 解析策略驱动（带权限校验），用于跨盘复制的源策略
func (h *SiteHandler) resolveDriverByID(policyID uint, c *gin.Context) (fscore.Driver, bool) {
	_, d, ok := h.resolveByID(policyID, c)
	return d, ok
}

func (h *SiteHandler) CrossCopy(c *gin.Context) {
	var in crossCopyIn
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Items) == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	dp, dd, ok := h.resolveByID(in.DstPolicyID, c)
	if !ok {
		return
	}
	dstDir, err := fscore.Clean(in.DstDir)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	drivers := map[uint]fscore.Driver{}
	for _, it := range in.Items {
		if _, done := drivers[it.PolicyID]; done {
			continue
		}
		sd, ok := h.resolveDriverByID(it.PolicyID, c)
		if !ok {
			return
		}
		drivers[it.PolicyID] = sd
	}
	type crossItem struct {
		sd   fscore.Driver
		src  string
		size int64
	}
	items := make([]crossItem, 0, len(in.Items))
	var add int64
	for _, it := range in.Items {
		src, err := fscore.Clean(it.Path)
		if err != nil {
			dto.Fail(c, 400, fmt.Sprintf("非法源路径 %s", it.Path))
			return
		}
		sd := drivers[it.PolicyID]
		sz, serr := entryBytes(sd, src)
		if serr != nil {
			dto.Fail(c, 404, fmt.Sprintf("源 %s 不存在", src))
			return
		}
		items = append(items, crossItem{sd: sd, src: src, size: sz})
		add += sz
	}
	x := ctxOf(c)
	if !checkQuota(c, x, add) {
		return
	}
	for _, it := range items {
		if err := crossCopyEntry(it.sd, dd, it.src, dstDir); err != nil {
			dto.Fail(c, 400, err.Error())
			return
		}
	}
	addQuota(x.user.ID, add)
	middleware.Audit(c, "cross-copy", fmt.Sprintf("%s <- %v", dp.Name, in.Items))
	dto.OK(c, gin.H{"done": true})
}

func (h *SiteHandler) CrossMove(c *gin.Context) {
	var in crossCopyIn
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Items) == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	dp, dd, ok := h.resolveByID(in.DstPolicyID, c)
	if !ok {
		return
	}
	dstDir, err := fscore.Clean(in.DstDir)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	drivers := map[uint]fscore.Driver{}
	for _, it := range in.Items {
		if _, done := drivers[it.PolicyID]; done {
			continue
		}
		sd, ok := h.resolveDriverByID(it.PolicyID, c)
		if !ok {
			return
		}
		drivers[it.PolicyID] = sd
	}
	type srcEntry struct {
		sd   fscore.Driver
		src  string
		sp   *model.Policy
		size int64
	}
	var srcs []srcEntry
	var add int64
	for _, it := range in.Items {
		sd := drivers[it.PolicyID]
		src, err := fscore.Clean(it.Path)
		if err != nil {
			dto.Fail(c, 400, fmt.Sprintf("非法源路径 %s", it.Path))
			return
		}
		sz, serr := entryBytes(sd, src)
		if serr != nil {
			dto.Fail(c, 404, fmt.Sprintf("源 %s 不存在", src))
			return
		}
		var sp model.Policy
		if err := model.DB.First(&sp, it.PolicyID).Error; err != nil {
			dto.Fail(c, 400, "源策略不存在")
			return
		}
		srcs = append(srcs, srcEntry{sd: sd, src: src, sp: &sp, size: sz})
		add += sz
	}
	x := ctxOf(c)
	if !checkQuota(c, x, add) {
		return
	}
	for _, s := range srcs {
		if err := crossCopyEntry(s.sd, dd, s.src, dstDir); err != nil {
			dto.Fail(c, 400, err.Error())
			return
		}
	}
	addQuota(x.user.ID, add)
	for _, s := range srcs {
		if err := h.removeSource(s.sd, s.sp, s.src, x); err != nil {
			dto.Fail(c, 400, fmt.Sprintf("源删除失败 %s: %s", s.src, err.Error()))
			return
		}
		if s.sp.Type != "local" {
			// 云盘源被物理删除，占用退回（本地源进回收站，仍占用空间）
			addQuota(x.user.ID, -s.size)
		}
	}
	middleware.Audit(c, "cross-move", fmt.Sprintf("%s <- %v", dp.Name, in.Items))
	dto.OK(c, gin.H{"done": true})
}

// Delete 删除到回收站
func (h *SiteHandler) Delete(c *gin.Context) {
	var in fsOpIn
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Paths) == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	x := ctxOf(c)
	recycleUserDir := filepath.Join(h.Fs.RecycleDir, fmt.Sprint(x.user.ID))
	_ = os.MkdirAll(recycleUserDir, 0o755)
	for _, src := range in.Paths {
		if src == "/" {
			dto.Fail(c, 400, "不能删除根目录")
			return
		}
		e, err := d.Stat(src)
		if err != nil {
			continue
		}
		// 目录的 e.Size 只是目录项自身大小（通常为 0），必须记递归总大小，
		// 否则清空回收站退款时配额会泄漏。必须在移入回收站之前统计。
		size := e.Size
		if e.IsDir {
			if sz, serr := entryBytes(d, src); serr == nil {
				size = sz
			}
		}
		ts := time.Now().Format("20060102150405")
		trashRel := ts + "_" + e.Name
		physSrc, err := fscore.PhysicalOf(d, src)
		if err != nil {
			dto.Fail(c, 400, "仅本地存储支持删除")
			return
		}
		if err := os.Rename(physSrc, filepath.Join(recycleUserDir, trashRel)); err != nil {
			dto.Fail(c, 400, fmt.Sprintf("删除 %s 失败: %s", src, err.Error()))
			return
		}
		// 版本历史随文件一并清理（回收站不保留历史版本）
		if srcClean, err := fscore.Clean(src); err == nil {
			if e.IsDir {
				fscore.PurgeDirVersions(p.ID, srcClean)
			} else {
				fscore.DeleteVersions(p.ID, srcClean)
			}
		}
		model.DB.Create(&model.RecycleItem{UserID: x.user.ID, PolicyID: p.ID, OrigPath: parentOf(src),
			TrashPath: trashRel, Name: e.Name, IsDir: e.IsDir, Size: size, DeletedAt: time.Now()})
	}
	middleware.Audit(c, "delete", fmt.Sprintf("%s: %v", p.Name, in.Paths))
	dto.OK(c, nil)
}

// ---- 文本读写（记事本/代码编辑） ----

func (h *SiteHandler) ReadText(c *gin.Context) {
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	rc, err := d.Open(vp)
	if err != nil {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	buf := make([]byte, 2<<20) // 最多读 2MB
	n, _ := rc.Read(buf)
	dto.OK(c, gin.H{"content": string(buf[:n])})
}

func (h *SiteHandler) WriteText(c *gin.Context) {
	var in struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
		Content  string `json:"content"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Path == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	p, d, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(in.Path)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	if e, err := d.Stat(vp); err == nil && e.IsDir {
		dto.Fail(c, 400, "目标是目录")
		return
	}
	// 配额校验 + 记账（覆盖写入按新旧大小差值）
	x := ctxOf(c)
	oldSize := existingSize(d, vp)
	add := int64(len(in.Content)) - oldSize
	if !checkQuota(c, x, add) {
		return
	}
	if err := d.CreateFile(vp, strings.NewReader(in.Content)); err != nil {
		dto.Fail(c, 400, "保存失败："+err.Error())
		return
	}
	if add != 0 {
		model.DB.Model(&model.User{}).Where("id = ?", x.user.ID).
			UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes + ?, 0)", add))
	}
	if p.Type == "local" {
		if phys, err := fscore.PhysicalOf(d, vp); err == nil {
			h.Fs.RegisterHash(sha256Hex(in.Content), int64(len(in.Content)), phys)
		}
	}
	middleware.Audit(c, "write", p.Name+":"+vp)
	dto.OK(c, nil)
}

// ---- 搜索 / 属性 ----

func (h *SiteHandler) Search(c *gin.Context) {
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	root, _ := fscore.Clean(c.DefaultQuery("path", "/"))
	kw := c.Query("keyword")
	if kw == "" {
		dto.OK(c, []fscore.Entry{})
		return
	}
	dto.OK(c, h.Fs.Search(d, root, kw, 200))
}

// GlobalSearch 全局跨盘搜索：遍历当前用户可见的所有存储策略
func (h *SiteHandler) GlobalSearch(c *gin.Context) {
	x := ctxOf(c)
	kw := strings.TrimSpace(c.Query("q"))
	if kw == "" {
		dto.OK(c, []gin.H{})
		return
	}
	var list []model.Policy
	model.DB.Where("status != ?", "disabled").Order("letter").Find(&list)
	out := make([]gin.H, 0, 32)
	for _, p := range list {
		if x.user.Role != "admin" && !x.group.CanUsePolicy(p.ID) {
			continue
		}
		d, err := h.Fs.DriverFor(&p, x.user)
		if err != nil {
			continue
		}
		hits := h.Fs.Search(d, "/", kw, 30)
		for _, it := range hits {
			out = append(out, gin.H{
				"policyId": p.ID, "letter": p.Letter, "policyName": p.Name, "policyType": p.Type,
				"name": it.Name, "isDir": it.IsDir, "size": it.Size, "modTime": it.ModTime,
				"ext": it.Ext, "path": it.Path,
			})
			if len(out) >= 200 {
				dto.OK(c, out)
				return
			}
		}
	}
	dto.OK(c, out)
}

func (h *SiteHandler) Properties(c *gin.Context) {
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	e, err := d.Stat(vp)
	if err != nil {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	props, _ := h.Fs.Properties(d, vp)
	out := gin.H{"entry": e, "count": props.Count, "dirCount": props.DirCount, "size": props.Size, "path": vp}
	// 文件属性附带 SHA-256（流式计算，≤4GB；超大文件不计算避免阻塞）
	if !e.IsDir {
		const maxHashSize = int64(4 << 30)
		if e.Size <= maxHashSize {
			if rc, err := d.Open(vp); err == nil {
				hf := sha256.New()
				_, cerr := io.Copy(hf, rc)
				rc.Close()
				if cerr == nil {
					out["sha256"] = hex.EncodeToString(hf.Sum(nil))
				}
			}
		} else {
			out["sha256"] = ""
			out["sha256Note"] = "文件超过 4GB，未计算"
		}
	}
	dto.OK(c, out)
}

// ---- 原始流（预览）与下载 ----

func (h *SiteHandler) Raw(c *gin.Context) {
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	x := ctxOf(c)
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.FailHTTP(c, 400, err.Error())
		return
	}
	rc, err := d.Open(vp)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	defer rc.Close()
	name := baseOf(vp)
	// ?thumb=1 图片缩略图：生成带磁盘缓存的小图（网格/预览窗格用）
	if c.Query("thumb") != "" {
		h.serveThumb(c, x, d, rc, vp, name)
		return
	}
	// ?cover=1 媒体内嵌封面：提取 ID3v2 APIC / FLAC PICTURE / OGG 注释块（音乐库卡片/播放器用）
	if c.Query("cover") != "" {
		h.serveCover(c, x, d, rc, vp, name)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename*=UTF-8''%s`, urlEscape(name)))
	// no-cache 允许 304 协商缓存，但文件被在线编辑覆盖后必须重新拉取最新内容
	c.Header("Cache-Control", "no-cache")
	rc = wrapThrottle(rc, x.group.DownloadSpeedKB)
	http.ServeContent(c.Writer, c.Request, name, modTimeOf(rc), rc)
}

var thumbExts = map[string]bool{"png": true, "jpg": true, "jpeg": true, "gif": true, "webp": true, "bmp": true}

// serveThumb 生成图片缩略图（最长边 480px，JPEG q82），磁盘缓存于 ThumbDir。
// 缓存键 = 策略+路径+大小+mtime；非栅格图/超限文件(>20MB)/解码失败直接回退原流。
func (h *SiteHandler) serveThumb(c *gin.Context, x ctx3, d fscore.Driver, rc fscore.ReadSeekCloser, vp, name string) {
	// 功能门控：缩略图被停用时直接回退原图
	if !model.AppEnabled("thumbnail") {
		h.serveRawStream(c, rc, name)
		return
	}
	ext := strings.TrimPrefix(path.Ext(name), ".")
	ext = strings.ToLower(ext)
	if !thumbExts[ext] {
		h.serveRawStream(c, rc, name)
		return
	}
	e, err := d.Stat(vp)
	if err != nil || e.IsDir || e.Size <= 0 || e.Size > 20<<20 {
		h.serveRawStream(c, rc, name)
		return
	}
	sum := sha1.Sum([]byte(fmt.Sprintf("%d|%s|%d|%d", x.user.ID, vp, e.Size, e.ModTime)))
	cachePath := filepath.Join(h.Fs.ThumbDir, hex.EncodeToString(sum[:])+".jpg")
	if _, err := os.Stat(cachePath); err == nil {
		c.Header("Cache-Control", "public, max-age=86400")
		c.File(cachePath)
		return
	}
	data, err := io.ReadAll(rc)
	if err != nil || len(data) == 0 {
		h.serveRawStream(c, rc, name)
		return
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// 解码失败（可能是伪装扩展名）：回退原流，不落缓存
		c.Header("Content-Disposition", fmt.Sprintf(`inline; filename*=UTF-8''%s`, urlEscape(name)))
		c.Header("Cache-Control", "no-cache")
		http.ServeContent(c.Writer, c.Request, name, time.UnixMilli(e.ModTime), bytes.NewReader(data))
		return
	}
	out := &bytes.Buffer{}
	if err := jpeg.Encode(out, scaleImage(img, 480), &jpeg.Options{Quality: 82}); err != nil {
		h.serveRawStream(c, rc, name)
		return
	}
	if err := os.WriteFile(cachePath, out.Bytes(), 0o644); err != nil {
		// 落盘失败也不影响本次响应
	}
	pruneThumbs(h.Fs.ThumbDir, 5000)
	c.Header("Content-Type", "image/jpeg")
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, "image/jpeg", out.Bytes())
}

// serveRawStream 无缩略图语义时的原流输出（inline + no-cache）
func (h *SiteHandler) serveRawStream(c *gin.Context, rc fscore.ReadSeekCloser, name string) {
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename*=UTF-8''%s`, urlEscape(name)))
	c.Header("Cache-Control", "no-cache")
	http.ServeContent(c.Writer, c.Request, name, modTimeOf(rc), rc)
}

var coverExts = map[string]bool{"mp3": true, "flac": true, "ogg": true, "oga": true, "opus": true}

// serveCover 提取媒体文件内嵌封面（mp3: ID3v2 APIC；flac: PICTURE 块；ogg/opus: METADATA_BLOCK_PICTURE）。
// 三种容器的封面元数据都位于文件头部，只读前 4MB；结果按 策略+路径+大小+mtime 落盘缓存（ThumbDir）。
func (h *SiteHandler) serveCover(c *gin.Context, x ctx3, d fscore.Driver, rc fscore.ReadSeekCloser, vp, name string) {
	ext := strings.ToLower(strings.TrimPrefix(path.Ext(name), "."))
	if !coverExts[ext] {
		dto.FailHTTP(c, 404, "该格式不支持封面提取")
		return
	}
	e, err := d.Stat(vp)
	if err != nil || e.Size <= 0 {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	sum := sha1.Sum([]byte(fmt.Sprintf("cover|%d|%s|%d|%d", x.user.ID, vp, e.Size, e.ModTime)))
	cachePath := filepath.Join(h.Fs.ThumbDir, "cover-"+hex.EncodeToString(sum[:]))
	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 {
		serveCoverBytes(c, b)
		return
	}
	head := make([]byte, 4<<20)
	n, _ := io.ReadFull(rc, head)
	_, data := extractCover(head[:n]) // MIME 由 serveCoverBytes 按图片魔数重新判定
	if data == nil {
		dto.FailHTTP(c, 404, "未找到内嵌封面")
		return
	}
	if err := os.WriteFile(cachePath, data, 0o644); err == nil {
		pruneThumbs(h.Fs.ThumbDir, 5000)
	}
	serveCoverBytes(c, data)
}

// serveCoverBytes 按图片魔数定 MIME 输出（缓存文件不带扩展名，不能靠 c.File 推断）
func serveCoverBytes(c *gin.Context, data []byte) {
	mime := "image/jpeg"
	if len(data) > 3 && data[0] == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G' {
		mime = "image/png"
	}
	c.Header("Content-Type", mime)
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, mime, data)
}

// extractCover 按容器魔数分发封面解析，返回 (MIME, 图片字节)；未找到返回 nil
func extractCover(b []byte) (string, []byte) {
	switch {
	case len(b) >= 10 && b[0] == 'I' && b[1] == 'D' && b[2] == '3':
		return extractID3Cover(b)
	case len(b) >= 4 && b[0] == 'f' && b[1] == 'L' && b[2] == 'a' && b[3] == 'C':
		return extractFlacCover(b)
	case len(b) >= 4 && b[0] == 'O' && b[1] == 'g' && b[2] == 'g' && b[3] == 'S':
		return extractOggCover(b)
	}
	return "", nil
}

// extractID3Cover 遍历 ID3v2 标签找 APIC 帧（v2.2 帧头 3 字节 ID+3 字节大端长度；v2.3+ 4 字节 ID，v2.4 长度为 synchsafe）
func extractID3Cover(b []byte) (string, []byte) {
	if b[3] < 2 || b[3] > 4 {
		return "", nil
	}
	tagSize := int(b[6])<<21 | int(b[7])<<14 | int(b[8])<<7 | int(b[9]) // synchsafe
	end := 10 + tagSize
	if end > len(b) {
		end = len(b)
	}
	ver := b[3]
	p := 10
	for p < end {
		idLen := 4
		if ver == 2 {
			idLen = 3
		}
		if p+idLen+3 > end {
			break
		}
		id := b[p : p+idLen]
		if id[0] == 0 { // 进入填充区
			break
		}
		sizeBytes := b[p+idLen : p+idLen+3]
		var size int
		if ver == 4 {
			for _, x := range sizeBytes { // v2.4: synchsafe（每字节高位置 0）
				size = size<<7 + int(x&0x7f)
			}
		} else {
			for _, x := range sizeBytes { // v2.2/v2.3: 大端 24 位
				size = size<<8 + int(x)
			}
		}
		if size <= 0 || p+idLen+3+size > end {
			break
		}
		if (string(id) == "PIC" && ver == 2) || (string(id) == "APIC" && ver >= 3) {
			return parseAPIC(b[p+idLen+3 : p+idLen+3+size])
		}
		p += idLen + 3 + size
	}
	return "", nil
}

// parseAPIC 帧体：编码(1) + MIME(NUL 结尾) + 图片类型(1) + 描述(按编码定终止符) + 图片数据
func parseAPIC(body []byte) (string, []byte) {
	if len(body) < 5 {
		return "", nil
	}
	enc := body[0]
	i := 1
	for i < len(body) && body[i] != 0 {
		i++
	}
	if i >= len(body) {
		return "", nil
	}
	mime := string(body[1:i])
	i += 2 // NUL + 图片类型
	var descEnd int
	term := 1
	switch enc {
	case 0, 1:
		term = 1 // latin1 / utf-8: 单 NUL
	case 2:
		term = 2 // utf-16: 双 NUL
	default:
		term = 4 // utf-32: 四 NUL
	}
	for j := i; j+term <= len(body); j += term {
		z := true
		for k := 0; k < term; k++ {
			if body[j+k] != 0 {
				z = false
				break
			}
		}
		if z {
			descEnd = j
			break
		}
	}
	if descEnd < 0 {
		return "", nil
	}
	data := body[descEnd+term:]
	if mime == "" || len(data) < 32 || data[0] == 0 {
		return "", nil
	}
	return mime, data
}

// extractFlacCover 遍历 FLAC 元数据块，提取类型 6（PICTURE）
func extractFlacCover(b []byte) (string, []byte) {
	p := 4
	for p+4 <= len(b) {
		last := b[p]&0x80 != 0
		typ := b[p] & 0x7f
		blen := int(b[p+1])<<16 | int(b[p+2])<<8 | int(b[p+3])
		if blen <= 0 || p+4+blen > len(b) {
			break
		}
		if typ == 6 {
			return parseFlacPicture(b[p+4 : p+4+blen])
		}
		if last {
			break
		}
		p += 4 + blen
	}
	return "", nil
}

// parseFlacPicture PICTURE 块体：类型(4) + MIME长(4) + MIME + 描述长(4) + 描述 + 宽(4) + 高(4) + 位深(4) + 色数(4) + 图片数据
func parseFlacPicture(body []byte) (string, []byte) {
	be32 := func(p int) int { return int(body[p])<<24 | int(body[p+1])<<16 | int(body[p+2])<<8 | int(body[p+3]) }
	if len(body) < 8 {
		return "", nil
	}
	mimeLen := be32(4)
	if 8+mimeLen+4 > len(body) {
		return "", nil
	}
	mime := string(body[8 : 8+mimeLen])
	p := 8 + mimeLen + be32(8 + mimeLen) + 16 // 跳过描述 + 宽/高/位深/色数
	if p > len(body) {
		return "", nil
	}
	if mime == "" || len(body[p:]) < 32 {
		return "", nil
	}
	return mime, body[p:]
}

// extractOggCover 在 Vorbis/Opus 注释头中查找 METADATA_BLOCK_PICTURE（base64 编码的 FLAC PICTURE 块体）
func extractOggCover(b []byte) (string, []byte) {
	const key = "METADATA_BLOCK_PICTURE="
	idx := bytes.Index(b, []byte(key))
	if idx < 0 {
		return "", nil
	}
	start := idx + len(key)
	end := start // 注释字段以 NUL 分隔，base64 数据本身不含 NUL
	for end < len(b) && b[end] != 0 {
		end++
	}
	raw, err := base64.StdEncoding.DecodeString(string(b[start:end]))
	if err != nil || len(raw) < 8 {
		return "", nil
	}
	return parseFlacPicture(raw)
}

// scaleImage 等比缩放至最长边 maxSide；已小于则原样返回
func scaleImage(src image.Image, maxSide int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxSide && h <= maxSide {
		return src
	}
	dw, dh := w, h
	if w >= h {
		dw, dh = maxSide, h*maxSide/w
	} else {
		dw, dh = w*maxSide/h, maxSide
	}
	if dw < 1 {
		dw = 1
	}
	if dh < 1 {
		dh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, b, draw.Src, nil)
	return dst
}

// pruneThumbs 缩略图缓存超限时按修改时间删除最旧文件
func pruneThumbs(dir string, keep int) {
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) <= keep {
		return
	}
	type fi struct {
		name string
		mod  time.Time
	}
	list := make([]fi, 0, len(entries))
	for _, e := range entries {
		if info, err := e.Info(); err == nil {
			list = append(list, fi{e.Name(), info.ModTime()})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].mod.Before(list[j].mod) })
	for _, f := range list[:len(list)-keep] {
		_ = os.Remove(filepath.Join(dir, f.name))
	}
}

func (h *SiteHandler) Download(c *gin.Context) {
	p, d, ok := h.resolve(c)
	if !ok {
		return
	}
	var in fsOpIn
	_ = c.ShouldBindQuery(&in)
	paths := in.Paths
	if len(paths) == 0 && c.Query("path") != "" {
		paths = []string{c.Query("path")}
	}
	if len(paths) == 0 {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if len(paths) == 1 {
		if e, err := d.Stat(paths[0]); err == nil && !e.IsDir {
			rc, err := d.Open(paths[0])
			if err != nil {
				dto.Fail(c, 404, "文件不存在")
				return
			}
			defer rc.Close()
			c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(e.Name)))
			rc = wrapThrottle(rc, ctxOf(c).group.DownloadSpeedKB)
			http.ServeContent(c.Writer, c.Request, e.Name, time.UnixMilli(e.ModTime), rc)
			return
		}
	}
	// 多文件/目录 → zip
	zipName := fmt.Sprintf("%s_%s.zip", p.Letter, time.Now().Format("0102150405"))
	tmpZip := filepath.Join(h.ZipTmp, zipName)
	defer os.Remove(tmpZip)
	items := make([]fscore.ZipItem, len(paths))
	for i, pt := range paths {
		items[i] = fscore.ZipItem{Path: pt}
	}
	size, err := h.Fs.BuildZip(d, items, tmpZip, nil)
	if err != nil {
		dto.Fail(c, 500, "打包失败："+err.Error())
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(zipName)))
	c.File(tmpZip)
	_ = size
}

// ---- 压缩 / 解压（同步实现，后续接入任务队列） ----

func (h *SiteHandler) Archive(c *gin.Context) {
	var in struct {
		PolicyID uint     `json:"policyId"`
		Paths    []string `json:"paths"`
		Name     string   `json:"name"`
		Extract  bool     `json:"extract"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	_, _, ok := h.resolveByID(in.PolicyID, c)
	if !ok {
		return
	}
	x := ctxOf(c)
	if !x.group.AllowArchive {
		dto.Fail(c, 403, "当前用户组不允许压缩/解压")
		return
	}
	if in.Extract {
		if len(in.Paths) != 1 {
			dto.Fail(c, 400, "一次只能解压一个文件")
			return
		}
		if archiveSuffixOf(in.Paths[0]) == "" {
			dto.Fail(c, 400, "不支持的归档格式（支持 zip / tar / tar.gz / tar.bz2）")
			return
		}
		props, _ := json.Marshal(map[string]interface{}{
			"policyId": in.PolicyID, "path": in.Paths[0], "name": baseOf(in.Paths[0]),
		})
		t := &model.Task{UserID: x.user.ID, Type: "decompress", Props: string(props)}
		if err := pool.submit(t); err != nil {
			dto.Fail(c, 500, err.Error())
			return
		}
		middleware.Audit(c, "extract", "异步解压 "+in.Paths[0])
		dto.OK(c, t)
		return
	}
	if len(in.Paths) == 0 {
		dto.Fail(c, 400, "请选择要压缩的文件")
		return
	}
	name := in.Name
	if name == "" {
		name = fmt.Sprintf("archive_%s.zip", time.Now().Format("0102150405"))
	}
	// 归一化归档后缀（zip / tar / tar.gz / tar.bz2），格式由文件名决定
	_, _, name = archiveFormatOf(name)
	props, _ := json.Marshal(map[string]interface{}{
		"policyId": in.PolicyID, "paths": in.Paths, "name": name,
	})
	t := &model.Task{UserID: x.user.ID, Type: "compress", Props: string(props)}
	if err := pool.submit(t); err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	middleware.Audit(c, "archive", fmt.Sprintf("异步压缩 %d 项 → %s", len(in.Paths), name))
	dto.OK(c, t)
}

func (h *SiteHandler) RecycleList(c *gin.Context) {
	x := ctxOf(c)
	var items []model.RecycleItem
	model.DB.Where("user_id = ?", x.user.ID).Order("deleted_at DESC").Find(&items)
	dto.OK(c, items)
}

func (h *SiteHandler) RecycleRestore(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		IDs []uint `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	for _, id := range in.IDs {
		var item model.RecycleItem
		if err := model.DB.Where("id = ? AND user_id = ?", id, x.user.ID).First(&item).Error; err != nil {
			continue
		}
		var p model.Policy
		if err := model.DB.First(&p, item.PolicyID).Error; err != nil {
			continue
		}
		d, err := h.Fs.DriverFor(&p, x.user) // 恢复到该用户自己的隔离目录
		if err != nil {
			continue
		}
		trashPhys := filepath.Join(h.Fs.RecycleDir, fmt.Sprint(x.user.ID), item.TrashPath)
		if _, err := os.Stat(trashPhys); err != nil {
			model.DB.Delete(&item)
			continue
		}
		// 目标目录可能已不存在：逐级重建
		parentPhys, err := fscore.PhysicalOf(d, item.OrigPath)
		if err != nil {
			continue
		}
		_ = os.MkdirAll(parentPhys, 0o755)
		target := filepath.Join(parentPhys, item.Name)
		if _, err := os.Stat(target); err == nil {
			target = filepath.Join(parentPhys, fmt.Sprintf("%s(恢复_%s)", item.Name, time.Now().Format("150405")))
		}
		if err := os.Rename(trashPhys, target); err != nil {
			continue
		}
		model.DB.Delete(&item)
	}
	dto.OK(c, nil)
}

func (h *SiteHandler) RecyclePurge(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		IDs   []uint `json:"ids"`
		All   bool   `json:"all"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	q := model.DB.Where("user_id = ?", x.user.ID)
	if !in.All {
		if len(in.IDs) == 0 {
			dto.Fail(c, 400, "参数错误")
			return
		}
		q = q.Where("id IN ?", in.IDs)
	}
	var items []model.RecycleItem
	q.Find(&items)
	for _, item := range items {
		_ = os.RemoveAll(filepath.Join(h.Fs.RecycleDir, fmt.Sprint(x.user.ID), item.TrashPath))
		// 目录项的 Size 为删除前统计的递归总大小，与文件同样需要退款
		if item.Size > 0 {
			model.DB.Model(&model.User{}).Where("id = ?", x.user.ID).
				UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes - ?, 0)", item.Size))
		}
		model.DB.Delete(&item)
	}
	dto.OK(c, nil)
}

// ---- 收藏 ----

func (h *SiteHandler) StarList(c *gin.Context) {
	x := ctxOf(c)
	var items []model.UserStar
	model.DB.Where("user_id = ?", x.user.ID).Order("created_at DESC").Find(&items)
	dto.OK(c, items)
}

func (h *SiteHandler) StarAdd(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Path == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var n int64
	model.DB.Model(&model.UserStar{}).Where("user_id=? AND policy_id=? AND path=?", x.user.ID, in.PolicyID, in.Path).Count(&n)
	if n == 0 {
		model.DB.Create(&model.UserStar{UserID: x.user.ID, PolicyID: in.PolicyID, Path: in.Path, Name: in.Name})
	}
	dto.OK(c, nil)
}

func (h *SiteHandler) StarRemove(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	model.DB.Where("user_id=? AND policy_id=? AND path=?", x.user.ID, in.PolicyID, in.Path).Delete(&model.UserStar{})
	dto.OK(c, nil)
}

// ---- 文件版本管理 ----

func (h *SiteHandler) FileVersions(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		PolicyID uint   `form:"policyId" binding:"required"`
		Path     string `form:"path" binding:"required"`
	}
	if err := c.ShouldBindQuery(&in); err != nil || in.Path == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var versions []model.FileVersion
	model.DB.Where("user_id=? AND policy_id=? AND path=?", x.user.ID, in.PolicyID, in.Path).
		Order("version DESC").Find(&versions)
	dto.OK(c, versions)
}

func (h *SiteHandler) FileVersionRestore(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		PolicyID uint `json:"policyId"`
		Path     string `json:"path"`
		Version  int  `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Path == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var ver model.FileVersion
	if err := model.DB.Where("version=? AND path=? AND policy_id=? AND user_id=?", in.Version, in.Path, in.PolicyID, x.user.ID).First(&ver).Error; err != nil {
		dto.Fail(c, 404, "版本不存在")
		return
	}
	// 找到当前路径对应的策略
	var pol model.Policy
	if err := model.DB.First(&pol, in.PolicyID).Error; err != nil {
		dto.Fail(c, 400, "策略不存在")
		return
	}
	d, err := h.Fs.DriverFor(&pol, x.user)
	if err != nil {
		dto.Fail(c, 500, "驱动错误")
		return
	}
	ld, ok := d.(*fscore.LocalDriver)
	if !ok {
		dto.Fail(c, 400, "仅本地存储支持版本恢复")
		return
	}
	physTarget, err := ld.Physical(in.Path)
	if err != nil {
		dto.Fail(c, 400, "路径错误")
		return
	}
	// 备份当前文件为新版本
	fscore.SaveVersion(in.PolicyID, x.user.ID, in.Path, physTarget)
	// 恢复指定版本
	if ver.PhysicalPath == "" {
		dto.Fail(c, 500, "版本物理路径缺失")
		return
	}
	src, err := os.Open(ver.PhysicalPath)
	if err != nil {
		dto.Fail(c, 500, "源文件已丢失")
		return
	}
	defer src.Close()
	if err := os.MkdirAll(filepath.Dir(physTarget), 0o755); err != nil {
		dto.Fail(c, 500, "目录创建失败")
		return
	}
	dst, err := os.Create(physTarget)
	if err != nil {
		dto.Fail(c, 500, "目标创建失败")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		dto.Fail(c, 500, "恢复失败："+err.Error())
		return
	}
	dto.OK(c, gin.H{"version": ver.Version, "path": in.Path})
}

// FileVersionDownload 下载指定历史版本
func (h *SiteHandler) FileVersionDownload(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		PolicyID uint   `form:"policyId" binding:"required"`
		Path     string `form:"path" binding:"required"`
		Version  int    `form:"version" binding:"required"`
	}
	if err := c.ShouldBindQuery(&in); err != nil || in.Path == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	var ver model.FileVersion
	if err := model.DB.Where("version=? AND path=? AND policy_id=? AND user_id=?", in.Version, in.Path, in.PolicyID, x.user.ID).First(&ver).Error; err != nil {
		dto.Fail(c, 404, "版本不存在")
		return
	}
	if ver.PhysicalPath == "" {
		dto.Fail(c, 500, "版本物理路径缺失")
		return
	}
	f, err := os.Open(ver.PhysicalPath)
	if err != nil {
		dto.Fail(c, 404, "版本文件已丢失")
		return
	}
	defer f.Close()
	name := baseOf(in.Path)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, urlEscape(name)))
	rc := wrapThrottle(f, x.group.DownloadSpeedKB)
	http.ServeContent(c.Writer, c.Request, name, ver.CreatedAt, rc)
}

func parentOf(p string) string {
	if p == "/" || p == "" {
		return "/"
	}
	i := len(p)
	if idx := lastIndexByte(p, '/'); idx > 0 {
		i = idx
		return p[:idx]
	}
	_ = i
	return "/"
}

func baseOf(p string) string {
	if p == "/" {
		return "/"
	}
	if idx := lastIndexByte(p, '/'); idx >= 0 {
		return p[idx+1:]
	}
	return p
}

func existingSize(d fscore.Driver, vp string) int64 {
	if e, err := d.Stat(vp); err == nil && !e.IsDir {
		return e.Size
	}
	return 0
}

func modTimeOf(rc fscore.ReadSeekCloser) time.Time {
	type fmter interface{ Stat() (os.FileInfo, error) }
	if s, ok := rc.(fmter); ok {
		if fi, err := s.Stat(); err == nil {
			return fi.ModTime()
		}
	}
	return time.Now()
}

// ---- 用户设置 KV（播放列表/观看进度等 JSON 存储）----

// UserSettingsGet GET /api/settings?keys=a,b,c —— 无 keys 返回该用户全部设置
func (h *SiteHandler) UserSettingsGet(c *gin.Context) {
	x := ctxOf(c)
	q := model.DB.Where("user_id = ?", x.user.ID)
	if kp := c.Query("keys"); kp != "" {
		var keys []string
		for _, k := range strings.Split(kp, ",") {
			if k = strings.TrimSpace(k); k != "" && len(k) <= 64 {
				keys = append(keys, k)
			}
		}
		if len(keys) == 0 {
			dto.Fail(c, 400, "参数错误")
			return
		}
		q = q.Where("key IN ?", keys)
	}
	var items []model.UserSetting
	q.Find(&items)
	out := make(map[string]string, len(items))
	for _, it := range items {
		out[it.Key] = it.Value
	}
	dto.OK(c, out)
}

// UserSettingsSet PUT /api/settings {key, value}
func (h *SiteHandler) UserSettingsSet(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		Key   string `json:"key" binding:"required"`
		Value string `json:"value"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Key) > 64 || len(in.Value) > 1024*1024 {
		dto.Fail(c, 400, "参数错误（key/value 超长）")
		return
	}
	// 存在性检查必须带 user_id——否则第二个用户写同 key 时会命中他人的行、
	// 走 UPDATE 分支但 0 行更新，值被静默丢弃
	var n int64
	model.DB.Model(&model.UserSetting{}).Where("user_id = ? AND key = ?", x.user.ID, in.Key).Count(&n)
	if n > 0 {
		model.DB.Model(&model.UserSetting{}).
			Where("user_id = ? AND key = ?", x.user.ID, in.Key).
			Update("value", in.Value)
	} else {
		model.DB.Create(&model.UserSetting{UserID: x.user.ID, Key: in.Key, Value: in.Value})
	}
	dto.OK(c, nil)
}
