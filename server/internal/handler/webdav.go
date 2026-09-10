package handler

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/webdav"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

// DavFS 把本地存储策略映射为 WebDAV 文件系统：/{盘符}/...
type DavFS struct {
	Svc *fscore.Service
}

func (d *DavFS) resolve(name string) (*model.Policy, string, error) {
	name = strings.TrimPrefix(name, "/")
	if name == "" {
		return nil, "", os.ErrNotExist
	}
	parts := strings.SplitN(name, "/", 2)
	letter := parts[0]
	rest := "/"
	if len(parts) > 1 {
		rest = "/" + parts[1]
	}
	var p model.Policy
	if err := model.DB.Where("letter = ? AND type = 'local'", strings.ToUpper(letter)).First(&p).Error; err != nil {
		return nil, "", os.ErrNotExist
	}
	return &p, rest, nil
}

// davUserKey 请求上下文中的 WebDAV 登录用户（DavAuth 写入）
type davUserKey struct{}

func (d *DavFS) physical(ctx context.Context, name string) (string, error) {
	p, rest, err := d.resolve(name)
	if err != nil {
		return "", err
	}
	root := p.RootPath
	if v := ctx.Value(davUserKey{}); v != nil {
		if u, ok := v.(*model.User); ok {
			if dir := fscore.UserDirOf(u); dir != "" { // 多用户数据隔离
				root = filepath.Join(root, dir)
			}
		}
	}
	ld, err := fscore.NewLocal(root)
	if err != nil {
		return "", err
	}
	return ld.Physical(rest)
}

func (d *DavFS) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	phys, err := d.physical(ctx, name)
	if err != nil {
		return err
	}
	return os.Mkdir(phys, perm)
}

func (d *DavFS) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
	phys, err := d.physical(ctx, name)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(phys), 0o755); err != nil {
		return nil, err
	}
	return os.OpenFile(phys, flag, perm)
}

func (d *DavFS) RemoveAll(ctx context.Context, name string) error {
	phys, err := d.physical(ctx, name)
	if err != nil {
		return err
	}
	if strings.HasSuffix(name, "/") || name == "" {
		return os.ErrInvalid
	}
	return os.RemoveAll(phys)
}

func (d *DavFS) Rename(ctx context.Context, oldName, newName string) error {
	oldPhys, err := d.physical(ctx, oldName)
	if err != nil {
		return err
	}
	newPhys, err := d.physical(ctx, newName)
	if err != nil {
		return err
	}
	return os.Rename(oldPhys, newPhys)
}

func (d *DavFS) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	phys, err := d.physical(ctx, name)
	if err != nil {
		return nil, err
	}
	return os.Stat(phys)
}

// davFileInfo 用于根目录与盘符目录
type davFileInfo struct {
	name  string
	dir   bool
	size  int64
	mtime time.Time
}

func (f *davFileInfo) Name() string { return f.name }
func (f *davFileInfo) Size() int64  { return f.size }
func (f *davFileInfo) Mode() fs.FileMode {
	if f.dir {
		return fs.ModeDir | 0o755
	}
	return 0o644
}
func (f *davFileInfo) ModTime() time.Time { return f.mtime }
func (f *davFileInfo) IsDir() bool        { return f.dir }
func (f *davFileInfo) Sys() interface{}   { return nil }

// DavAuth Basic Auth：用户名 + 独立 WebDAV 密码，路径前缀 /dav/{username}/
func DavAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		settings := GetSiteSettings()
		if settings["webdav_enabled"] != "true" {
			c.String(http.StatusForbidden, "WebDAV 未启用")
			c.Abort()
			return
		}
		user, pass, ok := c.Request.BasicAuth()
		if !ok {
			c.Header("WWW-Authenticate", `Basic realm="CloudPan WebDAV"`)
			c.String(http.StatusUnauthorized, "需要认证")
			c.Abort()
			return
		}
		// 与 Web 登录同一套失败锁定（IP+用户名，5 次失败锁 15 分钟），防 WebDAV 密码暴破
		lockKey := c.ClientIP() + "|" + user
		if loginLocked(lockKey) {
			c.String(http.StatusTooManyRequests, "失败次数过多，已临时锁定，请 15 分钟后再试")
			c.Abort()
			return
		}
		var u model.User
		if err := model.DB.Where("username = ? AND disabled = false", user).First(&u).Error; err != nil {
			loginFail(lockKey)
			c.String(http.StatusUnauthorized, "用户不存在")
			c.Abort()
			return
		}
		if u.WebdavPasswordHash == "" || bcryptCompare(u.WebdavPasswordHash, pass) != nil {
			loginFail(lockKey)
			c.String(http.StatusUnauthorized, "WebDAV 密码错误（请在设置中先行设置）")
			c.Abort()
			return
		}
		loginFails.Delete(lockKey)
		var g model.UserGroup
		model.DB.First(&g, u.GroupID)
		if !g.AllowWebdav {
			c.String(http.StatusForbidden, "当前用户组未启用 WebDAV")
			c.Abort()
			return
		}
		// 只读用户组：WebDAV 只放行读操作，拒绝一切变更请求
		if g.ReadOnly {
			switch c.Request.Method {
			case http.MethodPut, http.MethodDelete, http.MethodPost, "MKCOL", "COPY", "MOVE", "PROPPATCH":
				c.String(http.StatusForbidden, "当前用户组为只读")
				c.Abort()
				return
			}
		}
		// /dav/{username}/... 校验用户名一致
		rest := strings.TrimPrefix(c.Request.URL.Path, "/dav/")
		if rest != "" && !strings.HasPrefix(rest, user+"/") && rest != user {
			c.String(http.StatusForbidden, "只能访问自己的目录空间")
			c.Abort()
			return
		}
		c.Request.URL.Path = strings.TrimPrefix("/"+rest, "/"+user)
		if c.Request.URL.Path == "" || c.Request.URL.Path == "/" {
			c.Request.URL.Path = "/"
		}
		c.Set("davUser", &u)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), davUserKey{}, &u))
		c.Next()
	}
}

func DavHandler(svc *fscore.Service) http.Handler {
	davFS := &DavFS{Svc: svc}
	// 根路径（/）自定义为盘符列表：借 webdav.Handler 处理其余
	h := webdav.Handler{
		FileSystem: davFS,
		LockSystem: webdav.NewMemLS(),
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "" {
			// PROPFIND 根：仅返回 200，客户端再进入具体盘符
			w.WriteHeader(http.StatusOK)
			return
		}
		letter := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 2)[0]
		var cnt int64
		model.DB.Model(&model.Policy{}).Where("letter = ? AND type='local' AND status != 'disabled'", strings.ToUpper(letter)).Count(&cnt)
		if cnt == 0 {
			http.Error(w, fmt.Sprintf("盘符 %s 不存在", letter), http.StatusNotFound)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// RegisterDav 挂到 gin（非 /api 前缀）。WebDAV 方法多为非标准动词，需逐个注册
func RegisterDav(r *gin.Engine, svc *fscore.Service) {
	handler := DavHandler(svc)
	dav := func(c *gin.Context) {
		// 功能门控：WebDAV 被管理员停用时拒绝挂载
		if !model.AppEnabled("webdav") {
			c.String(http.StatusForbidden, "WebDAV 已被管理员停用")
			return
		}
		DavAuth()(c)
		if c.IsAborted() {
			return
		}
		handler.ServeHTTP(c.Writer, c.Request)
	}
	methods := []string{"GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"}
	for _, m := range methods {
		r.Handle(m, "/dav/*rest", dav)
	}
	r.Handle("GET", "/dav", func(c *gin.Context) {
		c.String(http.StatusOK, "CloudPan WebDAV: /dav/{username}/{盘符}/...")
	})
}

var _ = path.Join
