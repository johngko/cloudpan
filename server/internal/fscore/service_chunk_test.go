package fscore

import (
	"bytes"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"cloudpan/internal/model"
)

// P2.3 回归：分片记账改为按会话加锁后，
// 多会话并发上传各自的分片必须全部记账成功（不因全局锁串行，也不互相覆盖丢失）。

func setupChunkDB(t *testing.T) {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "chunk.db") + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(10000)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("打开文件库失败: %v", err)
	}
	if err := db.AutoMigrate(&model.UploadSession{}); err != nil {
		t.Fatalf("建表失败: %v", err)
	}
	model.DB = db
}

func TestSaveChunkConcurrentSessions(t *testing.T) {
	setupChunkDB(t)
	svc := NewService(t.TempDir(), t.TempDir(), t.TempDir(), t.TempDir())

	const sessions, chunks, chunkSize = 8, 16, 1024
	for s := 0; s < sessions; s++ {
		sess := &model.UploadSession{
			ID: fmt.Sprintf("%032x", s), UserID: 1, PolicyID: 1, Name: "f.bin",
			Size: int64(chunks * chunkSize), ChunkSize: chunkSize, TotalChunks: chunks,
			Received: "[]", Status: "uploading",
		}
		if err := model.DB.Create(sess).Error; err != nil {
			t.Fatalf("创建上传会话失败: %v", err)
		}
	}

	var wg sync.WaitGroup
	errCh := make(chan error, sessions*chunks)
	for s := 0; s < sessions; s++ {
		sid := fmt.Sprintf("%032x", s)
		for i := 0; i < chunks; i++ {
			wg.Add(1)
			go func(sid string, idx int) {
				defer wg.Done()
				if _, err := svc.SaveChunk(sid, idx, bytes.NewReader(make([]byte, chunkSize))); err != nil {
					errCh <- fmt.Errorf("%s#%d: %w", sid, idx, err)
				}
			}(sid, i)
		}
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatalf("并发保存分片失败: %v", err)
	}

	for s := 0; s < sessions; s++ {
		sid := fmt.Sprintf("%032x", s)
		var got model.UploadSession
		if err := model.DB.First(&got, "id = ?", sid).Error; err != nil {
			t.Fatalf("读取会话失败: %v", err)
		}
		if n := len(got.ReceivedList()); n != chunks {
			t.Fatalf("会话 %s 分片记账应为 %d，实际 %d（记账被并发覆盖丢失）", sid, chunks, n)
		}
	}
}