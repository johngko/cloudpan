package handler

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"
)

// ---- 用户标签体系（FileTag / FileTagging）----
// 标签是账号级元数据（与收藏同级），不动文件系统：游客由 guest 写白名单 default-deny 挡住。
// 每条路径最多 10 个标签，每用户最多 30 个标签定义。
// FileTagging 冗余存 Name/IsDir：侧栏「标签聚合视图」无需回源各驱动取元数据。

const (
	maxTagsPerUser = 30
	maxTagsPerPath = 10
)

// TagList 标签列表（含每个标签的关联对象数）
func (h *SiteHandler) TagList(c *gin.Context) {
	x := ctxOf(c)
	var tags []model.FileTag
	model.DB.Where("user_id = ?", x.user.ID).Order("id").Find(&tags)
	type cntRow struct {
		TagID uint
		N     int64
	}
	var cnts []cntRow
	model.DB.Model(&model.FileTagging{}).Select("tag_id, COUNT(*) AS n").
		Where("user_id = ?", x.user.ID).Group("tag_id").Scan(&cnts)
	count := map[uint]int64{}
	for _, r := range cnts {
		count[r.TagID] = r.N
	}
	out := make([]map[string]any, 0, len(tags))
	for _, t := range tags {
		out = append(out, map[string]any{"id": t.ID, "name": t.Name, "color": t.Color, "count": count[t.ID]})
	}
	dto.OK(c, out)
}

// validTagNameColor 标签名/颜色校验，返回空串 = 合法
func validTagNameColor(name, color string) string {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 32 {
		return "标签名需 1-32 位"
	}
	for _, r := range name {
		if r < 0x21 || r == 0x7f {
			return "标签名不能包含空白或控制字符"
		}
	}
	if len(color) != 7 || color[0] != '#' {
		return "颜色格式需为 #rrggbb"
	}
	for i := 1; i < 7; i++ {
		ch := color[i]
		if !(ch >= '0' && ch <= '9' || ch >= 'a' && ch <= 'f' || ch >= 'A' && ch <= 'F') {
			return "颜色格式需为 #rrggbb"
		}
	}
	return ""
}

// TagCreate 新建标签
func (h *SiteHandler) TagCreate(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if msg := validTagNameColor(in.Name, in.Color); msg != "" {
		dto.Fail(c, 400, msg)
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	var n int64
	model.DB.Model(&model.FileTag{}).Where("user_id = ?", x.user.ID).Count(&n)
	if n >= maxTagsPerUser {
		dto.Fail(c, 400, fmt.Sprintf("标签数量已达上限（%d）", maxTagsPerUser))
		return
	}
	// 同名标签（忽略大小写）视为重复
	var dup int64
	model.DB.Model(&model.FileTag{}).Where("user_id = ? AND name = ?", x.user.ID, in.Name).Count(&dup)
	if dup > 0 {
		dto.Fail(c, 400, "已存在同名标签")
		return
	}
	t := model.FileTag{UserID: x.user.ID, Name: in.Name, Color: strings.ToLower(in.Color)}
	model.DB.Create(&t)
	dto.OK(c, t)
}

// TagUpdate 改标签名/颜色（所有关联对象的展示自动跟随，名称不冗余在关联表里）
func (h *SiteHandler) TagUpdate(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if msg := validTagNameColor(in.Name, in.Color); msg != "" {
		dto.Fail(c, 400, msg)
		return
	}
	var t model.FileTag
	if model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).First(&t).Error != nil {
		dto.Fail(c, 404, "标签不存在")
		return
	}
	model.DB.Model(&t).Updates(map[string]any{"name": strings.TrimSpace(in.Name), "color": strings.ToLower(in.Color)})
	dto.OK(c, nil)
}

// TagDelete 删除标签及其全部关联
func (h *SiteHandler) TagDelete(c *gin.Context) {
	x := ctxOf(c)
	var t model.FileTag
	if model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).First(&t).Error != nil {
		dto.Fail(c, 404, "标签不存在")
		return
	}
	model.DB.Where("tag_id = ?", t.ID).Delete(&model.FileTagging{})
	model.DB.Delete(&t)
	dto.OK(c, nil)
}

// TagSet 设置某路径的标签（整组替换语义：tagIds 即最终状态，与收藏 add/remove 互补）
func (h *SiteHandler) TagSet(c *gin.Context) {
	x := ctxOf(c)
	var in struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
		Name     string `json:"name"`
		IsDir    bool   `json:"isDir"`
		TagIDs   []uint `json:"tagIds"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Path == "" {
		dto.Fail(c, 400, "参数错误")
		return
	}
	if len(in.TagIDs) > maxTagsPerPath {
		dto.Fail(c, 400, fmt.Sprintf("单条路径最多 %d 个标签", maxTagsPerPath))
		return
	}
	// 只接受属于本人的标签，顺带去重
	var own []model.FileTag
	model.DB.Where("user_id = ? AND id IN ?", x.user.ID, in.TagIDs).Find(&own)
	valid := map[uint]bool{}
	for _, t := range own {
		valid[t.ID] = true
	}
	model.DB.Where("user_id = ? AND policy_id = ? AND path = ?", x.user.ID, in.PolicyID, in.Path).Delete(&model.FileTagging{})
	for _, id := range in.TagIDs {
		if !valid[id] {
			continue
		}
		model.DB.Create(&model.FileTagging{TagID: id, UserID: x.user.ID, PolicyID: in.PolicyID, Path: in.Path, Name: in.Name, IsDir: in.IsDir})
	}
	dto.OK(c, nil)
}

// TagObjects 某标签下的全部对象（跨存储策略聚合；侧栏标签视图的数据源）
func (h *SiteHandler) TagObjects(c *gin.Context) {
	x := ctxOf(c)
	var t model.FileTag
	if model.DB.Where("id = ? AND user_id = ?", c.Param("id"), x.user.ID).First(&t).Error != nil {
		dto.Fail(c, 404, "标签不存在")
		return
	}
	var objs []model.FileTagging
	model.DB.Where("tag_id = ?", t.ID).Order("created_at DESC").Limit(2000).Find(&objs)
	dto.OK(c, objs)
}

// PathTags 单条路径当前的标签 ID 列表（预览面板/右键子菜单的状态源；避免整目录联查）
func (h *SiteHandler) PathTags(c *gin.Context) {
	x := ctxOf(c)
	policyID := c.Query("policyId")
	path := c.Query("path")
	var rows []model.FileTagging
	model.DB.Where("user_id = ? AND policy_id = ? AND path = ?", x.user.ID, policyID, path).Find(&rows)
	ids := make([]uint, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.TagID)
	}
	dto.OK(c, ids)
}

// ---- 最近打开（RecentOpen）----
// 前端在「双击打开/预览」时上报；打开目录不记（目录导航太频繁，噪音大于价值）。

const recentKeep = 50

// RecentRecord 记录一次打开（按 用户+策略+路径 upsert，超上限裁剪最旧）
func (h *SiteHandler) RecentRecord(c *gin.Context) {
	x := ctxOf(c)
	if x.user == nil {
		return
	}
	var in struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
		Name     string `json:"name"`
		IsDir    bool   `json:"isDir"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Path == "" || in.Path == "/" || in.IsDir {
		dto.OK(c, nil) // 静默成功：最近记录是尽力而为的辅助数据，不值得报错
		return
	}
	model.DB.Where("user_id = ? AND policy_id = ? AND path = ?", x.user.ID, in.PolicyID, in.Path).Delete(&model.RecentOpen{})
	model.DB.Create(&model.RecentOpen{UserID: x.user.ID, PolicyID: in.PolicyID, Path: in.Path, Name: in.Name, IsDir: false})
	// 裁剪：只保留最近 recentKeep 条
	var keepIDs []uint
	model.DB.Model(&model.RecentOpen{}).Where("user_id = ?", x.user.ID).
		Order("opened_at DESC").Limit(recentKeep).Pluck("id", &keepIDs)
	if len(keepIDs) >= recentKeep {
		model.DB.Where("user_id = ? AND id NOT IN ?", x.user.ID, keepIDs).Delete(&model.RecentOpen{})
	}
	dto.OK(c, nil)
}

// RecentList 最近打开列表（跨盘聚合，供资源管理器侧栏/首屏）
func (h *SiteHandler) RecentList(c *gin.Context) {
	x := ctxOf(c)
	var items []model.RecentOpen
	model.DB.Where("user_id = ?", x.user.ID).Order("opened_at DESC").Limit(recentKeep).Find(&items)
	dto.OK(c, items)
}
