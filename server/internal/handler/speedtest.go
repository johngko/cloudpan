package handler

import (
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
)

// SpeedTestHandler 网络测速（内置应用，界面仿 LibreSpeed）
// download = 流式输出随机数据（no-store 防缓存/防压缩，客户端按字节计时）
// upload   = 接收随机字节并丢弃，返回实际接收量
// ping     = 返回服务端时间戳，客户端测 RTT 中位数
type SpeedTestHandler struct{}

const (
	stDefaultDl = 40 << 20  // 单次下载默认 40MB（100Mbps 链路约 3.2s，多连接足够跑满测试时长）
	stMaxDl     = 256 << 20 // 单次下载上限 256MB
	stMaxUp     = 128 << 20 // 单次上传上限 128MB
	stChunk     = 64 << 10  // 流式块 64KB
)

func (h *SpeedTestHandler) Ping(c *gin.Context) {
	dto.OK(c, gin.H{"at": time.Now().UnixMilli()})
}

func (h *SpeedTestHandler) Download(c *gin.Context) {
	size := stDefaultDl
	if s := c.Query("size"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil && n > 0 {
			size = int(n)
		}
	}
	if size > stMaxDl {
		size = stMaxDl
	}
	c.Header("Cache-Control", "no-store")
	c.Header("Content-Type", "application/octet-stream")
	// 不设 Content-Length（走 chunked）：客户端按固定时长 abort 流，声明了长度会被
	// Chromium 记成 ERR_CONTENT_LENGTH_MISMATCH 控制台错误（噪音）；客户端按字节计时，不依赖该头
	c.Status(http.StatusOK)

	buf := make([]byte, stChunk)
	flusher, _ := c.Writer.(http.Flusher)
	written := 0
	ctx := c.Request.Context()
	for written < size {
		n := stChunk
		if size-written < n {
			n = size - written
		}
		// 顶层 rand.Read 走带锁全局源，并发安全；rand.New(rand.NewSource(...)) 的源无锁，
		// 并发测速连接同时 Read 会竞争 RNG 内部状态导致 panic（生产日志曾出现 index out of range [-1]）
		rand.Read(buf[:n])
		c.Writer.Write(buf[:n])
		written += n
		if flusher != nil {
			flusher.Flush()
		}
		select {
		case <-ctx.Done():
			return // 客户端提前断开（测速固定时长后取消）
		default:
		}
	}
}

func (h *SpeedTestHandler) Upload(c *gin.Context) {
	n, _ := io.Copy(io.Discard, io.LimitReader(c.Request.Body, stMaxUp))
	dto.OK(c, gin.H{"bytes": n})
}
