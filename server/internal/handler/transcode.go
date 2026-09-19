package handler

// 视频转码与硬件编码动态管理
//
// 项目本体不做常驻转码：视频默认 HTTP Range 原盘直出。本模块提供按需转码通道，
// 解决浏览器不支持的编码（HEVC/监控录像等）无法在线播放的问题：
//   - 探测缓存：ffmpeg 可用性/版本 + 候选编码器逐个实测试编码（10 分钟 TTL，管理员可强制刷新）。
//     硬件（Intel QSV/VAAPI、NVIDIA NVENC）驱动后装/换机器后自动纳入，无需改代码——"动态管理"。
//   - 站点开关 video_transcode：off（默认）/ auto（优先硬件，逐台机器实测可用性）/ sw（强制软件）。
//     每次拉流实时读取站点设置，管理台改完立即生效，无需重启。
//   - 流式端点 /api/fs/transcode：本地盘视频 → ffmpeg 管道 → 分片 MP4（支持边下边播、拖动）。
//     并发上限 2（保护 CPU）；客户端断开即杀进程；硬编启动失败自动回退软编重试一次。
import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"

	"github.com/gin-gonic/gin"
)

const (
	transcodeMaxConcurrent = 2
	transcodeTimeout       = 4 * time.Hour
	transcodeProbeTTL      = 10 * time.Minute
)

// 候选硬件编码器 → 运行参数（前缀）。libx264 为软件兜底，恒参与探测。
type hwEncoder struct {
	name     string
	testArgs []string
	prefix   []string // 实际转码命令的编码器参数（含 hwaccel 上下文）
}

var transcodeHWCandidates = []hwEncoder{
	{
		name:     "h264_qsv",
		testArgs: []string{"-f", "lavfi", "-i", "testsrc=duration=0.3:size=320x240:rate=10", "-c:v", "h264_qsv", "-f", "null", "-"},
		prefix:   []string{"-c:v", "h264_qsv", "-preset", "very_fast"},
	},
	{
		name:     "h264_nvenc",
		testArgs: []string{"-f", "lavfi", "-i", "testsrc=duration=0.3:size=320x240:rate=10", "-c:v", "h264_nvenc", "-preset", "p4", "-f", "null", "-"},
		prefix:   []string{"-c:v", "h264_nvenc", "-preset", "p4"},
	},
	{
		name: "h264_vaapi",
		testArgs: []string{"-hwaccel", "vaapi", "-vaapi_device", "/dev/dri/renderD128", "-f", "lavfi",
			"-i", "testsrc=duration=0.3:size=320x240:rate=10", "-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi", "-f", "null", "-"},
		prefix: []string{"-hwaccel", "vaapi", "-hwaccel_device", "/dev/dri/renderD128",
			"-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi"},
	},
}

type transcodeProbe struct {
	mu       sync.RWMutex
	at       time.Time
	ffmpeg   bool
	version  string
	hw       string   // 首个实测可用的硬件编码器（"" = 无）
	hwAll    []string // 全部实测可用的硬件编码器
	software bool     // libx264 可用（兜底恒真，除非 ffmpeg 缺失）
}

var tcProbe struct {
	mu sync.RWMutex
	st *transcodeProbe
}

// 转码并发闸（信号量）：最多同时 2 路 ffmpeg
var transcodeSlots = make(chan struct{}, transcodeMaxConcurrent)

func ffmpegArgs(ctx context.Context, args ...string) *exec.Cmd {
	c := exec.CommandContext(ctx, "ffmpeg", append([]string{"-hide_banner", "-v", "error", "-nostdin"}, args...)...)
	return c
}

// probeTranscode 探测 ffmpeg 与各编码器实测可用性（带缓存）
func probeTranscode(force bool) *transcodeProbe {
	tcProbe.mu.RLock()
	st := tcProbe.st
	tcProbe.mu.RUnlock()
	if !force && st != nil && time.Since(st.at) < transcodeProbeTTL {
		return st
	}
	tcProbe.mu.Lock()
	defer tcProbe.mu.Unlock()
	if st = tcProbe.st; st != nil && time.Since(st.at) < transcodeProbeTTL {
		return st
	}
	st = &transcodeProbe{at: time.Now()}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-version").Output()
	if err != nil {
		tcProbe.st = st
		return st
	}
	st.ffmpeg = true
	if i := strings.IndexByte(string(out), '\n'); i > 0 {
		st.version = strings.TrimSpace(string(out[:i]))
	}
	// 软编兜底
	sw := ffmpegArgs(ctx, "-f", "lavfi", "-i", "testsrc=duration=0.3:size=320x240:rate=10", "-c:v", "libx264", "-preset", "ultrafast", "-f", "null", "-")
	st.software = sw.Run() == nil
	// 硬件逐个实测（vaapi 仅在存在渲染节点时尝试）
	for _, hw := range transcodeHWCandidates {
		if hw.name == "h264_vaapi" {
			if _, err := os.Stat("/dev/dri/renderD128"); err != nil {
				continue
			}
		}
		c := ffmpegArgs(ctx, hw.testArgs...)
		if c.Run() == nil {
			st.hwAll = append(st.hwAll, hw.name)
			if st.hw == "" {
				st.hw = hw.name
			}
		}
	}
	tcProbe.st = st
	return st
}

// encoderFor 按 auto/sw 策略与探测结果返回编码器参数前缀（hw 名，libx264）
func encoderFor(st *transcodeProbe, mode string) (string, []string) {
	if mode == "auto" && st.hw != "" {
		for _, hw := range transcodeHWCandidates {
			if hw.name == st.hw {
				return hw.name, hw.prefix
			}
		}
	}
	return "libx264", []string{"-c:v", "libx264", "-preset", "veryfast"}
}

var transcodeVideoExts = map[string]bool{
	"mp4": true, "mkv": true, "mov": true, "avi": true, "wmv": true, "flv": true,
	"webm": true, "ts": true, "m2ts": true, "mpg": true, "mpeg": true, "3gp": true,
	"rm": true, "rmvb": true, "vob": true, "hevc": true, "m4v": true,
}

// Transcode GET /api/fs/transcode?policyId=&path=&t= — 按需视频转码流
func (h *SiteHandler) Transcode(c *gin.Context) {
	mode := GetSiteSettings()["video_transcode"]
	if mode != "auto" && mode != "sw" {
		dto.FailHTTP(c, 404, "视频转码未启用")
		return
	}
	st := probeTranscode(false)
	if !st.ffmpeg || (!st.software && st.hw == "") {
		dto.FailHTTP(c, 503, "ffmpeg 不可用，无法转码")
		return
	}
	select {
	case transcodeSlots <- struct{}{}:
	default:
		dto.FailHTTP(c, 429, "转码并发已满，请稍后再试")
		return
	}
	defer func() { <-transcodeSlots }()
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.FailHTTP(c, 400, err.Error())
		return
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(vp), "."))
	if !transcodeVideoExts[ext] {
		dto.FailHTTP(c, 400, "该文件不是可转码的视频")
		return
	}
	// v1 仅本地盘：云端策略文件需先取回，开销与复杂度另计
	lp, ok := d.(interface {
		Physical(vp string) (string, error)
	})
	if !ok {
		dto.FailHTTP(c, 400, "转码暂仅支持本地盘")
		return
	}
	src, err := lp.Physical(vp)
	if err != nil {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}
	if fi, err := os.Stat(src); err != nil || fi.IsDir() {
		dto.FailHTTP(c, 404, "文件不存在")
		return
	}

	encName, encPrefix := encoderFor(st, mode)

	runStream := func(args []string) bool {
		ctx, cancel := context.WithTimeout(c.Request.Context(), transcodeTimeout)
		defer cancel()
		cmd := ffmpegArgs(ctx, args...)
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return false
		}
		cmd.Stderr = nil // 丢弃 ffmpeg 进度/错误输出（错误以进程退出码判定）
		if err := cmd.Start(); err != nil {
			return false
		}
		defer func() {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			_, _ = cmd.Process.Wait()
		}()
		c.Header("Content-Type", "video/mp4")
		c.Header("Cache-Control", "no-store")
		c.Header("X-Transcode-Encoder", encName)
		buf := make([]byte, 256<<10)
		wrote := 0
		for {
			n, rerr := stdout.Read(buf)
			if n > 0 {
				if _, werr := c.Writer.Write(buf[:n]); werr != nil {
					return wrote > 0 // 客户端断开
				}
				wrote += n
			}
			if rerr != nil {
				return wrote > 0
			}
		}
	}

	// 硬编启动失败（驱动缺失/参数不支持）自动回退软编重试一次
	if encName != "libx264" {
		args := append([]string{"-i", src}, encPrefix...)
		args = append(args, "-c:a", "aac", "-b:a", "128k", "-ac", "2",
			"-movflags", "frag_keyframe+empty_moov+default_base_moof",
			"-f", "mp4", "pipe:1")
		if runStream(args) {
			return
		}
	}
	args := append([]string{"-i", src}, []string{"-c:v", "libx264", "-preset", "veryfast"}...)
	args = append(args, "-c:a", "aac", "-b:a", "128k", "-ac", "2",
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"-f", "mp4", "pipe:1")
	runStream(args)
}

// AdminTranscodeProbe GET /api/admin/transcode/probe — 强制重新探测 ffmpeg/编码器（管理台"重新检测"）
func (h *AdminHandler) AdminTranscodeProbe(c *gin.Context) {
	st := probeTranscode(true)
	working := st.hwAll
	if st.software {
		working = append([]string{"libx264"}, working...)
	}
	dto.OK(c, gin.H{
		"ffmpeg":  st.ffmpeg,
		"version": st.version,
		"hw":      st.hw,
		"working": working,
	})
}
