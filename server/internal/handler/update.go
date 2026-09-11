package handler

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"cloudpan/internal/dto"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// Version 构建时注入：go build -ldflags "-X cloudpan/internal/handler.Version=<ver>"；
// 未注入时为 dev（本地构建）
var Version = "dev"

// ---- 系统版本更新（管理台「系统更新」）----
//
// 两种来源（站点设置）：
//   - GitHub 仓库模式（默认）：update_repo=owner/repo → api.github.com 拉 latest release，
//     自动挑选 linux 资产；update_proxy 可选下载前缀（如 https://ghproxy.com/ 或自建镜像）
//   - 直链模式：update_url 直接指向二进制/压缩包，update_version 填版本号（可选）
//
// 更新流程：下载（进度/速度）→ 解包（.tar.gz/.zip，裸二进制直用）→ 备份旧二进制 →
// 原子替换 → syscall.Exec 自重启（继承 nohup 的重定向日志与运行目录，服务不中断配置）。

type UpdateHandler struct{ Site *SiteHandler }

type releaseInfo struct {
	Version string `json:"version"`
	Name    string `json:"name"`
	Notes   string `json:"notes"`
	URL     string `json:"url"`
	Size    int64  `json:"size"`
	Mode    string `json:"mode"` // github | direct
}

var upState = struct {
	sync.Mutex
	Status   string  // idle | downloading | replacing | done | error
	Progress float64 // 0-100
	Received int64
	Total    int64
	Speed    int64 // B/s
	Target   string // 目标版本
	Msg      string
	Started  time.Time
}{Status: "idle"}

func upSet(status string, msg string) {
	upState.Lock()
	upState.Status = status
	upState.Msg = msg
	upState.Started = time.Now()
	upState.Unlock()
}
func upProgress(p float64, received, total, speed int64) {
	upState.Lock()
	upState.Progress = p
	upState.Received = received
	upState.Total = total
	upState.Speed = speed
	upState.Unlock()
}

var semverRe = regexp.MustCompile(`^v?(\d+)\.(\d+)(?:\.(\d+))?`)

// compareVersion 返回 -1/0/1；非语义化版本时按字符串比较
func compareVersion(a, b string) int {
	ma, mb := semverRe.FindStringSubmatch(a), semverRe.FindStringSubmatch(b)
	if ma != nil && mb != nil {
		for i := 1; i <= 3; i++ {
			xa, xb := atoiDef(ma[i]), atoiDef(mb[i])
			if xa != xb {
				if xa < xb { return -1 }
				return 1
			}
		}
		return 0
	}
	if a == b { return 0 }
	return strings.Compare(a, b)
}
func atoiDef(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' { break }
		n = n*10 + int(c-'0')
	}
	return n
}

// Check 检查可用更新（不下载）。返回当前版本 + 最新版本 + 是否有更新。
func (h *UpdateHandler) Check(c *gin.Context) {
	s := GetSiteSettings()
	rel, err := h.latestRelease(s)
	if err != nil {
		dto.Fail(c, 502, "检查更新失败："+err.Error())
		return
	}
	ver := rel.Version
	if ver == "" {
		ver = "latest"
	}
	hasUpdate := compareVersion(ver, Version) > 0
	dto.OK(c, gin.H{
		"current":   Version,
		"latest":    ver,
		"hasUpdate": hasUpdate,
		"release":   rel,
		"checkedAt": time.Now().Unix(),
		"busy":      upState.Status == "downloading" || upState.Status == "replacing",
	})
}

// latestRelease 按站点设置解析「最新版本」（GitHub 仓库模式或直链模式）
func (h *UpdateHandler) latestRelease(s map[string]string) (*releaseInfo, error) {
	if u := strings.TrimSpace(s["update_url"]); u != "" {
		// 直链模式
		r := &releaseInfo{Version: strings.TrimSpace(s["update_version"]), URL: u, Mode: "direct"}
		if r.Version == "" {
			r.Version = "custom"
		}
		if size, err := httpHeadSize(u); err == nil {
			r.Size = size
		}
		return r, nil
	}
	repo := strings.TrimSpace(s["update_repo"])
	if repo == "" {
		repo = "johngko/cloudpan"
	}
	api := "https://api.github.com/repos/" + repo + "/releases/latest"
	req, _ := http.NewRequest("GET", api, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "cloudpan-updater")
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("无法访问 GitHub API（%s）：%w", api, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("仓库 %s 不存在或无 release", repo)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
	}
	var rel struct {
		TagName string `json:"tag_name"`
		Name    string `json:"name"`
		Body    string `json:"body"`
		Assets  []struct {
			Name string `json:"name"`
			Size int64  `json:"size"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&rel); err != nil {
		return nil, fmt.Errorf("解析 release 失败: %w", err)
	}
	if len(rel.Assets) == 0 {
		return nil, fmt.Errorf("release %s 没有可下载资产", rel.TagName)
	}
	// 资产挑选：linux+amd64 > linux > 第一个
	pick := rel.Assets[0]
	for _, a := range rel.Assets {
		n := strings.ToLower(a.Name)
		if strings.Contains(n, "linux") && (strings.Contains(n, "amd64") || strings.Contains(n, "x86_64")) {
			pick = a
			break
		}
	}
	if pick.Name == rel.Assets[0].Name {
		for _, a := range rel.Assets {
			if strings.Contains(strings.ToLower(a.Name), "linux") {
				pick = a
				break
			}
		}
	}
	dlURL := pick.URL
	if p := strings.TrimRight(strings.TrimSpace(s["update_proxy"]), "/"); p != "" {
		// 代理前缀模式：prefix + 原始资产 URL
		dlURL = p + "/" + pick.URL
	}
	return &releaseInfo{
		Version: strings.TrimPrefix(rel.TagName, "v"),
		Name:    rel.Name,
		Notes:   rel.Body,
		URL:     dlURL,
		Size:    pick.Size,
		Mode:    "github",
	}, nil
}

// Status 当前更新状态（前端 2s 轮询进度）
func (h *UpdateHandler) Status(c *gin.Context) {
	upState.Lock()
	defer upState.Unlock()
	dto.OK(c, gin.H{
		"current":  Version,
		"status":   upState.Status,
		"progress": upState.Progress,
		"received": upState.Received,
		"total":    upState.Total,
		"speed":    upState.Speed,
		"target":   upState.Target,
		"msg":      upState.Msg,
		"started":  upState.Started.Unix(),
	})
}

// History 更新记录
func (h *UpdateHandler) History(c *gin.Context) {
	var items []model.UpdateLog
	model.DB.Order("id DESC").Limit(50).Find(&items)
	dto.OK(c, items)
}

// Start 下载并替换二进制、自重启。请求立即返回，实际流程在 goroutine 中执行。
func (h *UpdateHandler) Start(c *gin.Context) {
	upState.Lock()
	if upState.Status == "downloading" || upState.Status == "replacing" {
		upState.Unlock()
		dto.Fail(c, 409, "已有更新任务正在进行")
		return
	}
	upState.Unlock()

	s := GetSiteSettings()
	rel, err := h.latestRelease(s)
	if err != nil {
		dto.Fail(c, 502, "获取更新失败："+err.Error())
		return
	}
	target := rel.Version
	upSet("downloading", "开始下载 "+target)

	go func() {
		log := model.UpdateLog{From: Version, To: target, URL: rel.URL}
		fail := func(stage string, err error) {
			upSet("error", stage+" 失败："+err.Error())
			log.Status = "failed"
			log.Error = truncate(stage+" 失败："+err.Error(), 500)
			model.DB.Create(&log)
		}
		binPath, err := h.downloadAndReplace(rel, &log)
		if err != nil {
			fail("更新", err)
			return
		}
		// 到这里二进制已替换；写日志（成功）后自重启
		log.Status = "success"
		model.DB.Create(&log)
		upSet("replacing", "正在重启…")
		time.Sleep(500) // 让状态/日志落盘
		if err := selfExec(binPath); err != nil {
			upSet("error", "替换完成但自重启失败（"+err.Error()+"），请手动重启服务")
		}
	}()
	middleware.Audit(c, "update", "开始更新 → "+target)
	dto.OK(c, gin.H{"started": true, "target": target})
}

// downloadAndReplace 下载→解包→替换，返回替换后的新二进制路径（供 selfExec 使用）。
// 注意：取当前进程路径必须发生在改名之前（改名后 /proc/self/exe 指向已删除 inode）。
func (h *UpdateHandler) downloadAndReplace(rel *releaseInfo, log *model.UpdateLog) (string, error) {
	cur, err := os.Executable()
	if err != nil {
		return "", err
	}
	cur = filepath.Clean(strings.ReplaceAll(cur, "\\", "/"))

	dir := filepath.Join(h.Site.Cfg.DataDir, "update")
	_ = os.MkdirAll(dir, 0o755)
	name := filepath.Base(strings.SplitN(rel.URL, "?", 2)[0])
	if name == "" || name == "/" || name == "." {
		name = "cloudpan-update"
	}
	tmp := filepath.Join(dir, name+".tmp")
	defer os.Remove(tmp)

	// ---- 下载（进度 + 速度）----
	req, err := http.NewRequest("GET", rel.URL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "cloudpan-updater")
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("下载返回 HTTP %d（检查直链/代理前缀是否正确）", resp.StatusCode)
	}
	total := resp.ContentLength
	if total <= 0 {
		total = rel.Size
	}
	f, err := os.Create(tmp)
	if err != nil {
		return "", err
	}
	defer f.Close()

	started := time.Now()
	var got int64
	lastTick := started
	lastGot := int64(0)
	buf := make([]byte, 256<<10)
	for {
		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := f.Write(buf[:n]); werr != nil {
				return "", werr
			}
			got += int64(n)
		}
		now := time.Now()
		if now.Sub(lastTick) >= 300*time.Millisecond {
			speed := int64(0)
			if dt := now.Sub(lastTick).Seconds(); dt > 0 {
				speed = (got - lastGot) / int64(dt)
			}
			lastTick, lastGot = now, got
			p := 0.0
			if total > 0 {
				p = float64(got) / float64(total) * 100
				if p > 100 { p = 100 }
			}
			upProgress(p, got, total, speed)
			if rerr == io.EOF {
				break
			}
		}
		if rerr != nil {
			if rerr == io.EOF {
				break
			}
			return "", rerr
		}
	}
	log.Bytes = got
	upProgress(100, got, total, 0)
	if got == 0 {
		return "", fmt.Errorf("下载内容为空")
	}

	// ---- 解包/落位 ----
	bin, err := extractBinary(tmp, dir, name)
	if err != nil {
		return "", err
	}
	defer os.Remove(bin)

	// ---- 替换：备份旧二进制 → 移入新二进制（cur 在函数开头、改名前已取得）----
	bak := cur + ".bak"
	_ = os.Remove(bak)
	if err := os.Rename(cur, bak); err != nil {
		return "", fmt.Errorf("备份旧二进制失败（%w）", err)
	}
	if err := os.Rename(bin, cur); err != nil {
		// 回滚
		_ = os.Rename(bak, cur)
		_ = os.Remove(bak)
		return "", fmt.Errorf("替换新二进制失败（%w），已回滚", err)
	}
	if err := os.Chmod(cur, 0o755); err != nil {
		_ = os.Rename(cur, bak)
		return "", fmt.Errorf("设置可执行权限失败（%w），已回滚", err)
	}
	_ = os.Remove(bak)
	return cur, nil
}

// extractBinary 从下载产物中取出可执行二进制：
// 裸二进制（ELF 魔数）直接返回；.tar.gz / .tgz / .zip 解包找 cloudpan* 可执行文件
func extractBinary(src, dir, name string) (string, error) {
	// 裸二进制？
	f, err := os.Open(src)
	if err != nil {
		return "", err
	}
	head := make([]byte, 4)
	n, _ := io.ReadFull(f, head)
	f.Close()
	if n == 4 && head[0] == 0x7f && head[1] == 'E' && head[2] == 'L' && head[3] == 'F' {
		return src, nil
	}
	lower := strings.ToLower(name)
	out := filepath.Join(dir, "cloudpan-new")
	_ = os.Remove(out)
	switch {
	case strings.HasSuffix(lower, ".tar.gz"), strings.HasSuffix(lower, ".tgz"):
		if err := extractTarGz(src, out); err != nil {
			return "", err
		}
	case strings.HasSuffix(lower, ".zip"):
		if err := extractZip(src, out); err != nil {
			return "", err
		}
	default:
		// 无魔数也无已知压缩后缀：当作裸二进制尝试（可能是 stripped 或平台差异）
		return src, nil
	}
	fi, err := os.Stat(out)
	if err != nil || fi.Size() == 0 {
		return "", fmt.Errorf("包内未找到 cloudpan 二进制（%s）", name)
	}
	return out, nil
}

func extractTarGz(src, out string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		base := filepath.Base(hdr.Name)
		if hdr.Typeflag == tar.TypeReg && (base == "cloudpan" || strings.HasPrefix(base, "cloudpan-") || strings.HasPrefix(base, "cloudpan_")) && !strings.Contains(base, ".") {
			of, err := os.Create(out)
			if err != nil {
				return err
			}
			if _, err := io.Copy(of, tr); err != nil {
				of.Close()
				return err
			}
			of.Close()
			return nil
		}
	}
	return fmt.Errorf("tar 包内未找到 cloudpan 二进制")
}

func extractZip(src, out string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, zf := range r.File {
		base := filepath.Base(zf.Name)
		if !zf.FileInfo().IsDir() && (base == "cloudpan" || strings.HasPrefix(base, "cloudpan-") || strings.HasPrefix(base, "cloudpan_")) && !strings.Contains(base, ".") {
			rc, err := zf.Open()
			if err != nil {
				return err
			}
			of, err := os.Create(out)
			if err != nil {
				rc.Close()
				return err
			}
			_, cerr := io.Copy(of, rc)
			rc.Close()
			of.Close()
			if cerr != nil {
				return cerr
			}
			return nil
		}
	}
	return fmt.Errorf("zip 包内未找到 cloudpan 二进制")
}

// updateListener 由 main 注入的 HTTP 监听器：自重启前必须先关闭它释放端口，
// 否则 exec 继承 FD 表，新进程 net.Listen 同一端口会 EADDRINUSE
var updateListener interface{ Close() error }

// SetUpdateListener 由 main 在建立监听后调用
func SetUpdateListener(l interface{ Close() error }) {
	updateListener = l
}

// selfExec 用新二进制原地替换当前进程（继承工作目录/环境变量）。
// 注意：不能用 os.Executable()——旧二进制已被改名，/proc/self/exe 指向已删除的
// inode，exec 会报 "no such file or directory"；必须显式传替换后的新二进制路径。
func selfExec(path string) error {
	if updateListener != nil {
		_ = updateListener.Close()
	}
	if err := syscall.Exec(path, os.Args, os.Environ()); err != nil {
		return err
	}
	return nil
}

func httpHeadSize(u string) (int64, error) {
	req, _ := http.NewRequest("HEAD", u, nil)
	req.Header.Set("User-Agent", "cloudpan-updater")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	resp.Body.Close()
	return resp.ContentLength, nil
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}
