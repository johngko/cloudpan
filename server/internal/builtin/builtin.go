// Package builtin 内置资源库：海报设计模板与素材。
//
// 内容经 go:embed 打进单二进制，启动时物化到 <dataDir>/builtin/poster，
// 由 main 注册为只读策略「海报资源库 (T:)」（builtin 驱动 = LocalDriver+ReadOnly），
// 全体用户可见、可浏览、可下载，不可增删改。
package builtin

import (
	"embed"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed all:poster
var posterFS embed.FS

// Version 内容版本号：变化时启动即清空目标目录并重新物化（旧内容不残留）。
// 重新生成模板/素材后必须同步更新，否则存量部署不会拿到新内容。
const Version = "20260911-1"

// Materialize 把内置海报内容展开到 targetDir（= <dataDir>/builtin/poster）。
// 版本戳写在 targetDir 的父目录（不污染盘内根目录列表）；版本一致时直接跳过。
func Materialize(targetDir string) error {
	stamp := filepath.Join(filepath.Dir(targetDir), ".builtin-poster-version")
	if b, err := os.ReadFile(stamp); err == nil && strings.TrimSpace(string(b)) == Version {
		return nil
	}
	root, err := fs.Sub(posterFS, "poster")
	if err != nil {
		return err
	}
	if err := os.RemoveAll(targetDir); err != nil {
		return err
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}
	err = fs.WalkDir(root, ".", func(p string, de fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if p == "." {
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
	return os.WriteFile(stamp, []byte(Version), 0o644)
}
