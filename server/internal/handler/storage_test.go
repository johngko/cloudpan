package handler

import (
	"os"
	"path/filepath"
	"testing"
)

// hardLinked 是本功能里"不省空间"提示的依据，必须真实反映 inode 关系：
// 硬链接 → true（秒传产物，不额外占空间）；各自独立 → false。
func TestHardLinkedDetectsInode(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "a.txt")
	b := filepath.Join(dir, "b.txt")
	if err := os.WriteFile(a, []byte("same-content"), 0o644); err != nil {
		t.Fatal(err)
	}
	// 场景一：硬链接（同一 inode）
	if err := os.Link(a, b); err != nil {
		t.Skipf("当前文件系统不支持硬链接，跳过：%v", err)
	}
	if !hardLinked(a, b) {
		t.Error("硬链接应判定为 true")
	}
	// 场景二：独立副本（复制 = 不同 inode）
	c := filepath.Join(dir, "c.txt")
	if err := os.WriteFile(c, []byte("same-content"), 0o644); err != nil {
		t.Fatal(err)
	}
	if hardLinked(a, c) {
		t.Error("内容相同但不同 inode 应判定为 false")
	}
	// 场景三：路径不存在 → 安全返回 false（不得 panic/误报）
	if hardLinked(a, filepath.Join(dir, "missing.txt")) {
		t.Error("路径不存在应返回 false")
	}
}

// physToVirtual 是"只回传虚拟路径、不泄露服务器绝对路径"的关键，
// 同时必须挡住前缀之外的物理路径（越权防御）。
func TestPhysToVirtual(t *testing.T) {
	prefix := filepath.Join(t.TempDir(), "admin")
	cases := []struct {
		phys, want string
	}{
		{filepath.Join(prefix, "工资表.xlsx"), "/工资表.xlsx"},
		{filepath.Join(prefix, "虚拟桌面", "副本.xlsx"), "/虚拟桌面/副本.xlsx"},
		{prefix, ""}, // 前缀自身不是文件
		{filepath.Join(filepath.Dir(prefix), "other", "x.txt"), ""}, // 前缀之外 → 空串（不泄露）
		{"/etc/passwd", ""}, // 完全无关路径 → 空串
	}
	for _, c := range cases {
		if got := physToVirtual(c.phys, prefix); got != c.want {
			t.Errorf("physToVirtual(%q) = %q，期望 %q", c.phys, got, c.want)
		}
	}
}
