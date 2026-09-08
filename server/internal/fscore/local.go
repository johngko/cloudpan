package fscore

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// LocalDriver 本地磁盘驱动
type LocalDriver struct {
	Root string // 物理根目录（绝对路径）
}

func NewLocal(root string) (*LocalDriver, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, fmt.Errorf("根目录不可用: %w", err)
	}
	return &LocalDriver{Root: abs}, nil
}

// Physical 虚拟路径 → 物理路径（含穿越防护）
func (d *LocalDriver) Physical(vp string) (string, error) {
	c, err := Clean(vp)
	if err != nil {
		return "", err
	}
	phys := filepath.Join(d.Root, filepath.FromSlash(c))
	rel, err := filepath.Rel(d.Root, phys)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", ErrBadPath
	}
	return phys, nil
}

func toEntry(fi os.FileInfo) Entry {
	name := fi.Name()
	ext := ""
	if !fi.IsDir() {
		if i := strings.LastIndex(name, "."); i > 0 {
			ext = strings.ToLower(name[i+1:])
		}
	}
	return Entry{Name: name, IsDir: fi.IsDir(), Size: fi.Size(), ModTime: fi.ModTime().UnixMilli(), Ext: ext}
}

func (d *LocalDriver) List(dir string) ([]Entry, error) {
	phys, err := d.Physical(dir)
	if err != nil {
		return nil, err
	}
	fi, err := os.Stat(phys)
	if err != nil {
		return nil, err
	}
	if !fi.IsDir() {
		return nil, fmt.Errorf("不是目录")
	}
	entries, err := os.ReadDir(phys)
	if err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(entries))
	for _, e := range entries {
		// .versions 为版本管理内部目录，不对用户展示
		if e.IsDir() && e.Name() == ".versions" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, toEntry(info))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (d *LocalDriver) Stat(p string) (*Entry, error) {
	phys, err := d.Physical(p)
	if err != nil {
		return nil, err
	}
	fi, err := os.Stat(phys)
	if err != nil {
		return nil, err
	}
	e := toEntry(fi)
	if p == "/" {
		e.Name = "/"
	}
	return &e, nil
}

func (d *LocalDriver) Mkdir(dir string) error {
	phys, err := d.Physical(dir)
	if err != nil {
		return err
	}
	return os.Mkdir(phys, 0o755)
}

func (d *LocalDriver) Rename(p, newName string) error {
	phys, err := d.Physical(p)
	if err != nil {
		return err
	}
	target, err := d.Physical(path.Join(path.Dir(p), newName))
	if err != nil {
		return err
	}
	if _, err := os.Stat(target); err == nil {
		return fmt.Errorf("目标名称已存在")
	}
	return os.Rename(phys, target)
}

func (d *LocalDriver) Move(src, dstDir string) error {
	sphys, err := d.Physical(src)
	if err != nil {
		return err
	}
	tphys, err := d.Physical(path.Join(dstDir, path.Base(src)))
	if err != nil {
		return err
	}
	if _, err := os.Stat(tphys); err == nil {
		return fmt.Errorf("目标已存在同名文件")
	}
	return os.Rename(sphys, tphys)
}

func (d *LocalDriver) Copy(src, dstDir string) error {
	sphys, err := d.Physical(src)
	if err != nil {
		return err
	}
	tvp, err := d.uniqueVirtual(dstDir, path.Base(src))
	if err != nil {
		return err
	}
	tphys, err := d.Physical(tvp)
	if err != nil {
		return err
	}
	return copyTree(sphys, tphys)
}

// uniqueVirtual 在虚拟目录 dir 下生成不冲突的名称，冲突时按 "name (n).ext" 递增
func (d *LocalDriver) uniqueVirtual(dir, name string) (string, error) {
	base, ext := name, ""
	if i := strings.LastIndex(name, "."); i > 0 && i < len(name)-1 {
		base, ext = name[:i], name[i:]
	}
	candidate := name
	for i := 1; i <= 9999; i++ {
		vp, err := Clean(path.Join(dir, candidate))
		if err != nil {
			return "", err
		}
		phys, err := d.Physical(vp)
		if err != nil {
			return "", err
		}
		if _, err := os.Stat(phys); err != nil {
			return vp, nil
		}
		candidate = fmt.Sprintf("%s (%d)%s", base, i, ext)
	}
	return "", fmt.Errorf("目标已存在同名文件")
}

func copyTree(src, dst string) error {
	fi, err := os.Stat(src)
	if err != nil {
		return err
	}
	if fi.IsDir() {
		if err := os.MkdirAll(dst, 0o755); err != nil {
			return err
		}
		items, err := os.ReadDir(src)
		if err != nil {
			return err
		}
		for _, it := range items {
			if err := copyTree(filepath.Join(src, it.Name()), filepath.Join(dst, it.Name())); err != nil {
				return err
			}
		}
		return nil
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func (d *LocalDriver) Delete(p string) error {
	phys, err := d.Physical(p)
	if err != nil {
		return err
	}
	if p == "/" {
		return fmt.Errorf("不能删除根目录")
	}
	return os.RemoveAll(phys)
}

func (d *LocalDriver) Open(p string) (ReadSeekCloser, error) {
	phys, err := d.Physical(p)
	if err != nil {
		return nil, err
	}
	return os.Open(phys)
}

func (d *LocalDriver) CreateFile(p string, r io.Reader) error {
	phys, err := d.Physical(p)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(phys), 0o755); err != nil {
		return err
	}
	f, err := os.Create(phys)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (d *LocalDriver) DirectURL(p string) (string, error) { return "", nil }

func (d *LocalDriver) Quota() (used, total int64, err error) {
	err = filepath.WalkDir(d.Root, func(p string, e fs.DirEntry, err error) error {
		if err != nil {
			return nil // 跳过不可达项
		}
		if !e.IsDir() {
			if info, err := e.Info(); err == nil {
				used += info.Size()
			}
		}
		return nil
	})
	return used, 0, err
}

func (d *LocalDriver) Capabilities() Cap {
	return Cap{DirectDownload: false, Upload: true, StructureList: true}
}

// WalkAll 遍历物理根下全部条目（供用量统计）
func (d *LocalDriver) WalkAll(fn func(vp string, e Entry)) {
	_ = filepath.WalkDir(d.Root, func(p string, de fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		info, err := de.Info()
		if err != nil {
			return nil
		}
		vp := filepath.ToSlash(strings.TrimPrefix(p, d.Root))
		if vp == "" {
			vp = "/"
		}
		if info.ModTime().After(time.UnixMilli(0)) {
			fn(vp, toEntry(info))
		}
		return nil
	})
}
