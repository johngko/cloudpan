package fscore

import (
	"os"
	"path/filepath"
	"testing"
)

// 漏洞回归：管理员「整盘共享」时，被共享者/游客绝不能看到其他注册用户的目录。
//
// 背景：AdminLocalDriver 在列根目录时会把策略根下每个用户目录合并成一级目录
// （管理员应有的能力）。共享解析若沿用该视图，游客就会在共享盘里看到
// 用户 13519160136 这类目录（线上实测到的缺陷）。
func TestShareViewHidesOtherUserDirs(t *testing.T) {
	root := t.TempDir()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(root, "admin"), 0o755))
	must(os.MkdirAll(filepath.Join(root, "13519160136"), 0o755))
	must(os.WriteFile(filepath.Join(root, "admin", "我的文件.txt"), []byte("x"), 0o644))
	must(os.WriteFile(filepath.Join(root, "13519160136", "他人文件.txt"), []byte("y"), 0o644))

	d, err := NewAdminLocalView(root, "admin")
	must(err)
	av, ok := d.(*AdminLocalDriver)
	if !ok {
		t.Fatal("管理员视图类型不符")
	}

	hasName := func(entries []Entry, name string) bool {
		for _, e := range entries {
			if e.Name == name {
				return true
			}
		}
		return false
	}

	// 1) 管理员本人视图：合并能力必须保持不变（不能为修漏洞而误删该功能）
	base, err := av.List("/")
	must(err)
	if !hasName(base, "13519160136") {
		t.Error("管理员自己的视图应仍能看到其他用户目录（原有能力被误删）")
	}

	// 2) 共享视图：根目录只能出现管理员本人的内容
	view := ForShareResolution(av)
	shareEntries, err := view.List("/")
	must(err)
	if hasName(shareEntries, "13519160136") {
		t.Error("共享视图泄露了其他用户目录（漏洞未修好）")
	}
	if !hasName(shareEntries, "我的文件.txt") {
		t.Error("共享视图丢了管理员自己的文件（过度收紧）")
	}

	// 3) 不误伤：管理员刻意共享"某个用户目录内部"时仍可访问与列出
	if _, err := view.Stat("/13519160136/他人文件.txt"); err != nil {
		t.Errorf("显式落在他人目录内的共享路径应仍可访问: %v", err)
	}
	sub, err := view.List("/13519160136")
	must(err)
	if !hasName(sub, "他人文件.txt") {
		t.Error("显式共享的用户目录内容应可列出（否则会把该场景一起挡掉）")
	}

	// 4) 非管理员驱动不受影响（原样返回）
	local, err := NewLocal(filepath.Join(root, "admin"))
	must(err)
	if ForShareResolution(local) != Driver(local) {
		t.Error("普通本地驱动不该被包装")
	}
}

// 云盘等其他驱动不参与该包装（类型断言应安全失败）
func TestForShareResolutionPassesThroughNonAdmin(t *testing.T) {
	root := t.TempDir()
	d, err := NewLocal(root)
	if err != nil {
		t.Fatal(err)
	}
	if ForShareResolution(d) != Driver(d) {
		t.Error("非管理员驱动必须原样返回")
	}
}
