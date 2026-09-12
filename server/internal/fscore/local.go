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

	"cloudpan/internal/model"
)

// LocalDriver 本地磁盘驱动
type LocalDriver struct {
	Root string // 物理根目录（绝对路径）；多用户场景下为 RootPath/<用户目录>/
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
	// 重命名为原名 = 无操作（Windows 同款；否则下面的存在性检查会把自己当成"已存在的目标"）
	if phys == target {
		return nil
	}
	if _, err := os.Stat(target); err == nil {
		return fmt.Errorf("目标名称已存在")
	}
	if err := os.Rename(phys, target); err == nil {
		unlinkHashMoved(phys, target)
	}
	return err
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
	if err := os.Rename(sphys, tphys); err == nil {
		unlinkHashMoved(sphys, tphys)
	}
	return err
}

// unlinkHashMoved 物理移动后同步哈希索引副本记录（按新位置判断文件/目录；目录整体随动）
func unlinkHashMoved(oldPhys, newPhys string) {
	HashPathRenamed(oldPhys, newPhys)
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
	if err := copyTree(sphys, tphys); err != nil {
		return err
	}
	HashPathCopied(sphys, tphys)
	return nil
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
	// 物理删除前移除哈希索引副本记录（目录遍历其下文件；最后一个副本消失时索引随之删除）
	HashPathGone(phys)
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
	// rename-in 原子替换：先写同目录临时文件再改名覆盖目标（借鉴 Cloudreve「写入即产生新 blob」）。
	// 避免 os.Create 就地截断：① 并发读者（下载/预览）不会读到写一半的文件；② 崩溃时目标保留旧内容；
	// ③ 目标若是版本文件的硬链接，替换目录项不影响版本原件。
	// Windows 下 Rename 不能覆盖已存在文件，先 Remove 再 Rename（存在极短空窗，可接受）。
	tmp := phys + ".cp-part"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	_, werr := io.Copy(f, r)
	cerr := f.Close()
	if werr != nil || cerr != nil {
		_ = os.Remove(tmp)
		if werr != nil {
			return werr
		}
		return cerr
	}
	if err := os.Remove(phys); err != nil && !os.IsNotExist(err) {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, phys); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
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

// ---- 多用户数据隔离 ----

// UserDirOf 返回用户在本地策略根目录下的物理子目录名（每用户独立目录，互不可见）。
// 纯 ASCII 安全用户名直接用用户名；其他（如中文用户名）用 user_<id>。
// 首次生成的目录名固化到 UserSetting(local_dir)，此后即使改用户名目录也不变。
func UserDirOf(u *model.User) string {
	if u == nil {
		return ""
	}
	var set model.UserSetting
	if model.DB.Where("user_id = ? AND key = ?", u.ID, "local_dir").First(&set).Error == nil && set.Value != "" {
		return set.Value
	}
	name := fmt.Sprintf("user_%d", u.ID)
	if safeDirName(u.Username) {
		name = u.Username
	}
	_ = model.DB.Create(&model.UserSetting{UserID: u.ID, Key: "local_dir", Value: name}).Error
	return name
}

func safeDirName(s string) bool {
	if len(s) < 2 || len(s) > 32 {
		return false
	}
	for _, r := range s {
		switch {
		case r == '_' || r == '-':
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
		default:
			return false
		}
	}
	return true
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
