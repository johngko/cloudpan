//go:build !windows

package fscore

import "golang.org/x/sys/unix"

// StatfsTotalBytes 返回 path 所在文件系统的总容量（字节）；失败返回 0。
// 本地策略的"分区大小"以此为准（根目录所在分区），无需人工配置。
func StatfsTotalBytes(path string) int64 {
	var st unix.Statfs_t
	if err := unix.Statfs(path, &st); err != nil {
		return 0
	}
	return int64(st.Blocks) * int64(st.Bsize)
}
