package fscore

import (
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
)

// AdminLocalDriver 管理员的本地盘视图：
// 根目录保持管理员自己的隔离目录（历史数据/共享路径不受影响），
// 同时把策略根下其他用户的隔离目录以一级目录形式暴露，管理员进入
// 「用户文件夹」即可浏览该用户在此盘存放的全部文件（按用户隔离管理）。
// 路由规则：虚拟路径第一段若是其他用户目录名 → 走全盘驱动（RootPath 根）；
// 否则走管理员本人驱动（RootPath/<adminDir> 根）。同名冲突时管理员本人优先。
type AdminLocalDriver struct {
	own      *LocalDriver // 管理员本人目录
	full     *LocalDriver // 策略根（全部用户目录可见）
	adminDir string
	// noMerge 为真时列根目录不再合并其他用户目录（共享/公开链接解析专用，见 ShareView）
	noMerge bool
}

// NewAdminLocalView 构造管理员本地盘视图。adminDir 为空时退化为普通全盘驱动。
func NewAdminLocalView(rootPath, adminDir string) (Driver, error) {
	if adminDir == "" {
		return NewLocal(rootPath)
	}
	own, err := NewLocal(filepath.Join(rootPath, adminDir))
	if err != nil {
		return nil, err
	}
	full, err := NewLocal(rootPath)
	if err != nil {
		return nil, err
	}
	return &AdminLocalDriver{own: own, full: full, adminDir: adminDir}, nil
}

// ShareView 返回"不合并其他用户目录"的同构视图，专供共享 / 公开链接解析使用。
//
// 为什么需要：管理员的视图在列根目录时会把策略根下每个用户目录合并成一级目录
// （管理员应有的能力）。但共享是"把我的文件给别人看"——若整盘共享时沿用该视图，
// 被共享者/游客会直接看到所有其他注册用户的目录（实测缺陷：游客在共享盘里看到了
// 用户 13519160136 的目录）。
//
// 只关闭"根目录合并"这一件事：共享若显式落在某个用户目录内部（管理员刻意共享
// 某用户的文件夹），route 仍会走 full，路径照常可访问，不误伤该场景。
func (d *AdminLocalDriver) ShareView() *AdminLocalDriver {
	return &AdminLocalDriver{own: d.own, full: d.full, adminDir: d.adminDir, noMerge: true}
}

// ForShareResolution 把驱动调整为"共享安全"形态：管理员的跨用户视图不再合并他人目录，
// 其余驱动原样返回。所有解析"他人共享内容"的入口都应经过它。
func ForShareResolution(d Driver) Driver {
	if av, ok := d.(*AdminLocalDriver); ok {
		return av.ShareView()
	}
	return d
}

// firstSegment 取虚拟路径的第一段（"/a/b" → "a"；"/" → ""）
func firstSegment(vp string) string {
	c, err := Clean(vp)
	if err != nil {
		return ""
	}
	seg := strings.TrimPrefix(c, "/")
	if i := strings.IndexByte(seg, '/'); i >= 0 {
		return seg[:i]
	}
	return seg
}

// isUserDir 判断 name 是否为策略根下（排除管理员本人）的用户目录
func (d *AdminLocalDriver) isUserDir(name string) bool {
	if name == "" || name == d.adminDir || strings.HasPrefix(name, ".") {
		return false
	}
	fi, err := os.Stat(filepath.Join(d.full.Root, name))
	return err == nil && fi.IsDir()
}

// RouteFor 按路径返回路由到的底层本地驱动（供版本迁移等需要具体物理根的操作）
func (d *AdminLocalDriver) RouteFor(vp string) *LocalDriver { return d.route(vp) }

// route 按路径第一段选择物理根
func (d *AdminLocalDriver) route(vp string) *LocalDriver {
	seg := firstSegment(vp)
	if seg == "" || seg == d.adminDir {
		return d.own
	}
	if _, err := d.own.Stat("/" + seg); err == nil {
		return d.own // 管理员本人有同名实体，优先
	}
	if d.isUserDir(seg) {
		return d.full
	}
	return d.own
}

// guardUserDir 禁止直接重命名用户目录（目录名固化在 UserSetting(local_dir)，重命名会打断该用户访问）
func (d *AdminLocalDriver) guardUserDir(p string) error {
	c, err := Clean(p)
	if err != nil {
		return err
	}
	seg := strings.TrimPrefix(c, "/")
	if i := strings.IndexByte(seg, '/'); i >= 0 {
		return nil // 非一级路径，不拦截
	}
	if seg != "" && seg != d.adminDir && d.isUserDir(seg) {
		return errors.New("用户目录不能重命名")
	}
	return nil
}

func (d *AdminLocalDriver) List(dir string) ([]Entry, error) {
	entries, err := d.route(dir).List(dir)
	if err != nil {
		return nil, err
	}
	if dir == "/" && !d.noMerge {
		// 合并其他用户目录为一级目录（管理员本人目录不重复出现；
		// 若本人目录下已有同名项，以本人实体为准）
		userDirs, _ := d.otherUserDirs()
		if len(userDirs) > 0 {
			exist := make(map[string]bool, len(entries))
			for _, e := range entries {
				exist[e.Name] = true
			}
			for _, name := range userDirs {
				if exist[name] {
					continue
				}
				if info, err := os.Stat(filepath.Join(d.full.Root, name)); err == nil {
					entries = append(entries, toEntry(info))
				}
			}
			sort.Slice(entries, func(i, j int) bool {
				if entries[i].IsDir != entries[j].IsDir {
					return entries[i].IsDir
				}
				return entries[i].Name < entries[j].Name
			})
		}
	}
	return entries, nil
}

// otherUserDirs 策略根下的用户目录列表（排除管理员本人与隐藏目录）
func (d *AdminLocalDriver) otherUserDirs() ([]string, error) {
	dirs, err := os.ReadDir(d.full.Root)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(dirs))
	for _, e := range dirs {
		if !e.IsDir() || e.Name() == d.adminDir || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		out = append(out, e.Name())
	}
	return out, nil
}

func (d *AdminLocalDriver) Stat(p string) (*Entry, error)         { return d.route(p).Stat(p) }
func (d *AdminLocalDriver) Mkdir(dir string) error                { return d.route(dir).Mkdir(dir) }
func (d *AdminLocalDriver) Open(p string) (ReadSeekCloser, error) { return d.route(p).Open(p) }
func (d *AdminLocalDriver) CreateFile(p string, r io.Reader) error {
	return d.route(p).CreateFile(p, r)
}
func (d *AdminLocalDriver) DirectURL(p string) (string, error) { return d.route(p).DirectURL(p) }
func (d *AdminLocalDriver) Capabilities() Cap                  { return d.own.Capabilities() }

// Quota 按整盘口径（策略根全量）：管理员看到的是分区总用量
func (d *AdminLocalDriver) Quota() (int64, int64, error) { return d.full.Quota() }

func (d *AdminLocalDriver) Rename(p, newName string) error {
	if err := d.guardUserDir(p); err != nil {
		return err
	}
	return d.route(p).Rename(p, newName)
}

func (d *AdminLocalDriver) Delete(p string) error {
	// 删除用户目录本身 = 删除该用户全部数据：只允许经回收站（handler 层），
	// 驱动层这里保持透明（handler 先移回收站再物理删），不额外拦截
	return d.route(p).Delete(p)
}

// Move/Copy：同一物理根内走驱动原生实现（硬链接/rename 优化）；
// 跨根（本人目录 ↔ 用户目录）用通用流式复制
func (d *AdminLocalDriver) Move(src, dstDir string) error {
	if d.route(src) == d.route(dstDir) {
		return d.route(src).Move(src, dstDir)
	}
	if err := d.xfer(src, dstDir); err != nil {
		return err
	}
	return d.route(src).Delete(src)
}

func (d *AdminLocalDriver) Copy(src, dstDir string) error {
	if d.route(src) == d.route(dstDir) {
		return d.route(src).Copy(src, dstDir)
	}
	return d.xfer(src, dstDir)
}

// xfer 跨根复制：打开 src（按 src 路由），在 dstDir（按 dstDir 路由）下建同名文件
func (d *AdminLocalDriver) xfer(src, dstDir string) error {
	e, err := d.route(src).Stat(src)
	if err != nil {
		return err
	}
	if e.IsDir {
		return errors.New("跨用户目录移动/复制目录暂不支持，请逐个操作")
	}
	rd, err := d.route(src).Open(src)
	if err != nil {
		return err
	}
	defer rd.Close()
	dst := path.Join(dstDir, e.Name)
	if err := d.route(dstDir).Mkdir(dstDir); err != nil {
		// 目录可能已存在
		if st, serr := d.route(dstDir).Stat(dstDir); serr != nil || !st.IsDir {
			return err
		}
	}
	return d.route(dstDir).CreateFile(dst, rd)
}
