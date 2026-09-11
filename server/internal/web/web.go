package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed all:dist
var distFS embed.FS

// Register 把前端构建产物挂到根路径（SPA fallback 到 index.html）
func Register(r *gin.Engine) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return
	}
	httpFS := http.FS(sub)

	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if len(p) >= 4 && (p[:4] == "/api" || p[:4] == "/dav") {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "接口不存在"})
			return
		}
		name := trimSlash(p)
		// 目录路径（以 / 结尾）优先提供目录内的 index.html（如 /vendor/drawio/），
		// 对齐 http.FileServer 的目录索引行为；否则回退 SPA 兜底
		if strings.HasSuffix(name, "/") {
			if _, err := sub.Open(name + "index.html"); err == nil {
				serveAsset(c, sub, name+"index.html")
				return
			}
		}
		if _, err := sub.Open(name); err == nil {
			serveAsset(c, sub, name)
			return
		}
		index(c, httpFS)
	})
}

func serveAsset(c *gin.Context, sub fs.FS, name string) {
	f, err := sub.Open(name)
	if err != nil {
		index(c, http.FS(sub))
		return
	}
	defer f.Close()
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		c.String(http.StatusInternalServerError, "资源不可读")
		return
	}
	if st, err := f.Stat(); err == nil {
		http.ServeContent(c.Writer, c.Request, st.Name(), st.ModTime(), rs)
		return
	}
	_, _ = io.Copy(c.Writer, rs)
}

func trimSlash(p string) string {
	if p == "/" {
		return "index.html"
	}
	return p[1:]
}

func index(c *gin.Context, httpFS http.FileSystem) {
	f, err := httpFS.Open("index.html")
	if err != nil {
		c.String(http.StatusNotFound, "前端资源未构建，请先执行 web 构建")
		return
	}
	defer f.Close()
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		c.String(http.StatusInternalServerError, "前端资源不可读")
		return
	}
	if st, err := f.Stat(); err == nil {
		c.Header("Content-Type", "text/html; charset=utf-8")
		// index.html 不缓存：前端构建产物 hash 文件名会变化，避免升级后浏览器拿旧入口
		c.Header("Cache-Control", "no-cache")
		http.ServeContent(c.Writer, c.Request, "index.html", st.ModTime(), rs)
		return
	}
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Header("Cache-Control", "no-cache")
	_, _ = io.Copy(c.Writer, rs)
}
