package fscore

import (
	"path"
	"sort"
	"strings"
)

// ---- 存储分析 ----
//
// 用途：回答「空间被什么占了、哪些能放心删」。
// 设计：聚合部分是纯函数（入参为条目切片），可脱离磁盘/数据库单测；
// 目录遍历单独放在 WalkEntries（对 Driver 接口编程，测试可注入桩驱动）。

// AnalysisEntry 分析所需的最小条目字段
type AnalysisEntry struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"`
	Ext     string `json:"ext"`
}

// TypeBucket 按类型聚合的一行
type TypeBucket struct {
	Key   string `json:"key"` // 分类键（英文，供前端选中稳定）
	Label string `json:"label"`
	Bytes int64  `json:"bytes"`
	Count int    `json:"count"`
}

// DirBucket 按顶层目录聚合的一行
type DirBucket struct {
	Path  string `json:"path"` // 顶层虚拟路径，如 /操作系统
	Bytes int64  `json:"bytes"`
	Count int    `json:"count"`
}

// Analysis 分析结果（不含重复文件：那一项依赖台账，由 handler 侧补充）
type Analysis struct {
	TotalBytes int64           `json:"totalBytes"`
	TotalFiles int             `json:"totalFiles"`
	ByType     []TypeBucket    `json:"byType"`
	ByTopDir   []DirBucket     `json:"byTopDir"`
	Largest    []AnalysisEntry `json:"largest"`
	// Truncated 为真表示遍历触到上限提前停止，统计不完整（前端需提示）
	Truncated bool `json:"truncated"`
}

// typeCats 扩展名 → 分类。顺序即前端展示顺序（占用多的类别通常靠前，这里按"人工可读"排）。
var typeCats = []struct {
	key   string
	label string
	exts  []string
}{
	{"system", "系统镜像 / 安装包", []string{"iso", "img", "esd", "wim", "vhd", "vhdx", "vmdk", "msi", "exe", "apk", "dmg", "pkg", "deb", "rpm"}},
	{"archive", "压缩包", []string{"zip", "7z", "rar", "tar", "gz", "tgz", "bz2", "xz", "cab", "zst"}},
	{"doc", "文档", []string{"doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf", "odt", "ods", "odp", "txt", "md", "rtf", "csv", "epub"}},
	{"image", "图片", []string{"jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "heic", "tif", "tiff", "psd", "raw"}},
	{"media", "音视频", []string{"mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "mp3", "wav", "flac", "aac", "m4a", "ogg", "ape"}},
	{"data", "源码 / 数据 / 备份", []string{"go", "ts", "js", "mjs", "py", "java", "c", "cpp", "h", "cs", "php", "rb", "sh", "json", "xml", "yml", "yaml", "sql", "db", "bak", "sav", "dat", "bin", "log"}},
}

const otherTypeKey, otherTypeLabel = "other", "其它"

// TypeCategory 扩展名归入哪个分类；未知归「其它」
func TypeCategory(ext string) (key, label string) {
	e := strings.ToLower(strings.TrimPrefix(ext, "."))
	for _, c := range typeCats {
		for _, x := range c.exts {
			if e == x {
				return c.key, c.label
			}
		}
	}
	return otherTypeKey, otherTypeLabel
}

// BuildAnalysis 纯聚合：按类型、按顶层目录、占用最大的文件。
// largestN <= 0 时使用默认 50。
func BuildAnalysis(entries []AnalysisEntry, largestN int) Analysis {
	if largestN <= 0 {
		largestN = 50
	}
	res := Analysis{ByType: []TypeBucket{}, ByTopDir: []DirBucket{}, Largest: []AnalysisEntry{}}

	typeAgg := map[string]*TypeBucket{}
	typeOrder := []string{}
	dirAgg := map[string]*DirBucket{}

	for _, e := range entries {
		res.TotalBytes += e.Size
		res.TotalFiles++

		k, lbl := TypeCategory(e.Ext)
		if _, ok := typeAgg[k]; !ok {
			typeAgg[k] = &TypeBucket{Key: k, Label: lbl}
			typeOrder = append(typeOrder, k)
		}
		typeAgg[k].Bytes += e.Size
		typeAgg[k].Count++

		// 顶层目录 = 文件"所在目录"的第一段；根目录下的散文件统一归 "" → 展示为「(根目录)」
		// （不能直接取文件路径第一段：那会把 /未知.xyz 这样的根层文件当成一个目录）
		top := topDirOf(e.Path)
		if _, ok := dirAgg[top]; !ok {
			dirAgg[top] = &DirBucket{Path: top}
		}
		dirAgg[top].Bytes += e.Size
		dirAgg[top].Count++
	}

	// 类型：占用降序，同占用按数量降序（稳定的可读顺序）
	for _, k := range typeOrder {
		res.ByType = append(res.ByType, *typeAgg[k])
	}
	sort.SliceStable(res.ByType, func(i, j int) bool {
		if res.ByType[i].Bytes != res.ByType[j].Bytes {
			return res.ByType[i].Bytes > res.ByType[j].Bytes
		}
		return res.ByType[i].Count > res.ByType[j].Count
	})

	for _, b := range dirAgg {
		res.ByTopDir = append(res.ByTopDir, *b)
	}
	sort.SliceStable(res.ByTopDir, func(i, j int) bool {
		if res.ByTopDir[i].Bytes != res.ByTopDir[j].Bytes {
			return res.ByTopDir[i].Bytes > res.ByTopDir[j].Bytes
		}
		return res.ByTopDir[i].Path < res.ByTopDir[j].Path
	})

	big := make([]AnalysisEntry, len(entries))
	copy(big, entries)
	sort.SliceStable(big, func(i, j int) bool {
		if big[i].Size != big[j].Size {
			return big[i].Size > big[j].Size
		}
		return big[i].Path < big[j].Path
	})
	if len(big) > largestN {
		big = big[:largestN]
	}
	res.Largest = append(res.Largest, big...)
	return res
}

// topDirOf 取文件所在目录的第一段："/操作系统/Win11.iso" → "/操作系统"；
// 根目录下的散文件（"/未知.xyz"）→ ""（聚合展示为「(根目录)」）
func topDirOf(p string) string {
	d := path.Dir(strings.ReplaceAll(p, "\\", "/"))
	c := strings.Trim(d, "/")
	if c == "" {
		return ""
	}
	return "/" + strings.Split(c, "/")[0]
}

// WalkEntries 递归收集目录下全部文件（不含目录自身），并对 Driver 接口编程以便测试。
// 返回 truncated 表示达到上限提前停止（统计不完整，调用方需提示用户）。
func WalkEntries(d Driver, root string, maxEntries, maxDepth int) (out []AnalysisEntry, truncated bool, err error) {
	if maxEntries <= 0 {
		maxEntries = 200000
	}
	if maxDepth <= 0 {
		maxDepth = 12
	}
	var walk func(dir string, depth int) error
	walk = func(dir string, depth int) error {
		if depth > maxDepth {
			return nil
		}
		list, err := d.List(dir)
		if err != nil {
			// 单个子目录读失败不应让整次分析失败（权限/竞态），跳过继续
			return nil
		}
		for _, it := range list {
			if len(out) >= maxEntries {
				truncated = true
				return errStopWalk
			}
			child := path.Join(dir, it.Name)
			if it.IsDir {
				if err := walk(child, depth+1); err != nil {
					return err
				}
				continue
			}
			out = append(out, AnalysisEntry{
				Path: child, Name: it.Name, Size: it.Size, ModTime: it.ModTime, Ext: it.Ext,
			})
		}
		return nil
	}
	if err := walk(root, 1); err != nil && err != errStopWalk {
		return nil, truncated, err
	}
	return out, truncated, nil
}

// errStopWalk 内部哨兵：命中条目上限时用它快速退出递归
var errStopWalk = errStopWalkType{}

type errStopWalkType struct{}

func (errStopWalkType) Error() string { return "walk stopped: entry limit reached" }
