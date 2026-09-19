package fscore

import (
	"errors"
	"io"
	"path"
	"strings"
)

// Entry 统一文件条目
type Entry struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"` // unix 毫秒
	Ext     string `json:"ext"`
	Path    string `json:"path,omitempty"` // 搜索结果使用：策略内绝对虚拟路径
}

// Cap 驱动能力标记（借鉴 Cloudreve 能力谓词思想）
type Cap struct {
	DirectDownload bool // 是否支持直链下载
	Upload         bool // 是否支持上传
	StructureList  bool // 是否可按目录树列出
}

// Driver 存储驱动接口：本地与云盘统一抽象
type Driver interface {
	List(dir string) ([]Entry, error)
	Stat(p string) (*Entry, error)
	Mkdir(dir string) error
	Rename(p, newName string) error
	Move(src, dstDir string) error
	Copy(src, dstDir string) error
	Delete(p string) error // 物理删除（回收站逻辑在 Service 层）
	Open(p string) (ReadSeekCloser, error)
	CreateFile(p string, r io.Reader) error
	DirectURL(p string) (string, error) // 不支持返回 ""
	Quota() (used, total int64, err error)
	Capabilities() Cap
}

type ReadSeekCloser interface {
	Read([]byte) (int, error)
	Seek(int64, int) (int64, error)
	Close() error
}

// ---- 虚拟路径规整：始终以 / 开头，拒绝穿越 ----

var ErrBadPath = errors.New("非法路径")

// Clean 规整虚拟路径；返回以 / 开头的干净路径
func Clean(p string) (string, error) {
	if p == "" {
		return "/", nil
	}
	if strings.Contains(p, "\x00") {
		return "", ErrBadPath
	}
	p = strings.ReplaceAll(p, "\\", "/")
	if strings.Contains(p, "../") || strings.Contains(p, "/..") {
		return "", ErrBadPath
	}
	c := path.Clean("/" + p)
	return c, nil
}

// Join 拼接父目录与名称并校验
func Join(dir, name string) (string, error) {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "\\/") || strings.Contains(name, "\x00") {
		return "", ErrBadPath
	}
	return Clean(path.Join(dir, name))
}

// RelTo 求 child 相对 base 的路径（都为规整后的绝对虚拟路径），child 不在 base 下时报错
func RelTo(base, child string) (string, error) {
	if base == "/" {
		return strings.TrimPrefix(child, "/"), nil
	}
	if !strings.HasPrefix(child, base+"/") {
		return "", ErrBadPath
	}
	return strings.TrimPrefix(child, base+"/"), nil
}
