package fscore

import (
	"fmt"
	"runtime"
	"strings"
)

// ---- 新建内容的名称规范化（Windows 文件系统限制）----
// Windows 会在创建文件/目录时静默截断名称末尾的空格与点：浏览器传来的
// "myfolder " 实际建成 "myfolder"，之后再用原名操作即报 ERROR_DIR_NOT_FOUND(267)
// "找不到请求的文件或目录"。因此在上传/新建/重命名前统一规范化各路径段。
// Linux 文件系统无这些限制，行为保持不变。

var winReservedBase = map[string]bool{"con": true, "prn": true, "aux": true, "nul": true}

func winIsReserved(seg string) bool {
	s := strings.ToLower(seg)
	if i := strings.IndexByte(s, '.'); i > 0 { // CON.txt 这类同样保留
		s = s[:i]
	}
	if winReservedBase[s] {
		return true
	}
	if len(s) == 4 && s[3] >= '1' && s[3] <= '9' { // COM1-9 / LPT1-9
		if s[0] == 'c' && s[1] == 'o' && s[2] == 'm' {
			return true
		}
		if s[0] == 'l' && s[1] == 'p' && s[2] == 't' {
			return true
		}
	}
	return false
}

// sanitizeWinSegment 规范化单个目录/文件名段：去除尾部空格与点，拒绝保留名与非法字符
func sanitizeWinSegment(seg string) (string, error) {
	if strings.ContainsAny(seg, `<>:"/\|?*`) || strings.Contains(seg, "\x00") {
		return "", fmt.Errorf("名称 %q 含 Windows 不允许的字符（<>:\"/\\|?*）", seg)
	}
	trimmed := strings.TrimRight(seg, " .")
	if trimmed == "" {
		return "", fmt.Errorf("名称 %q 非法（仅由空格/点组成）", seg)
	}
	if winIsReserved(trimmed) {
		return "", fmt.Errorf("%q 是 Windows 保留设备名，不能作为目录或文件名", trimmed)
	}
	return trimmed, nil
}

// SanitizeSegments 无条件规范化路径各段（用于 SFTP 等"目标机 OS 未知"的场景：
// 服务器在 Linux、SFTP 目标可能是 Windows，必须按最严格规则处理）
func SanitizeSegments(vp string) (string, error) {
	if vp == "" || vp == "/" {
		return "/", nil
	}
	var out []string
	for _, seg := range strings.Split(vp, "/") {
		if seg == "" {
			continue
		}
		s, err := sanitizeWinSegment(seg)
		if err != nil {
			return "", err
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		return "", fmt.Errorf("路径非法")
	}
	return "/" + strings.Join(out, "/"), nil
}

// SanitizeNewPath 规范化"新建内容"的虚拟路径（本地上传目标 / 新建目录）；
// 非 Windows 平台原样返回（Linux 文件系统无这些限制）。
func SanitizeNewPath(vp string) (string, error) {
	if runtime.GOOS != "windows" {
		return vp, nil
	}
	return SanitizeSegments(vp)
}

// SanitizeName 规范化单个新建/重命名目标名（非 Windows 原样返回）
func SanitizeName(name string) (string, error) {
	if runtime.GOOS != "windows" {
		return name, nil
	}
	return sanitizeWinSegment(name)
}

// SanitizeNameStrict 无条件版（SFTP 目标机 OS 未知）
func SanitizeNameStrict(name string) (string, error) {
	return sanitizeWinSegment(name)
}
