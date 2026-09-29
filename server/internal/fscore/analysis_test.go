package fscore

import (
	"errors"
	"io"
	"testing"
)

func TestTypeCategory(t *testing.T) {
	cases := []struct{ ext, wantKey string }{
		{"iso", "system"}, {".ISO", "system"}, {"exe", "system"},
		{"zip", "archive"}, {"7z", "archive"},
		{"docx", "doc"}, {"pdf", "doc"},
		{"jpg", "image"}, {"svg", "image"},
		{"mp4", "media"}, {"mp3", "media"},
		{"sav", "data"}, {"xlsx", "doc"},
		{"", otherTypeKey}, {"unknownext", otherTypeKey},
	}
	for _, c := range cases {
		k, lbl := TypeCategory(c.ext)
		if k != c.wantKey {
			t.Errorf("TypeCategory(%q) 键 = %q，期望 %q", c.ext, k, c.wantKey)
		}
		if lbl == "" {
			t.Errorf("TypeCategory(%q) 标签为空", c.ext)
		}
	}
}

func TestBuildAnalysisAggregates(t *testing.T) {
	entries := []AnalysisEntry{
		{Path: "/操作系统/Win11.iso", Name: "Win11.iso", Size: 6000, Ext: "iso"},
		{Path: "/操作系统/Win10.iso", Name: "Win10.iso", Size: 4000, Ext: "iso"},
		{Path: "/Adobe/Ps.zip", Name: "Ps.zip", Size: 2000, Ext: "zip"},
		{Path: "/工资表.xlsx", Name: "工资表.xlsx", Size: 100, Ext: "xlsx"},
		{Path: "/未知.xyz", Name: "未知.xyz", Size: 50, Ext: "xyz"},
	}
	a := BuildAnalysis(entries, 3)

	if a.TotalFiles != 5 || a.TotalBytes != 12150 {
		t.Fatalf("总计错误: files=%d bytes=%d", a.TotalFiles, a.TotalBytes)
	}
	if a.Truncated {
		t.Fatal("不该标记截断")
	}
	// 类型降序：system(10000) > archive(2000) > doc(100) > other(50)
	if len(a.ByType) != 4 {
		t.Fatalf("类型数 = %d，期望 4", len(a.ByType))
	}
	if a.ByType[0].Key != "system" || a.ByType[0].Bytes != 10000 || a.ByType[0].Count != 2 {
		t.Errorf("类型首位错误: %+v", a.ByType[0])
	}
	if a.ByType[3].Key != otherTypeKey {
		t.Errorf("末位应为「其它」，实际 %s", a.ByType[3].Key)
	}
	// 顶层目录降序：/操作系统(10000) > /Adobe(2000) > /(150，根下散文件)
	if len(a.ByTopDir) != 3 {
		t.Fatalf("顶层目录数 = %d，期望 3", len(a.ByTopDir))
	}
	if a.ByTopDir[0].Path != "/操作系统" || a.ByTopDir[0].Bytes != 10000 {
		t.Errorf("目录首位错误: %+v", a.ByTopDir[0])
	}
	if a.ByTopDir[2].Path != "" || a.ByTopDir[2].Bytes != 150 {
		t.Errorf("根目录散文件应聚合为 \"\" 且为 150: %+v", a.ByTopDir[2])
	}
	// 大文件排行：取前 3，降序
	if len(a.Largest) != 3 {
		t.Fatalf("大文件数 = %d，期望 3", len(a.Largest))
	}
	if a.Largest[0].Name != "Win11.iso" || a.Largest[2].Name != "Ps.zip" {
		t.Errorf("大文件排行错误: %+v", a.Largest)
	}
}

func TestBuildAnalysisEmpty(t *testing.T) {
	a := BuildAnalysis(nil, 0)
	if a.TotalFiles != 0 || a.TotalBytes != 0 {
		t.Fatal("空输入应为零值统计")
	}
	// 三个切片都应是"非 nil 空切片"，保证 JSON 序列化成 [] 而不是 null
	if a.ByType == nil || a.ByTopDir == nil || a.Largest == nil {
		t.Fatal("空输入时切片不应为 nil（否则前端拿到 null）")
	}
}

func TestBuildAnalysisTieBreakStable(t *testing.T) {
	// 同体积时按路径升序，结果必须稳定可预期
	entries := []AnalysisEntry{
		{Path: "/b.bin", Name: "b.bin", Size: 10, Ext: "bin"},
		{Path: "/a.bin", Name: "a.bin", Size: 10, Ext: "bin"},
	}
	a := BuildAnalysis(entries, 2)
	if a.Largest[0].Path != "/a.bin" || a.Largest[1].Path != "/b.bin" {
		t.Errorf("同体积应按路径升序: %+v", a.Largest)
	}
}

// ---- 遍历：用桩驱动验证递归、深度与上限 ----

type stubDriver struct {
	tree map[string][]Entry
	fail map[string]bool
}

func (s *stubDriver) List(dir string) ([]Entry, error) {
	if s.fail[dir] {
		return nil, errors.New("模拟读取失败")
	}
	return s.tree[dir], nil
}
func (s *stubDriver) Stat(string) (*Entry, error)         { return nil, nil }
func (s *stubDriver) Mkdir(string) error                  { return nil }
func (s *stubDriver) Rename(string, string) error         { return nil }
func (s *stubDriver) Move(string, string) error           { return nil }
func (s *stubDriver) Copy(string, string) error           { return nil }
func (s *stubDriver) Delete(string) error                 { return nil }
func (s *stubDriver) Open(string) (ReadSeekCloser, error) { return nil, nil }
func (s *stubDriver) CreateFile(string, io.Reader) error  { return nil }
func (s *stubDriver) DirectURL(string) (string, error)    { return "", nil }
func (s *stubDriver) Quota() (int64, int64, error)        { return 0, 0, nil }
func (s *stubDriver) Capabilities() Cap                   { return Cap{} }

func TestWalkEntriesRecursiveAndLimits(t *testing.T) {
	d := &stubDriver{tree: map[string][]Entry{
		"/":          {{Name: "a.txt", Size: 1}, {Name: "dir1", IsDir: true}},
		"/dir1":      {{Name: "b.txt", Size: 2}, {Name: "dir2", IsDir: true}},
		"/dir1/dir2": {{Name: "c.txt", Size: 3}},
		"/broken":    {},
	}}
	d.fail = map[string]bool{"/broken": true}

	got, trunc, err := WalkEntries(d, "/", 100, 12)
	if err != nil || trunc {
		t.Fatalf("正常遍历不应报错/截断: err=%v trunc=%v", err, trunc)
	}
	if len(got) != 3 {
		t.Fatalf("应收集 3 个文件，实际 %d: %+v", len(got), got)
	}
	// 路径必须是拼接后的完整虚拟路径
	paths := map[string]int64{}
	for _, e := range got {
		paths[e.Path] = e.Size
	}
	if paths["/a.txt"] != 1 || paths["/dir1/b.txt"] != 2 || paths["/dir1/dir2/c.txt"] != 3 {
		t.Errorf("路径拼接错误: %+v", paths)
	}

	// 上限 2 → 截断标记为真，且不超上限
	got2, trunc2, err2 := WalkEntries(d, "/", 2, 12)
	if err2 != nil {
		t.Fatalf("截断不应报错: %v", err2)
	}
	if !trunc2 || len(got2) > 2 {
		t.Errorf("应截断且不超上限: trunc=%v n=%d", trunc2, len(got2))
	}

	// 深度 1 → 只统计根层文件
	got3, _, _ := WalkEntries(d, "/", 100, 1)
	if len(got3) != 1 || got3[0].Path != "/a.txt" {
		t.Errorf("深度 1 应只收集根层文件: %+v", got3)
	}
}

func TestWalkEntriesSkipsUnreadableSubdir(t *testing.T) {
	// 子目录读失败必须跳过而不是整体失败（权限/竞态）
	d := &stubDriver{tree: map[string][]Entry{
		"/":    {{Name: "ok.txt", Size: 1}, {Name: "bad", IsDir: true}},
		"/bad": {},
	}, fail: map[string]bool{"/bad": true}}
	got, _, err := WalkEntries(d, "/", 100, 12)
	if err != nil {
		t.Fatalf("子目录失败不应让整体失败: %v", err)
	}
	if len(got) != 1 || got[0].Name != "ok.txt" {
		t.Errorf("应保留可读文件: %+v", got)
	}
}
