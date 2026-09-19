//go:build windows

package fscore

// StatfsTotalBytes Windows 无 statfs 等价物，返回 0（前端按"总容量未知"中性显示）。
func StatfsTotalBytes(path string) int64 { return 0 }
