package handler

// B7 媒体预览边车（浏览器端生成、上传回填）——Jellyfin Preview Thumbnails 的单二进制路线：
// 服务端零 ffmpeg 依赖。上传完成后浏览器对视频逐时刻 seek + canvas 拼 sprite 大图，
// 对音频 decodeAudioData 降采样波形峰值，POST 回本端点存为边车文件：
//   video → pv-<key>.png（sprite 图）+ pv-<key>.json（n/cols/w/h 元数据）
//   audio → pv-<key>.json（peaks 数组）
// 缓存键与缩略图/封面同款：sha1(pv|kind|uid|vp|size|mtime)——文件被改写后旧边车
// 自然失效（键变化），随 ThumbDir 的 pruneThumbs 淘汰。读取走 /fs/raw?pv=json|png。
// 代价：只有「新上传」（浏览器端上传）的文件有边车；WebDAV/旧文件没有，播放器按缺省降级。

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"cloudpan/internal/fscore"
	"cloudpan/internal/dto"

	"github.com/gin-gonic/gin"
)

const (
	pvSpriteMax  = 8 << 20  // sprite PNG 上限
	pvMetaMax    = 64 << 10 // 元数据 JSON 上限
	pvPeaksMax   = 4000     // 波形峰值桶数上限
	pvFrameMax   = 1000     // sprite 帧数上限
	pvSpriteCell = 320      // sprite 单元格边长上限
)

// pvSidecarKey 边车缓存键（与 cover/thumb 同款推导：属主 + kind + 路径 + size + mtime）
func pvSidecarKey(uid uint, kind, vp string, size, mtime int64) string {
	sum := sha1.Sum([]byte(fmt.Sprintf("pv|%s|%d|%s|%d|%d", kind, uid, vp, size, mtime)))
	return hex.EncodeToString(sum[:])
}

// pvMeta 边车元数据（video/audio 共用一个结构，按 Kind 使用不同字段）
type pvMeta struct {
	Kind     string    `json:"kind"` // video | audio
	N        int       `json:"n,omitempty"`
	Cols     int       `json:"cols,omitempty"`
	W        int       `json:"w,omitempty"`
	H        int       `json:"h,omitempty"`
	Length   float64   `json:"length,omitempty"`
	Duration float64   `json:"duration,omitempty"`
	Peaks    []float64 `json:"peaks,omitempty"`
}

func (m *pvMeta) validate() error {
	switch m.Kind {
	case "video":
		if m.N <= 0 || m.N > pvFrameMax || m.Cols <= 0 || m.Cols > 50 ||
			m.W <= 0 || m.W > pvSpriteCell || m.H <= 0 || m.H > pvSpriteCell {
			return errors.New("sprite 元数据超出范围")
		}
		if m.Length > 24*3600 {
			return errors.New("视频时长超出范围")
		}
		return nil
	case "audio":
		if len(m.Peaks) == 0 || len(m.Peaks) > pvPeaksMax {
			return errors.New("波形峰值数量超出范围")
		}
		for _, p := range m.Peaks {
			if p < 0 || p > 1 {
				return errors.New("波形峰值越界")
			}
		}
		if m.Duration > 24*3600 {
			return errors.New("音频时长超出范围")
		}
		return nil
	default:
		return errors.New("kind 必须为 video 或 audio")
	}
}

// PreviewUpload POST /api/fs/preview（multipart）：上传边车。
// 文件必须已存在（先上传本体再回填边车）；键由服务端按文件当前 size/mtime 推导，
// 客户端无法伪造指向他人路径的边车写入目标。
func (h *SiteHandler) PreviewUpload(c *gin.Context) {
	if !requireWritable(c) {
		return
	}
	policyID, _ := strconv.ParseUint(c.PostForm("policyId"), 10, 64)
	_, d, ok := h.resolveWritableByID(uint(policyID), c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.PostForm("path"))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	e, err := d.Stat(vp)
	if err != nil || e.IsDir || e.Size <= 0 {
		dto.Fail(c, 404, "文件不存在")
		return
	}
	var meta pvMeta
	if err := json.Unmarshal([]byte(c.PostForm("meta")), &meta); err != nil {
		dto.Fail(c, 400, "meta 不是合法 JSON")
		return
	}
	if err := meta.validate(); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	key := pvSidecarKey(ctxOf(c).user.ID, meta.Kind, vp, e.Size, e.ModTime)
	jsonPath := filepath.Join(h.Fs.ThumbDir, "pv-"+key+".json")

	// video 必须带 sprite PNG（校验魔数，防任意字节落盘被当图渲染）
	pngPath := ""
	if meta.Kind == "video" {
		fh, ferr := c.FormFile("sprite")
		if ferr != nil {
			dto.Fail(c, 400, "缺少 sprite 图像")
			return
		}
		if fh.Size <= 0 || fh.Size > pvSpriteMax {
			dto.Fail(c, 400, "sprite 图像超出大小限制")
			return
		}
		f, oerr := fh.Open()
		if oerr != nil {
			dto.Fail(c, 400, "sprite 读取失败")
			return
		}
		defer f.Close()
		buf := make([]byte, pvSpriteMax+1)
		n, _ := io.ReadFull(f, buf)
		if n > pvSpriteMax || n < 8 || buf[0] != 0x89 || buf[1] != 'P' || buf[2] != 'N' || buf[3] != 'G' {
			dto.Fail(c, 400, "sprite 必须是不超过 8MB 的 PNG")
			return
		}
		pngPath = filepath.Join(h.Fs.ThumbDir, "pv-"+key+".png")
		if err := os.WriteFile(pngPath, buf[:n], 0o644); err != nil {
			dto.Fail(c, 500, "sprite 保存失败")
			return
		}
	}
	// 重新编码后落盘（不回写客户端原文）：字段白名单，杜绝把边车当任意文件写入口
	out, err := json.Marshal(&meta)
	if err != nil {
		if pngPath != "" {
			os.Remove(pngPath)
		}
		dto.Fail(c, 500, "meta 编码失败")
		return
	}
	if len(out) > pvMetaMax {
		if pngPath != "" {
			os.Remove(pngPath)
		}
		dto.Fail(c, 400, "meta 过大")
		return
	}
	if err := os.WriteFile(jsonPath, out, 0o644); err != nil {
		if pngPath != "" {
			os.Remove(pngPath)
		}
		dto.Fail(c, 500, "meta 保存失败")
		return
	}
	pruneThumbs(h.Fs.ThumbDir, 5000)
	dto.OK(c, gin.H{"stored": true})
}

// servePV /fs/raw?pv=json|png —— 读边车（不存在 404，播放器自行降级）
func (h *SiteHandler) servePV(c *gin.Context, x ctx3, d fscore.Driver, vp string, want string) {
	if want != "json" && want != "png" {
		dto.FailHTTP(c, 400, "pv 只支持 json/png")
		return
	}
	e, err := d.Stat(vp)
	if err != nil || e.IsDir || e.Size <= 0 {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	// json 先查 audio 再查 video；png 只可能来自 video
	kinds := []string{"audio", "video"}
	if want == "png" {
		kinds = []string{"video"}
	}
	for _, kind := range kinds {
		key := pvSidecarKey(x.user.ID, kind, vp, e.Size, e.ModTime)
		b, err := os.ReadFile(filepath.Join(h.Fs.ThumbDir, "pv-"+key+"."+want))
		if err != nil || len(b) == 0 {
			continue
		}
		mime := "application/json"
		if want == "png" {
			mime = "image/png"
		}
		// 键含 size/mtime，文件改写后键即变——可安全长缓存
		c.Header("Cache-Control", "public, max-age=86400")
		c.Data(http.StatusOK, mime, b)
		return
	}
	dto.FailHTTP(c, 404, "无预览数据")
}
