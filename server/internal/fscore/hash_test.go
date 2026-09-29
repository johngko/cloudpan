package fscore

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"cloudpan/internal/model"
)

// ---- 秒传台账不变量回归测试 ----
//
// 覆盖 AGENTS.md §3 的硬性语义：
//  1. 索引只在最后一个物理副本消失时才删除；
//  2. RefCount 等于存活副本数；
//  3. 源失效时自动改指任一存活副本；
//  4. 物理已不存在的悬空副本行被清理。
//
// 使用纯 Go 内存 SQLite（modernc/glebarez），不触碰生产 MySQL。

const ledgerSize = 100

func ledgerHash(seed string) string {
	return strings.Repeat(seed, 64/len(seed))
}

// setupLedgerDB 初始化秒传台账所需的最小表结构
func setupLedgerDB(t *testing.T) {
	t.Helper()
	dsn := fmt.Sprintf("file:hashledger_%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("打开内存库失败: %v", err)
	}
	if err := db.AutoMigrate(&model.FileHash{}, &model.FileHashCopy{}); err != nil {
		t.Fatalf("建表失败: %v", err)
	}
	model.DB = db
}

// setupLedgerDBFile 用临时文件库（WAL + busy_timeout）：并发用例需要真正的多连接写竞争
func setupLedgerDBFile(t *testing.T) {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "ledger.db") + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(10000)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("打开文件库失败: %v", err)
	}
	if err := db.AutoMigrate(&model.FileHash{}, &model.FileHashCopy{}); err != nil {
		t.Fatalf("建表失败: %v", err)
	}
	model.DB = db
}

func writeFile(t *testing.T, dir, name string, size int) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, make([]byte, size), 0o644); err != nil {
		t.Fatalf("写入测试文件失败: %v", err)
	}
	return p
}

// regHash 便捷包装：RegisterHash 是包级函数（不依赖 Service 实例状态）
func regHash(t *testing.T, hash string, size int64, phys string) {
	t.Helper()
	if err := RegisterHash(hash, size, phys); err != nil {
		t.Fatalf("RegisterHash 失败: %v", err)
	}
}

func ledgerState(t *testing.T, hash string) (indexRows, copyRows, refCount int64, source string) {
	t.Helper()
	model.DB.Model(&model.FileHash{}).Where("hash = ?", hash).Count(&indexRows)
	model.DB.Model(&model.FileHashCopy{}).Where("hash = ?", hash).Count(&copyRows)
	var fh model.FileHash
	if err := model.DB.Where("hash = ?", hash).First(&fh).Error; err == nil {
		refCount = fh.RefCount
		source = fh.SourcePath
	}
	return
}

// TestHashLedgerLastCopyGoneDropsIndex 断言"最后一个副本消失才删索引"
func TestHashLedgerLastCopyGoneDropsIndex(t *testing.T) {
	setupLedgerDB(t)
	dir := t.TempDir()
	h := ledgerHash("a")

	p1 := writeFile(t, dir, "a.bin", ledgerSize)
	p2 := writeFile(t, dir, "b.bin", ledgerSize)

	regHash(t, h, ledgerSize, p1)
	if idx, cp, ref, src := ledgerState(t, h); idx != 1 || cp != 1 || ref != 1 || src != p1 {
		t.Fatalf("首次登记后应为 1/1/1 且源=%s，实际 %d/%d/%d 源=%s", p1, idx, cp, ref, src)
	}

	RegisterCopy(h, p2)
	if idx, cp, ref, _ := ledgerState(t, h); idx != 1 || cp != 2 || ref != 2 {
		t.Fatalf("登记第二副本后应为 1/2/2，实际 %d/%d/%d", idx, cp, ref)
	}

	// 删除第一个副本（恰好是当前源）：索引保留，副本数降为 1，源改指 p2
	HashPathGone(p1)
	idx, cp, ref, src := ledgerState(t, h)
	if idx != 1 || cp != 1 || ref != 1 {
		t.Fatalf("删掉一个副本后应为 1/1/1，实际 %d/%d/%d", idx, cp, ref)
	}
	if src != p2 {
		t.Fatalf("源应改指存活副本 %s，实际 %s", p2, src)
	}

	// 删除最后一个副本：整条索引删除
	HashPathGone(p2)
	if idx, cp, ref, _ := ledgerState(t, h); idx != 0 || cp != 0 || ref != 0 {
		t.Fatalf("最后一个副本消失后索引应删除，实际 %d/%d/%d", idx, cp, ref)
	}
}

// TestHashLedgerReconcileCleansDanglingCopies 断言悬空副本行（物理已不存在）被清理并修正 RefCount
func TestHashLedgerReconcileCleansDanglingCopies(t *testing.T) {
	setupLedgerDB(t)
	dir := t.TempDir()
	h := ledgerHash("b")

	p1 := writeFile(t, dir, "a.bin", ledgerSize)
	p2 := writeFile(t, dir, "b.bin", ledgerSize)
	regHash(t, h, ledgerSize, p1)
	RegisterCopy(h, p2)

	// 绕过 HashPathGone 直接物理删除 p2，模拟进程外删除导致台账悬空
	if err := os.Remove(p2); err != nil {
		t.Fatalf("删除物理文件失败: %v", err)
	}
	reconcileHash(h)

	idx, cp, ref, _ := ledgerState(t, h)
	if idx != 1 || cp != 1 || ref != 1 {
		t.Fatalf("悬空副本应被清理为 1/1/1，实际 %d/%d/%d", idx, cp, ref)
	}
}

// TestHashLedgerReconcileDropsIndexWhenAllCopiesGone 断言副本物理全消失时索引被删
func TestHashLedgerReconcileDropsIndexWhenAllCopiesGone(t *testing.T) {
	setupLedgerDB(t)
	dir := t.TempDir()
	h := ledgerHash("c")

	p1 := writeFile(t, dir, "a.bin", ledgerSize)
	regHash(t, h, ledgerSize, p1)
	if err := os.Remove(p1); err != nil {
		t.Fatalf("删除物理文件失败: %v", err)
	}
	reconcileHash(h)

	if idx, cp, _, _ := ledgerState(t, h); idx != 0 || cp != 0 {
		t.Fatalf("无存活副本时索引与副本行都应删除，实际 %d/%d", idx, cp)
	}
}

// TestHashLedgerSizeMismatchInvalidates 断言物理文件大小被篡改时索引视为失效（lookupHash 返回 nil）
func TestHashLedgerSizeMismatchInvalidates(t *testing.T) {
	setupLedgerDB(t)
	dir := t.TempDir()
	h := ledgerHash("d")

	p1 := writeFile(t, dir, "a.bin", ledgerSize)
	regHash(t, h, ledgerSize, p1)
	svc := &Service{}
	if svc.LookupHash(h, ledgerSize) == nil {
		t.Fatal("大小一致时应命中秒传索引")
	}
	// 篡改大小
	if err := os.WriteFile(p1, make([]byte, ledgerSize+10), 0o644); err != nil {
		t.Fatalf("篡改文件失败: %v", err)
	}
	if svc.LookupHash(h, ledgerSize) != nil {
		t.Fatal("物理大小不符时秒传索引应失效")
	}
}

// TestHashLedgerRenameKeepsSingleCopy 断言改名后副本行随动、不产生重复计数
func TestHashLedgerRenameKeepsSingleCopy(t *testing.T) {
	setupLedgerDB(t)
	dir := t.TempDir()
	h := ledgerHash("e")

	oldP := writeFile(t, dir, "a.bin", ledgerSize)
	regHash(t, h, ledgerSize, oldP)

	newP := filepath.Join(dir, "renamed.bin")
	if err := os.Rename(oldP, newP); err != nil {
		t.Fatalf("重命名失败: %v", err)
	}
	HashPathRenamed(oldP, newP)

	idx, cp, ref, src := ledgerState(t, h)
	if idx != 1 || cp != 1 || ref != 1 || src != newP {
		t.Fatalf("改名后应保持 1/1/1 且源=新路径，实际 %d/%d/%d 源=%s", idx, cp, ref, src)
	}
}

// TestHashLedgerDirRenameKeepsAllCopies 目录改名：同内容的多份副本必须全部随动。
// 旧实现"边迁边对账"——reconcileHash 按 stat 判悬空，而目录改名后旧路径已整体不存在，
// 尚未迁移的行会被误判悬空删掉（本用例在旧实现下会得到 1/1/1）。
func TestHashLedgerDirRenameKeepsAllCopies(t *testing.T) {
	setupLedgerDB(t)
	root := t.TempDir()
	oldDir := filepath.Join(root, "old")
	newDir := filepath.Join(root, "new")
	if err := os.MkdirAll(oldDir, 0o755); err != nil {
		t.Fatalf("建目录失败: %v", err)
	}
	h := ledgerHash("g")
	a := writeFile(t, oldDir, "a.bin", ledgerSize)
	b := writeFile(t, oldDir, "b.bin", ledgerSize)
	regHash(t, h, ledgerSize, a)
	RegisterCopy(h, b)

	if err := os.Rename(oldDir, newDir); err != nil {
		t.Fatalf("目录改名失败: %v", err)
	}
	HashPathRenamed(oldDir, newDir)

	idx, cp, ref, _ := ledgerState(t, h)
	if idx != 1 || cp != 2 || ref != 2 {
		t.Fatalf("目录改名后应保持 1/2/2，实际 %d/%d/%d", idx, cp, ref)
	}
	var nOld, nNew int64
	model.DB.Model(&model.FileHashCopy{}).Where("phys_path LIKE ?", oldDir+"%").Count(&nOld)
	model.DB.Model(&model.FileHashCopy{}).Where("phys_path LIKE ?", newDir+"%").Count(&nNew)
	if nOld != 0 || nNew != 2 {
		t.Fatalf("副本行应全部迁到新路径，旧=%d 新=%d", nOld, nNew)
	}
}

// TestLocalCreateFileRegistersLedger 本地驱动落盘必须入账；覆盖写入不得留下旧内容的行
// （旧行残留会让台账变成"旧哈希指向新内容"，等长内容时秒传会把错误字节发出去）。
func TestLocalCreateFileRegistersLedger(t *testing.T) {
	setupLedgerDB(t)
	root := t.TempDir()
	d, err := NewLocal(root)
	if err != nil {
		t.Fatalf("创建本地驱动失败: %v", err)
	}
	body1 := []byte("content-one")
	if err := d.CreateFile("/f.bin", bytes.NewReader(body1)); err != nil {
		t.Fatalf("写入失败: %v", err)
	}
	h1 := sha256HexOf(t, body1)
	if idx, cp, ref, _ := ledgerState(t, h1); idx != 1 || cp != 1 || ref != 1 {
		t.Fatalf("落盘后应登记 1/1/1，实际 %d/%d/%d", idx, cp, ref)
	}

	body2 := []byte("content-two") // 与 body1 等长、内容不同
	if len(body1) != len(body2) {
		t.Fatal("测试数据必须等长")
	}
	if err := d.CreateFile("/f.bin", bytes.NewReader(body2)); err != nil {
		t.Fatalf("覆盖写入失败: %v", err)
	}
	if idx, cp, _, _ := ledgerState(t, h1); idx != 0 || cp != 0 {
		t.Fatalf("覆盖后旧内容的台账行应清零，实际 %d/%d", idx, cp)
	}
	h2 := sha256HexOf(t, body2)
	if idx, cp, ref, _ := ledgerState(t, h2); idx != 1 || cp != 1 || ref != 1 {
		t.Fatalf("覆盖后新内容应登记 1/1/1，实际 %d/%d/%d", idx, cp, ref)
	}
}

func sha256HexOf(t *testing.T, b []byte) string {
	t.Helper()
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

// TestHashLedgerConcurrentRegisterCopy 50 路并发登记同一内容：
// 副本行不得丢失、RefCount 必须最终等于存活副本数（P1.2 事务化 + 原子重算的回归护栏）。
// 旧实现「先 Count 再 Create」会撞唯一索引静默丢行、RefCount 漂移，本用例会失败。
func TestHashLedgerConcurrentRegisterCopy(t *testing.T) {
	setupLedgerDBFile(t)
	dir := t.TempDir()
	h := ledgerHash("f")

	src := writeFile(t, dir, "src.bin", ledgerSize)
	regHash(t, h, ledgerSize, src)

	const n = 50
	paths := make([]string, n)
	for i := 0; i < n; i++ {
		paths[i] = writeFile(t, dir, fmt.Sprintf("c%02d.bin", i), ledgerSize)
	}

	var wg sync.WaitGroup
	errs := make([]error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = RegisterCopy(h, paths[i])
		}(i)
	}
	wg.Wait()

	for i, e := range errs {
		if e != nil {
			t.Fatalf("并发登记第 %d 个副本失败: %v", i, e)
		}
	}
	want := int64(n + 1)
	idx, cp, ref, _ := ledgerState(t, h)
	if idx != 1 || cp != want || ref != want {
		t.Fatalf("并发登记后应为 1/%d/%d，实际 %d/%d/%d", want, want, idx, cp, ref)
	}
}
