package handler

import (
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

// ---- 存储分析（只读）----
//
// 回答"空间被什么占了、哪些能放心删"：遍历当前用户在指定盘上的可见文件，
// 聚合出「按类型 / 按顶层目录 / 大文件排行」；本地盘再补「同内容多副本」。
//
// 安全：只遍历当前用户可见的目录（走 Driver 接口，天然受用户隔离约束）；
// 重复文件一节只按"该用户自己的物理目录"过滤台账，且**只回传虚拟路径**，
// 不把服务器绝对路径暴露给前端。

// dupGroup 同内容多副本的一组。
type dupGroup struct {
	Hash  string `json:"hash"`
	Size  int64  `json:"size"`
	Count int    `json:"count"`
	// HardLinked 为真表示这些副本是同一 inode 的硬链接（秒传产物），不额外占空间。
	// 前端据此提示"整理用，不省空间"，避免误导。
	HardLinked bool     `json:"hardLinked"`
	Paths      []string `json:"paths"` // 虚拟路径，最多 maxDupPaths 条
}

type storageAnalysisOut struct {
	fscore.Analysis
	// Duplicates 同内容多副本（仅本地盘；非本地盘为空数组）
	Duplicates []dupGroup `json:"duplicates"`
	// Scanned 实际参与统计的文件数（与 TotalFiles 同值，单独给出便于前端提示"已扫描 N 个文件"）
	Scanned int `json:"scanned"`
}

const (
	anaMaxEntries = 200000 // 遍历条目上限：触顶即标记 truncated，宁可统计不全也不拖死请求
	anaMaxDepth   = 12
	anaLargestN   = 50
	dupMaxGroups  = 200
	dupMaxPaths   = 20
)

// StorageAnalysis GET /fs/analysis?policyId=
func (h *SiteHandler) StorageAnalysis(c *gin.Context) {
	p, d, ok := h.resolve(c)
	if !ok {
		return
	}
	x := ctxOf(c)

	entries, truncated, err := fscore.WalkEntries(d, "/", anaMaxEntries, anaMaxDepth)
	if err != nil {
		dto.Fail(c, 500, "目录遍历失败："+err.Error())
		return
	}
	an := fscore.BuildAnalysis(entries, anaLargestN)
	an.Truncated = truncated

	dups := localDuplicateGroups(p, x.user)

	dto.OK(c, storageAnalysisOut{
		Analysis:   an,
		Duplicates: dups,
		Scanned:    len(entries),
	})
}

// localDuplicateGroups 只处理本地盘：云端驱动没有本地物理路径，无"同内容多副本"概念。
// 是否硬链接用 os.SameFile 实测（秒传同卷走硬链接，此时不额外占空间）。
func localDuplicateGroups(p *model.Policy, u *model.User) []dupGroup {
	out := []dupGroup{}
	if p == nil || p.Type != "local" || p.RootPath == "" || u == nil {
		return out
	}
	// 一律以"当前用户自己的可见根"为基准：本地盘每个用户的根就是 <策略根>/<用户目录>，
	// 而回传的虚拟路径必须相对该根（管理员也不例外——管理员的虚拟 /x 对应 <根>/<管理员目录>/x，
	// 若按整盘根换算会回成 /admin/x，前端"定位"会跳到不存在的目录）。
	// 副作用（有意）：管理员这里只统计自己的文件，不含其他用户目录。
	dir := fscore.UserDirOf(u)
	if dir == "" {
		return out
	}
	prefix := filepath.Clean(filepath.Join(p.RootPath, dir))

	var rows []struct {
		Hash     string
		PhysPath string
		Size     int64
	}
	// LIKE 前缀过滤 + 关联索引取体积；台账规模远小于文件数，代价可控。
	// 注意：gorm 的 Scan() 返回 *gorm.DB，**不是 error** —— 必须判 .Error，
	// 否则该表达式恒为真，会每次都提前返回"无重复"（本功能开发中实际踩到）。
	q := model.DB.Raw(
		"SELECT c.hash AS hash, c.phys_path AS phys_path, h.size AS size "+
			"FROM file_hash_copies c JOIN file_hashes h ON h.hash = c.hash "+
			"WHERE c.phys_path LIKE ?", prefix+string(filepath.Separator)+"%",
	).Scan(&rows)
	if q.Error != nil {
		// 降级为"无重复"，但留日志：台账异常不该拖垮整个分析接口
		log.Printf("[storage-analysis] 多副本台账查询失败（已降级为无重复）: %v", q.Error)
		return out
	}

	groups := map[string][]string{}
	sizes := map[string]int64{}
	for _, r := range rows {
		if len(groups[r.Hash]) >= dupMaxPaths {
			continue
		}
		groups[r.Hash] = append(groups[r.Hash], r.PhysPath)
		sizes[r.Hash] = r.Size
	}

	for h, paths := range groups {
		if len(paths) < 2 {
			continue // 仅有 1 个物理副本 = 不重复
		}
		vpaths := make([]string, 0, len(paths))
		for _, pp := range paths {
			if v := physToVirtual(pp, prefix); v != "" {
				vpaths = append(vpaths, v)
			}
		}
		if len(vpaths) < 2 {
			continue
		}
		out = append(out, dupGroup{
			Hash:       h,
			Size:       sizes[h],
			Count:      len(vpaths),
			HardLinked: hardLinked(paths[0], paths[1]),
			Paths:      vpaths,
		})
	}
	// 占用降序：先看"最占地方"的重复，其次是组内数量
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Size != out[j].Size {
			return out[i].Size > out[j].Size
		}
		return out[i].Count > out[j].Count
	})
	if len(out) > dupMaxGroups {
		out = out[:dupMaxGroups]
	}
	return out
}

// physToVirtual 物理路径 → 用户可见的虚拟路径；不在此前缀内返回空串（防御越权）
func physToVirtual(phys, prefix string) string {
	rel, err := filepath.Rel(prefix, phys)
	// "." 表示"物理路径就是前缀本身"（不是文件）；".." 开头表示在前缀之外（越权/异常）——
	// 两者都必须回空串，绝不能把服务器绝对路径或越界路径透给前端
	if err != nil || rel == "." || rel == "" || strings.HasPrefix(rel, "..") {
		return ""
	}
	return "/" + filepath.ToSlash(rel)
}

// hardLinked 两个物理路径是否指向同一 inode（硬链接 → 不额外占空间）
func hardLinked(a, b string) bool {
	fa, err1 := os.Stat(a)
	fb, err2 := os.Stat(b)
	if err1 != nil || err2 != nil {
		return false
	}
	return os.SameFile(fa, fb)
}
