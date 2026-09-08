package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/anacrolix/torrent"

	"cloudpan/internal/fscore"
	"cloudpan/internal/model"
)

// btProps BT/磁力链任务属性（写入 Task.Props，进度时回写展示字段）
type btProps struct {
	URL      string `json:"url"`
	PolicyID uint   `json:"policyId"`
	Dest     string `json:"dest"`
	Name     string `json:"name"`
	Kind     string `json:"kind"` // bt
	RTName   string `json:"rtName,omitempty"`
	Seeds    int    `json:"seeds,omitempty"`
	Peers    int    `json:"peers,omitempty"`
}

// runBT BT/磁力链离线下载：纯 Go torrent 客户端（DHT+tracker），完成后导入网盘
func (p *TaskPool) runBT(t *model.Task) error {
	var props btProps
	if err := json.Unmarshal([]byte(t.Props), &props); err != nil {
		return err
	}
	var policy model.Policy
	if err := model.DB.First(&policy, props.PolicyID).Error; err != nil {
		return fmt.Errorf("存储策略不存在")
	}
	d, err := p.Svc.DriverOf(&policy)
	if err != nil {
		return err
	}

	dataDir := filepath.Join(p.BtDir, fmt.Sprint(t.ID))
	_ = os.MkdirAll(dataDir, 0o755)
	defer os.RemoveAll(dataDir)

	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = dataDir
	cfg.NoUpload = true
	client, err := torrent.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("BT 客户端启动失败: %w", err)
	}
	defer client.Close()

	var tr *torrent.Torrent
	if strings.HasPrefix(props.URL, "magnet:") {
		tr, err = client.AddMagnet(props.URL)
	} else {
		// http(s) .torrent 种子文件（SSRF 防护客户端）
		resp, herr := ssrfHTTP.Get(props.URL)
		if herr != nil {
			return fmt.Errorf("种子下载失败: %w", herr)
		}
		body, rerr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if rerr != nil {
			return rerr
		}
		if resp.StatusCode >= 400 {
			return fmt.Errorf("种子下载失败 HTTP %d", resp.StatusCode)
		}
		tf := filepath.Join(dataDir, "meta.torrent")
		if werr := os.WriteFile(tf, body, 0o644); werr != nil {
			return werr
		}
		tr, err = client.AddTorrentFromFile(tf)
	}
	if err != nil {
		return fmt.Errorf("添加任务失败: %w", err)
	}

	// 等待元数据（磁力链需 DHT/PEX 发现）
	p.setTaskMsg(t.ID, "正在获取种子信息（DHT/Tracker 发现中）...")
	select {
	case <-tr.GotInfo():
	case <-time.After(3 * time.Minute):
		return fmt.Errorf("获取种子信息超时：无有效节点或无人做种")
	}
	info := tr.Info()
	props.RTName = info.BestName()
	p.saveProps(t.ID, props)

	tr.DownloadAll()
	total := info.TotalLength()

	// 进度循环
	for {
		if p.cancelled(t.ID) {
			return fmt.Errorf("已取消")
		}
		done := tr.BytesCompleted()
		if total > 0 {
			p.setProgress(t.ID, int(done*100/total))
		}
		props.Seeds = tr.Stats().ConnectedSeeders
		props.Peers = tr.Stats().ActivePeers
		p.saveProps(t.ID, props)
		if total > 0 && done >= total {
			break
		}
		time.Sleep(2 * time.Second)
	}

	// 导入网盘：单文件种子 → dest/<种子名>；多文件种子 → dest/<种子名>/<目录结构>
	// 注意 anacrolix API：f.Path() = "种子名/相对路径"（含前缀），DisplayPath() 才是纯相对路径；
	// 文件存储物理布局 = dataDir/<info.Name>/<相对路径>（单文件时 = dataDir/<info.Name>）
	files := tr.Files()
	var imported int64 // 已导入字节数（配额记账）
	defer p.accountQuota(t, &imported)
	importOne := func(vp string, phys string) error {
		src, oerr := os.Open(phys)
		if oerr != nil {
			return fmt.Errorf("导入失败: %w", oerr)
		}
		defer src.Close()
		if fi, serr := os.Stat(phys); serr == nil {
			imported += fi.Size()
		}
		return d.CreateFile(vp, src)
	}
	if len(files) == 1 {
		singleFile := files[0]
		// 单文件种子：尝试多种物理路径（兼容不同种子制作工具）
		candidates := []string{
			filepath.Join(dataDir, singleFile.DisplayPath()),
			filepath.Join(dataDir, info.Name),
		}
		if singleFile.DisplayPath() != info.Name {
			candidates = append(candidates, filepath.Join(dataDir, info.Name, singleFile.DisplayPath()))
		}
		var phys string
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				phys = c
				break
			}
		}
		if phys == "" {
			return fmt.Errorf("单文件种子物理路径未找到: 搜索 %v", candidates)
		}
		vp, jerr := fscore.Join(props.Dest, singleFile.DisplayPath())
		if jerr != nil {
			return jerr
		}
		if ierr := importOne(vp, phys); ierr != nil {
			return ierr
		}
		return nil
	}
	rootVP, err := fscore.Join(props.Dest, props.RTName)
	if err != nil {
		return err
	}
	if merr := p.mkdirChain(d, rootVP); merr != nil {
		return merr
	}
	for _, f := range files {
		if p.cancelled(t.ID) {
			return fmt.Errorf("已取消")
		}
		rel := f.DisplayPath()
		vp, jerr := fscore.Join(rootVP, rel)
		if jerr != nil {
			continue
		}
		if derr := p.mkdirChain(d, path.Dir(vp)); derr != nil {
			return derr
		}
		if ierr := importOne(vp, filepath.Join(dataDir, info.Name, filepath.FromSlash(rel))); ierr != nil {
			return ierr
		}
	}
	return nil
}

// mkdirChain 逐级创建虚拟目录（已存在则忽略）
func (p *TaskPool) mkdirChain(d interface {
	Mkdir(dir string) error
}, vp string) error {
	clean, err := fscore.Clean(vp)
	if err != nil {
		return err
	}
	if clean == "/" {
		return nil
	}
	cur := ""
	for _, seg := range strings.Split(strings.Trim(clean, "/"), "/") {
		cur += "/" + seg
		_ = d.Mkdir(cur) // 已存在会报错，忽略
	}
	return nil
}

func (p *TaskPool) setTaskMsg(id uint, msg string) {
	model.DB.Model(&model.Task{}).Where("id = ?", id).UpdateColumn("error", msg)
}

func (p *TaskPool) saveProps(id uint, props btProps) {
	b, _ := json.Marshal(props)
	model.DB.Model(&model.Task{}).Where("id = ?", id).UpdateColumn("props", string(b))
}

// sniffOfflineKind 按 URL 特征判定离线任务类型
func sniffOfflineKind(url string) string {
	u := strings.TrimSpace(url)
	if strings.HasPrefix(u, "magnet:") {
		return "bt"
	}
	if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
		if strings.HasSuffix(strings.ToLower(u), ".torrent") {
			return "bt"
		}
	}
	return "http"
}
