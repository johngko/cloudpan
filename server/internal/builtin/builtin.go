// Package builtin 内置资源库：海报设计模板与素材。
//
// 内容经 go:embed 打进单二进制，启动时物化到 <dataDir>/builtin/poster，
// 由 main 注册为只读策略「海报资源库 (T:)」（builtin 驱动 = LocalDriver+ReadOnly），
// 全体用户可见、可浏览、可下载，不可增删改；管理员经 /poster/admin/* 专属接口
// 可以上传/删除内置素材与模板（直接写物化目录，不经 fs 层）。
package builtin

import (
	"embed"
	"encoding/json"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

//go:embed all:poster
var posterFS embed.FS

// Version 内容版本号：变化时启动会把嵌入内容重新展开到目标目录（合并语义，
// 管理员后续添加的文件保留）。重新生成模板/素材后必须同步更新本常量。
const Version = "20260911-1"

// fonts 内置字体清单（manifest 的 fonts 段；与 vendor/poster/fonts/ 内容对应）
var fonts = []map[string]string{
	{"value": "zcool-kuaile-regular", "alias": "站酷快乐体", "url": "fonts/zcool-kuaile-regular.woff2"},
	{"value": "zcool-xiaowei-regular", "alias": "站酷小薇体", "url": "fonts/zcool-xiaowei-regular.woff2"},
}

// Materialize 把内置海报内容展开到 targetDir（= <dataDir>/builtin/poster）。
// 版本戳写在 targetDir 的父目录；版本一致时跳过展开。
// 合并语义：展开时不清空目录、覆盖同名文件（管理员上传的内容得以保留），
// index.json 一律不入盘——物化/管理员变更后统一由 RebuildManifest 现扫现生成。
func Materialize(targetDir string) error {
	stamp := filepath.Join(filepath.Dir(targetDir), ".builtin-poster-version")
	if b, err := os.ReadFile(stamp); err == nil && strings.TrimSpace(string(b)) == Version {
		return RebuildManifest(targetDir)
	}
	root, err := fs.Sub(posterFS, "poster")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}
	err = fs.WalkDir(root, ".", func(p string, de fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if p == "." || p == "poster/index.json" {
			return nil
		}
		phys := filepath.Join(targetDir, filepath.FromSlash(p))
		if de.IsDir() {
			return os.MkdirAll(phys, 0o755)
		}
		f, err := root.Open(p)
		if err != nil {
			return err
		}
		out, err := os.Create(phys)
		if err != nil {
			f.Close()
			return err
		}
		_, cerr := io.Copy(out, f)
		f.Close()
		out.Close()
		return cerr
	})
	if err != nil {
		return err
	}
	if err := os.WriteFile(stamp, []byte(Version), 0o644); err != nil {
		return err
	}
	return RebuildManifest(targetDir)
}

// tplSize 解析模板 JSON 的画布尺寸：新格式为数组取首页 global，旧格式为 {page,widgets}
func tplSize(path string) (int, int) {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0, 0
	}
	var arr []struct {
		Global struct {
			Width  any `json:"width"`
			Height any `json:"height"`
		} `json:"global"`
	}
	if err := json.Unmarshal(b, &arr); err == nil && len(arr) > 0 {
		return numInt(arr[0].Global.Width), numInt(arr[0].Global.Height)
	}
	var one struct {
		Page struct {
			Width  any `json:"width"`
			Height any `json:"height"`
		} `json:"page"`
	}
	if err := json.Unmarshal(b, &one); err == nil {
		return numInt(one.Page.Width), numInt(one.Page.Height)
	}
	return 0, 0
}

func numInt(v any) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	case string:
		n := 0
		for _, r := range x {
			if r < '0' || r > '9' {
				break
			}
			n = n*10 + int(r-'0')
		}
		return n
	}
	return 0
}

// dirCategory 素材子目录 → 展示类别。历史素材目录为英文名（模板 JSON 内按英文路径
// 引用素材，不可改名），清单里的 category 用中文与前端筛选 chips 对应；
// 管理员上传时直接用中文子目录，原名透传。
var dirCategory = map[string]string{
	"backgrounds": "背景",
	"decorations": "装饰",
	"borders":     "边框",
	"icons":       "图标",
	"textures":    "纹理",
}

// RebuildManifest 现扫 templates/ 与 materials/ 目录重建 index.json。
// 管理员上传/删除内置资源后调用；启动物化后也会调用（保证管理员自定义内容进清单）。
func RebuildManifest(dir string) error {
	man := map[string]any{"version": Version, "fonts": fonts}

	var tpls []map[string]any
	if te, err := os.ReadDir(filepath.Join(dir, "templates")); err == nil {
		sort.Slice(te, func(i, j int) bool { return te[i].Name() < te[j].Name() })
		for _, e := range te {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			w, h := tplSize(filepath.Join(dir, "templates", e.Name()))
			m := map[string]any{
				"file":   "/templates/" + e.Name(),
				"width":  w,
				"height": h,
			}
			// 缩略图：同名 png（无则不留，前端回落占位块）
			thumbName := strings.TrimSuffix(e.Name(), ".json") + ".png"
			if _, err := os.Stat(filepath.Join(dir, "templates", thumbName)); err == nil {
				m["thumb"] = "/templates/" + thumbName
			}
			tpls = append(tpls, m)
		}
	}
	man["templates"] = tpls

	var mats []map[string]any
	_ = filepath.WalkDir(filepath.Join(dir, "materials"), func(p string, de fs.DirEntry, err error) error {
		if err != nil || de.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(p))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".svg" && ext != ".gif" {
			return nil
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return nil
		}
		cat := filepath.Base(filepath.Dir(p))
		if mapped, ok := dirCategory[cat]; ok {
			cat = mapped
		}
		mats = append(mats, map[string]any{"file": "/" + filepath.ToSlash(rel), "category": cat})
		return nil
	})
	sort.Slice(mats, func(i, j int) bool { return mats[i]["file"].(string) < mats[j]["file"].(string) })
	man["materials"] = mats

	out, err := json.MarshalIndent(man, "", " ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "index.json"), out, 0o644)
}
