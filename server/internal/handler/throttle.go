package handler

import (
	"sync"
	"time"

	"cloudpan/internal/fscore"
)

// leakyBucket 漏桶限速器：take(n) 消耗 n 个字节令牌，不足则阻塞等待。
// 突发上限为 1 秒流量，避免长时间空闲后瞬间放出一个大突发。
type leakyBucket struct {
	mu   sync.Mutex
	bps  int64
	tok  float64
	last time.Time
}

func newLeakyBucket(bps int64) *leakyBucket {
	return &leakyBucket{bps: bps, last: time.Now()}
}

func (b *leakyBucket) take(n int) {
	for {
		b.mu.Lock()
		now := time.Now()
		b.tok += now.Sub(b.last).Seconds() * float64(b.bps)
		if b.tok > float64(b.bps) {
			b.tok = float64(b.bps)
		}
		b.last = now
		var sleep time.Duration
		if b.tok < float64(n) {
			sleep = time.Duration((float64(n) - b.tok) / float64(b.bps) * float64(time.Second))
		}
		if sleep > 0 {
			b.mu.Unlock()
			time.Sleep(sleep)
			continue
		}
		b.tok -= float64(n)
		b.mu.Unlock()
		return
	}
}

// reset 重置水桶（Seek 后调用，重新自然累积）
func (b *leakyBucket) reset() {
	b.mu.Lock()
	b.tok = 0
	b.last = time.Now()
	b.mu.Unlock()
}

// throttleReader 限速的 ReadSeekCloser，兼容 http.ServeContent 的 Range 请求
type throttleReader struct {
	r fscore.ReadSeekCloser
	b *leakyBucket
}

// wrapThrottle kbPerSec<=0 时原样透传
func wrapThrottle(rc fscore.ReadSeekCloser, kbPerSec int64) fscore.ReadSeekCloser {
	if kbPerSec <= 0 {
		return rc
	}
	return &throttleReader{r: rc, b: newLeakyBucket(kbPerSec * 1024)}
}

// dlinkBucket 直链（免登录签名 URL）全局共享桶：防止直链被滥用打满出口带宽
var dlinkBucket = newLeakyBucket(20 << 20)

// wrapDlink 直链出口限速（全局 20MB/s）
func wrapDlink(rc fscore.ReadSeekCloser) fscore.ReadSeekCloser {
	return &throttleReader{r: rc, b: dlinkBucket}
}

func (t *throttleReader) Read(p []byte) (int, error) {
	t.b.take(len(p))
	return t.r.Read(p)
}

func (t *throttleReader) Seek(off int64, whence int) (int64, error) {
	pos, err := t.r.Seek(off, whence)
	t.b.reset()
	return pos, err
}

func (t *throttleReader) Close() error { return t.r.Close() }
