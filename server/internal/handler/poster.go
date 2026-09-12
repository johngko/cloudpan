package handler

// 海报设计资源管理（管理员专属，挂 /api/admin/poster/*）：
//  1. 内置资源库（T:，物化于 <dataDir>/builtin/poster）的上传/删除——绕过 fs 只读层
//     直接写物化目录，变更后重建 index.json 清单；fs 层对普通用户仍全程只读
//  2. 查看任意用户的海报资源（作品 /poster/*.poster.json、素材 /poster/素材/、
//     模板 /poster/模板/）——普通用户互相不可见，仅管理员可查看
import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"cloudpan/internal/builtin"
	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
)

const posterMaxUpload = 20 << 20 // 单文件上限 20MB（素材图/模板 JSON/缩略图）

var posterImageExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true, ".gif": true, ".svg": true}

// posterSafeName 文件名安全化：去路径分隔与控制字符，留中文/字母/数字/_-.() 空格
func posterSafeName(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|':
			b.WriteRune('_')
		case r < 0x20 || r == 0x7f:
			// 丢掉控制字符
		default:
			b.WriteRune(r)
		}
	}
	out := strings.Trim(b.String(), ". ")
	if out == "" {
		return ""
	}
	if len(out) > 120 {
		out = out[:120]
	}
	return out
}

// posterUnder 校验 sub 拼进 base 后仍在 base 内（防穿越）
func posterUnder(base, sub string) (string, bool) {
	p := filepath.Clean(filepath.Join(base, sub))
	rel, err := filepath.Rel(base, p)
	if err != nil || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", false
	}
	return p, true
}

// posterBuiltinDir 内置资源库物化目录
func (h *AdminHandler) posterBuiltinDir() string {
	return filepath.Join(h.Site.Cfg.DataDir, "builtin", "poster")
}

// PosterBuiltinUpload 上传内置素材/模板。multipart：file、kind=material|template、
// category（素材分类子目录，默认「未分类」）、name（可选重命名）、thumb（模板缩略图，可选 png）。
// 上传后重建 index.json 清单，模板/素材库立即可见（素材/模板同名覆盖 = 更换）。
func (h *AdminHandler) PosterBuiltinUpload(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		dto.Fail(c, 400, "缺少文件")
		return
	}
	if fh.Size > posterMaxUpload {
		dto.Fail(c, 400, "文件过大（上限 20MB）")
		return
	}
	kind := c.PostForm("kind")
	dir := h.posterBuiltinDir()
	switch kind {
	case "material":
		category := posterSafeName(c.PostForm("category"))
		if category == "" {
			category = "未分类"
		}
		name := posterSafeName(c.PostForm("name"))
		if name == "" {
			name = posterSafeName(fh.Filename)
		}
		if name == "" || !posterImageExts[strings.ToLower(filepath.Ext(name))] {
			dto.Fail(c, 400, "素材须为图片文件（png/jpg/webp/gif/svg）")
			return
		}
		dst, ok := posterUnder(dir, filepath.Join("materials", category, name))
		if !ok {
			dto.Fail(c, 400, "路径非法")
			return
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			dto.Fail(c, 500, "创建分类目录失败")
			return
		}
		if err := c.SaveUploadedFile(fh, dst); err != nil {
			dto.Fail(c, 500, "保存失败："+err.Error())
			return
		}
		if err := builtin.RebuildManifest(dir); err != nil {
			dto.Fail(c, 500, "清单重建失败："+err.Error())
			return
		}
		middleware.Audit(c, "poster_builtin", "上传内置素材 "+category+"/"+name)
		dto.OK(c, gin.H{"path": "materials/" + category + "/" + name})
	case "template":
		name := posterSafeName(c.PostForm("name"))
		if name == "" {
			name = posterSafeName(fh.Filename)
		}
		if name == "" {
			dto.Fail(c, 400, "缺少模板文件名")
			return
		}
		if !strings.HasSuffix(strings.ToLower(name), ".json") {
			name += ".json"
		}
		dst, ok := posterUnder(dir, filepath.Join("templates", name))
		if !ok {
			dto.Fail(c, 400, "路径非法")
			return
		}
		if err := c.SaveUploadedFile(fh, dst); err != nil {
			dto.Fail(c, 500, "保存失败："+err.Error())
			return
		}
		// 可选缩略图：同名 png
		if th, err := c.FormFile("thumb"); err == nil && th.Size > 0 && th.Size <= posterMaxUpload {
			base := strings.TrimSuffix(name, filepath.Ext(name))
			thumbDst, ok2 := posterUnder(dir, filepath.Join("templates", base+".png"))
			if ok2 {
				_ = c.SaveUploadedFile(th, thumbDst)
			}
		}
		if err := builtin.RebuildManifest(dir); err != nil {
			dto.Fail(c, 500, "清单重建失败："+err.Error())
			return
		}
		middleware.Audit(c, "poster_builtin", "上传内置模板 "+name)
		dto.OK(c, gin.H{"path": "templates/" + name})
	default:
		dto.Fail(c, 400, "kind 须为 material 或 template")
	}
}

// PosterBuiltinDelete 删除内置素材/模板。?path=materials/背景/x.png 或 templates/x.json
// （模板会连带删同名缩略图）。删除后重建 index.json。
func (h *AdminHandler) PosterBuiltinDelete(c *gin.Context) {
	rel := c.Query("path")
	dir := h.posterBuiltinDir()
	dst, ok := posterUnder(dir, rel)
	if !ok || dst == dir {
		dto.Fail(c, 400, "路径非法")
		return
	}
	relSlash := filepath.ToSlash(filepath.Clean(rel))
	inTemplates := strings.HasPrefix(relSlash, "templates/")
	inMaterials := strings.HasPrefix(relSlash, "materials/")
	if !inTemplates && !inMaterials {
		dto.Fail(c, 400, "仅允许删除 templates/ 或 materials/ 下的资源")
		return
	}
	if _, err := os.Stat(dst); err != nil {
		dto.Fail(c, 404, "资源不存在")
		return
	}
	if err := os.Remove(dst); err != nil {
		dto.Fail(c, 500, "删除失败："+err.Error())
		return
	}
	// 模板连带删除同名缩略图
	if inTemplates && strings.HasSuffix(relSlash, ".json") {
		base := strings.TrimSuffix(relSlash, ".json")
		if thumb, ok2 := posterUnder(dir, base+".png"); ok2 {
			_ = os.Remove(thumb)
		}
	}
	if err := builtin.RebuildManifest(dir); err != nil {
		dto.Fail(c, 500, "清单重建失败："+err.Error())
		return
	}
	middleware.Audit(c, "poster_builtin", "删除内置资源 "+relSlash)
	dto.OK(c, gin.H{"deleted": relSlash})
}

// posterFileEntry 用户海报资源条目
type posterFileEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"` // 相对该用户 poster/ 目录（'/' 分隔）
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"`
}

func posterListDir(root, sub string, filter func(name string) bool) []posterFileEntry {
	out := []posterFileEntry{}
	entries, err := os.ReadDir(filepath.Join(root, sub))
	if err != nil {
		return out
	}
	for _, e := range entries {
		if e.IsDir() || (filter != nil && !filter(e.Name())) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, posterFileEntry{
			Name:    e.Name(),
			Path:    filepath.ToSlash(filepath.Join(sub, e.Name())),
			Size:    info.Size(),
			ModTime: info.ModTime().UnixMilli(),
		})
	}
	return out
}

// posterUserDir 解析目标用户的 poster 目录（首个本地策略根 + 用户隔离子目录 + /poster）
func (h *AdminHandler) posterUserDir(uid uint) (string, *model.User, error) {
	var u model.User
	if err := model.DB.First(&u, uid).Error; err != nil {
		return "", nil, fmt.Errorf("用户不存在")
	}
	var pol model.Policy
	if err := model.DB.Where("type = ? AND status = ?", "local", "active").Order("letter ASC").First(&pol).Error; err != nil {
		return "", &u, fmt.Errorf("没有本地磁盘策略")
	}
	return filepath.Join(pol.RootPath, fscore.UserDirOf(&u), "poster"), &u, nil
}

// PosterUserLib 查看任意用户的海报资源（作品/素材/模板三个清单，只读）
func (h *AdminHandler) PosterUserLib(c *gin.Context) {
	dir, u, err := h.posterUserDir(uidOfParam(c))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	isPosterWork := func(name string) bool {
		return strings.HasSuffix(name, ".poster.json") || strings.HasSuffix(strings.ToLower(name), ".png")
	}
	isImage := func(name string) bool { return posterImageExts[strings.ToLower(filepath.Ext(name))] }
	isTpl := func(name string) bool { return strings.HasSuffix(name, ".poster.json") || strings.HasSuffix(name, ".json") }
	dto.OK(c, gin.H{
		"user":      gin.H{"id": u.ID, "username": u.Username, "nickname": u.Nickname},
		"exists":    func() bool { _, err := os.Stat(dir); return err == nil }(),
		"works":     posterListDir(dir, ".", isPosterWork),
		"materials": posterListDir(dir, "素材", isImage),
		"templates": posterListDir(dir, "模板", isTpl),
	})
}

// PosterUserFile 读取任意用户 poster/ 目录下的文件（图片内联预览用，?t= 令牌可带）
func (h *AdminHandler) PosterUserFile(c *gin.Context) {
	dir, _, err := h.posterUserDir(uidOfParam(c))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	p, ok := posterUnder(dir, c.Query("path"))
	if !ok {
		dto.Fail(c, 400, "路径非法")
		return
	}
	st, err := os.Stat(p)
	if err != nil || st.IsDir() {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	// 模板 JSON 预览按文本，图片按内联
	if strings.HasSuffix(strings.ToLower(p), ".json") {
		c.Header("Content-Type", "application/json; charset=utf-8")
	}
	c.File(p)
}

func uidOfParam(c *gin.Context) uint {
	var id uint
	fmt.Sscanf(c.Query("uid"), "%d", &id)
	return id
}
