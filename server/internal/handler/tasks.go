package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"
	"cloudpan/internal/model"
)

// ---- 简易任务队列（DB 状态机 + 信号量 worker，重启恢复） ----

type TaskPool struct {
	Svc   *fscore.Service
	Zips  string
	BtDir string
	meds  chan struct{}
	mu    sync.Mutex
	opts  map[uint]bool // 取消标记 taskID
}

var pool *TaskPool

func InitTaskPool(svc *fscore.Service, btDir string) {
	pool = &TaskPool{Svc: svc, BtDir: btDir, meds: make(chan struct{}, 3), opts: map[uint]bool{}}
	pool.resume()
	go pool.sweepLoop()
}

// sweepLoop 定期清扫：游客 24h 临时工作区（每小时，TTL 需要较细粒度）+
// 孤儿上传分片/回收站超期项（每 6 小时）
func (p *TaskPool) sweepLoop() {
	p.sweepUploads()
	fscore.PruneAll()
	p.sweepRecycle()
	p.sweepGuestWorkspace()
	hours := 0
	t := time.NewTicker(1 * time.Hour)
	for range t.C {
		hours++
		p.sweepGuestWorkspace()
		if hours%6 == 0 {
			p.sweepUploads()
			fscore.PruneAll()
			p.sweepRecycle()
		}
	}
}

// sweepGuestWorkspace 游客临时工作区 24 小时 TTL 清理（游客定位见 middleware.GuestReadOnly）：
// ① 游客自己本地盘：mtime 超过 24h 的文件物理删除（含 .versions 版本目录），
//   空目录自底向上删除，秒传副本账本与配额同步对账
// ② 游客回收站项：全部永久物理删除（临时空间无回收站保留）
// ③ 游客 FileVersion 账本行、超 24h 的离线/BT 任务行：清除
func (p *TaskPool) sweepGuestWorkspace() {
	var gu model.User
	if err := model.DB.Where("username = ?", model.GuestUsername).First(&gu).Error; err != nil {
		return
	}
	cutoff := time.Now().Add(-24 * time.Hour)
	var freed int64

	var pols []model.Policy
	model.DB.Where("type = ? AND status = ?", "local", "active").Find(&pols)
	for i := range pols {
		d, err := p.Svc.DriverFor(&pols[i], &gu)
		if err != nil {
			continue
		}
		root, err := fscore.PhysicalOf(d, "/")
		if err != nil || root == "" {
			continue
		}
		freed += sweepGuestDir(root, true, cutoff)
	}

	// 回收站：临时空间内的一切永久物理删除
	var items []model.RecycleItem
	model.DB.Where("user_id = ?", gu.ID).Find(&items)
	for _, item := range items {
		trashPhys := filepath.Join(p.Svc.RecycleDir, fmt.Sprint(gu.ID), item.TrashPath)
		fscore.HashPathGone(trashPhys)
		if item.Size > 0 {
			// 目录项 Size 为删除前统计的递归总大小；文件项按实际大小更准
			if fi, err := os.Stat(trashPhys); err == nil && !fi.IsDir() {
				freed += fi.Size()
			} else {
				freed += item.Size
			}
		}
		_ = os.RemoveAll(trashPhys)
		model.DB.Delete(&item)
	}

	// 版本账本行（版本文件已随盘目录物理删除）
	model.DB.Where("user_id = ?", gu.ID).Delete(&model.FileVersion{})
	// 超 24h 的游客离线/BT 任务行（下载内容已随盘清除）
	model.DB.Where("user_id = ? AND type IN ? AND created_at < ?", gu.ID, []string{"offline", "bt"}, cutoff).Delete(&model.Task{})

	if freed > 0 {
		model.DB.Model(&model.User{}).Where("id = ?", gu.ID).
			UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes - ?, 0)", freed))
	}
}

// sweepGuestDir 递归清理物理目录：mtime 早于 cutoff 的文件物理删除，.versions 目录整体删除，
// 空目录自底向上删除（isRoot 目录本身保留）；返回释放字节数
func sweepGuestDir(dir string, isRoot bool, cutoff time.Time) int64 {
	var freed int64
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	for _, e := range entries {
		p := filepath.Join(dir, e.Name())
		info, err := e.Info()
		if err != nil {
			continue
		}
		if e.IsDir() {
			// .versions 与常规目录同样按文件 mtime 判定（版本文件继承归档时旧文件的
			// mtime：主文件未过期则其版本一并保留，主文件过期则随同清除）
			freed += sweepGuestDir(p, false, cutoff)
			if rest, rerr := os.ReadDir(p); rerr == nil && len(rest) == 0 {
				_ = os.Remove(p)
			}
			continue
		}
		if info.ModTime().Before(cutoff) {
			sz := info.Size()
			fscore.HashPathGone(p)
			if err := os.Remove(p); err == nil && sz > 0 {
				freed += sz
			}
		}
	}
	_ = isRoot
	return freed
}

// sweepRecycle 按用户组的回收站保留天数永久删除超期项，并回补配额
func (p *TaskPool) sweepRecycle() {
	var groups []model.UserGroup
	model.DB.Where("recycle_retention_days > 0").Find(&groups)
	cutoffs := map[uint]time.Time{}
	gids := make([]uint, 0, len(groups))
	for _, g := range groups {
		cutoffs[g.ID] = time.Now().Add(-time.Duration(g.RecycleRetentionDays) * 24 * time.Hour)
		gids = append(gids, g.ID)
	}
	if len(gids) == 0 {
		return
	}
	var users []model.User
	model.DB.Where("group_id IN ?", gids).Find(&users)
	for _, u := range users {
		cutoff, ok := cutoffs[u.GroupID]
		if !ok {
			continue
		}
		var items []model.RecycleItem
		model.DB.Where("user_id = ? AND deleted_at < ?", u.ID, cutoff).Find(&items)
		for _, item := range items {
			trashPhys := filepath.Join(p.Svc.RecycleDir, fmt.Sprint(u.ID), item.TrashPath)
			// 超期自动清空 = 永久物理删除：移除副本记录并对账
			fscore.HashPathGone(trashPhys)
			_ = os.RemoveAll(trashPhys)
			// 目录项的 Size 为删除前统计的递归总大小，与文件同样需要退款
			if item.Size > 0 {
				model.DB.Model(&model.User{}).Where("id = ?", u.ID).
					UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes - ?, 0)", item.Size))
			}
			model.DB.Delete(&item)
		}
	}
}

func (p *TaskPool) sweepUploads() {
	cutoff := time.Now().Add(-48 * time.Hour)
	var dead []model.UploadSession
	model.DB.Where("status != 'uploading' OR updated_at < ?", cutoff).Find(&dead)
	for _, s := range dead {
		_ = os.RemoveAll(filepath.Join(p.Svc.TmpDir, s.ID))
		model.DB.Delete(&s)
	}
	// 磁盘上有但数据库无记录的孤儿目录
	if entries, err := os.ReadDir(p.Svc.TmpDir); err == nil {
		for _, e := range entries {
			var n int64
			model.DB.Model(&model.UploadSession{}).Where("id = ?", e.Name()).Count(&n)
			if n == 0 {
				_ = os.RemoveAll(filepath.Join(p.Svc.TmpDir, e.Name()))
			}
		}
	}
}

func (p *TaskPool) resume() {
	var tasks []model.Task
	model.DB.Where("status IN ?", []string{"queued", "processing"}).Find(&tasks)
	for i := range tasks {
		t := tasks[i]
		model.DB.Model(&t).UpdateColumn("status", "queued")
		go p.run(&t)
	}
}

func (p *TaskPool) submit(t *model.Task) error {
	if err := model.DB.Create(t).Error; err != nil {
		return err
	}
	go p.run(t)
	return nil
}

func (p *TaskPool) run(t *model.Task) {
	p.meds <- struct{}{}
	defer func() { <-p.meds }()
	model.DB.Model(t).UpdateColumn("status", "processing")
	var err error
	switch t.Type {
	case "offline":
		err = p.runOffline(t)
	case "bt":
		err = p.runBT(t)
	case "compress":
		err = p.runCompress(t)
	case "decompress":
		err = p.runDecompress(t)
	default:
		err = fmt.Errorf("未知任务类型 %s", t.Type)
	}
	if p.cancelled(t.ID) {
		model.DB.Model(t).Updates(map[string]interface{}{"status": "canceled"})
		return
	}
	if err != nil {
		model.DB.Model(t).Updates(map[string]interface{}{"status": "error", "error": err.Error()})
		Notify(t.UserID, "task", "任务失败", taskTypeName(t.Type)+"任务失败："+truncateRunes(err.Error(), 200), t.ID)
		return
	}
	model.DB.Model(t).Updates(map[string]interface{}{"status": "finished", "progress": 100})
	Notify(t.UserID, "task", "任务完成", taskTypeName(t.Type)+"任务完成："+taskTargetName(t), t.ID)
}

func taskTypeName(typ string) string {
	switch typ {
	case "offline":
		return "HTTP 离线下载"
	case "bt":
		return "BT/磁力链下载"
	case "compress":
		return "压缩"
	case "decompress":
		return "解压"
	case "transfer":
		return "转存"
	}
	return typ
}

// taskTargetName 从任务 Props 里提取可读的目标文件名/路径
func taskTargetName(t *model.Task) string {
	var props struct {
		Name string `json:"name"`
		Path string `json:"path"`
		URL  string `json:"url"`
	}
	if err := json.Unmarshal([]byte(t.Props), &props); err == nil {
		if props.Name != "" {
			return truncateRunes(props.Name, 80)
		}
		if props.Path != "" {
			return truncateRunes(props.Path, 80)
		}
		if props.URL != "" {
			return truncateRunes(props.URL, 80)
		}
	}
	return fmt.Sprintf("任务 #%d", t.ID)
}

func (p *TaskPool) cancelled(id uint) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.opts[id]
}

func (p *TaskPool) cancel(id uint) {
	p.mu.Lock()
	p.opts[id] = true
	p.mu.Unlock()
}

func (p *TaskPool) setProgress(id uint, pct int) {
	model.DB.Model(&model.Task{}).Where("id = ?", id).UpdateColumn("progress", pct)
}

// runOffline HTTP(S) URL 服务器代下载入网盘
func (p *TaskPool) runOffline(t *model.Task) error {
	var props struct {
		URL      string `json:"url"`
		PolicyID uint   `json:"policyId"`
		Dest     string `json:"dest"`
		Name     string `json:"name"`
	}
	if err := json.Unmarshal([]byte(t.Props), &props); err != nil {
		return err
	}
	var policy model.Policy
	if err := model.DB.First(&policy, props.PolicyID).Error; err != nil {
		return fmt.Errorf("存储策略不存在")
	}
	d, err := p.Svc.DriverFor(&policy, userOfID(t.UserID)) // 任务结果落回属主隔离目录
	if err != nil {
		return err
	}
	req, err := http.NewRequest("GET", props.URL, nil)
	if err != nil {
		return err
	}
	// 尽量模拟浏览器请求头，降低多数 CDN 基于 UA/Referer 的防盗链 403
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Connection", "keep-alive")
	resp, err := ssrfHTTP.Do(req) // SSRF 防护客户端（重定向复检 + 拨号层 IP 复检）
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("下载失败 HTTP %d：该链接可能禁止服务器端下载（防盗链/需登录/需签名），请改用可直接访问的直链", resp.StatusCode)
	}
	name := props.Name
	if name == "" {
		if u, perr := url.Parse(props.URL); perr == nil && path.Base(u.Path) != "/" && path.Base(u.Path) != "." {
			name = path.Base(u.Path)
		} else {
			name = fmt.Sprintf("download_%d.bin", t.ID)
		}
	}
	target, err := fscore.Join(props.Dest, name)
	if err != nil {
		return err
	}
	// 先落临时文件，边下边报进度
	tmpPath := path.Join(os.TempDir(), "cp_offline_"+fmt.Sprint(t.ID)+".tmp")
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	total := resp.ContentLength
	// 硬性总量上限（20GB）：即使未设配额，也防止恶意链接拖爆磁盘
	const offlineHardCap int64 = 20 << 30
	if total > offlineHardCap {
		return fmt.Errorf("文件大小 %dMB 超过 20GB 上限，已拒绝", total>>20)
	}
	// 配额预检（用户个人覆盖优先）：已知总大小且将超限时直接失败，避免白下
	if total > 0 {
		var u model.User
		if model.DB.First(&u, t.UserID).Error == nil {
			var g model.UserGroup
			if model.DB.First(&g, u.GroupID).Error == nil {
				if limit, limited := effectiveQuotaBytes(&u, &g); limited && u.UsedBytes+total > limit {
					return fmt.Errorf("超出配额（已用 %dMB / 上限 %dMB），未开始下载", u.UsedBytes>>20, limit>>20)
				}
			}
		}
	}
	var written int64
	buf := make([]byte, 256<<10)
	lastPct := -1
	for {
		if p.cancelled(t.ID) {
			f.Close()
			os.Remove(tmpPath)
			return fmt.Errorf("已取消")
		}
		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			written += int64(n)
			if written > offlineHardCap {
				// Content-Length 缺失/谎报时按实际流入字节兜底
				f.Close()
				os.Remove(tmpPath)
				return fmt.Errorf("下载量超过 20GB 上限，已中止")
			}
			if _, werr := f.Write(buf[:n]); werr != nil {
				f.Close()
				return werr
			}
			if total > 0 {
				pct := int(written * 100 / total)
				if pct != lastPct {
					p.setProgress(t.ID, pct)
					lastPct = pct
				}
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			f.Close()
			os.Remove(tmpPath)
			return rerr
		}
	}
	f.Close()
	tf, err := os.Open(tmpPath)
	if err != nil {
		return err
	}
	defer tf.Close()
	defer os.Remove(tmpPath)
	if err := d.CreateFile(target, tf); err != nil {
		return err
	}
	// 配额记账：离线下载落盘内容计入用户用量
	model.DB.Model(&model.User{}).Where("id = ?", t.UserID).
		UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes + ?, 0)", written))
	return nil
}

// runCompress 异步压缩：把若干路径打包为 zip 写入网盘，按文件数报进度
func (p *TaskPool) runCompress(t *model.Task) error {
	var props struct {
		PolicyID uint     `json:"policyId"`
		Paths    []string `json:"paths"`
		Name     string   `json:"name"`
	}
	if err := json.Unmarshal([]byte(t.Props), &props); err != nil {
		return err
	}
	var policy model.Policy
	if err := model.DB.First(&policy, props.PolicyID).Error; err != nil {
		return fmt.Errorf("存储策略不存在")
	}
	d, err := p.Svc.DriverFor(&policy, userOfID(t.UserID)) // 任务结果落回属主隔离目录
	if err != nil {
		return err
	}
	if len(props.Paths) == 0 {
		return fmt.Errorf("没有要压缩的路径")
	}
	name := props.Name
	if name == "" {
		name = fmt.Sprintf("archive_%s.zip", time.Now().Format("0102150405"))
	}
	// 按扩展名决定归档格式：.zip / .tar / .tar.gz(.tgz) / .tar.bz2(.tbz2)
	kind, tarCompress, name := archiveFormatOf(name)
	if kind == "tar" && tarCompress == "bzip2" {
		return fmt.Errorf("暂不支持打包为 .tar.bz2（Go 标准库无 bzip2 压缩；.tar.bz2 可以解压）")
	}
	// 目标目录 = 首个路径的父目录；与已有同名时自动加序号，避免覆盖
	parent := props.Paths[0]
	if i := strings.LastIndex(parent, "/"); i > 0 {
		parent = parent[:i]
	} else {
		parent = "/"
	}
	vp, err := p.uniqueArchiveName(d, parent, name)
	if err != nil {
		return err
	}
	tmpZip := filepath.Join(p.Zips, "mk_"+genID16())
	defer os.Remove(tmpZip)
	// 同一父目录下的选择用纯文件名做条目名（解压不嵌套）；跨目录时保留相对路径
	sameParent := true
	for _, pt := range props.Paths[1:] {
		if parentOf(pt) != parent {
			sameParent = false
			break
		}
	}
	items := make([]fscore.ZipItem, len(props.Paths))
	for i, pt := range props.Paths {
		it := fscore.ZipItem{Path: pt}
		if sameParent {
			it.Name = baseOf(pt)
		}
		items[i] = it
	}
	var lastPct int
	onFile := func(done, total int64) error {
		if p.cancelled(t.ID) {
			return fmt.Errorf("已取消")
		}
		if total > 0 {
			pct := int(done * 100 / total)
			if pct > lastPct && pct < 100 {
				lastPct = pct
				p.setProgress(t.ID, pct)
			}
		}
		return nil
	}
	var archSize int64
	var aerr error
	if kind == "tar" {
		archSize, aerr = p.Svc.BuildTar(d, items, tmpZip, tarCompress, onFile)
	} else {
		archSize, aerr = p.Svc.BuildZip(d, items, tmpZip, onFile)
	}
	if aerr != nil {
		return aerr
	}
	if p.cancelled(t.ID) {
		return fmt.Errorf("已取消")
	}
	// 配额预检（用户个人覆盖优先）：超限则失败，不落盘
	var u model.User
	if model.DB.First(&u, t.UserID).Error == nil {
		var g model.UserGroup
		if model.DB.First(&g, u.GroupID).Error == nil {
			if limit, limited := effectiveQuotaBytes(&u, &g); limited && u.UsedBytes+archSize > limit {
				return fmt.Errorf("超出配额（已用 %dMB / 上限 %dMB），压缩结果未保存", u.UsedBytes>>20, limit>>20)
			}
		}
	}
	f, err := os.Open(tmpZip)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := d.CreateFile(vp, f); err != nil {
		return fmt.Errorf("写入失败: %w", err)
	}
	addQuota(t.UserID, archSize)
	return nil
}

// runDecompress 异步解压：把网盘里的 zip 解压到其所在目录，按条目数报进度
func (p *TaskPool) runDecompress(t *model.Task) error {
	var props struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
	}
	if err := json.Unmarshal([]byte(t.Props), &props); err != nil {
		return err
	}
	var policy model.Policy
	if err := model.DB.First(&policy, props.PolicyID).Error; err != nil {
		return fmt.Errorf("存储策略不存在")
	}
	d, err := p.Svc.DriverFor(&policy, userOfID(t.UserID)) // 任务结果落回属主隔离目录
	if err != nil {
		return err
	}
	if props.Path == "" {
		return fmt.Errorf("没有要解压的文件")
	}
	var lastPct int
	onFile := func(done, total int) error {
		if p.cancelled(t.ID) {
			return fmt.Errorf("已取消")
		}
		if total > 0 {
			pct := done * 100 / total
			if pct > lastPct && pct < 100 {
				lastPct = pct
				p.setProgress(t.ID, pct)
			}
		}
		return nil
	}
	// 配额预检：解压产物（未压缩总大小）将超限时整体中止、不落盘
	precheck := func(total int64) error {
		var u model.User
		if model.DB.First(&u, t.UserID).Error != nil {
			return nil
		}
		var g model.UserGroup
		if model.DB.First(&g, u.GroupID).Error != nil {
			return nil
		}
		if limit, limited := effectiveQuotaBytes(&u, &g); limited && u.UsedBytes+total > limit {
			return fmt.Errorf("超出配额（已用 %dMB / 上限 %dMB），解压未开始", u.UsedBytes>>20, limit>>20)
		}
		return nil
	}
	// 解压写入的字节计入用户配额（与删除/清空回收站的冲销配对，避免账目漂移）
	// zip 有中央目录可先预检；tar 无目录表，解压后再记账
	var written int64
	var err2 error
	low := strings.ToLower(props.Path)
	if strings.HasSuffix(low, ".tar") || strings.HasSuffix(low, ".tar.gz") ||
		strings.HasSuffix(low, ".tgz") || strings.HasSuffix(low, ".tar.bz2") || strings.HasSuffix(low, ".tbz2") {
		written, err2 = p.Svc.ExtractTar(d, props.Path, onFile)
	} else {
		written, err2 = p.Svc.ExtractZip(d, props.Path, onFile, precheck)
	}
	if err2 != nil {
		return err2
	}
	addQuota(t.UserID, written)
	return nil
}

// archiveFormatOf 按文件名判定归档格式，返回 (kind, compress, canonicalName)。
// kind: "zip"|"tar"；compress: ""|"gzip"|"bzip2"（仅 tar）；canonicalName 归一化后缀
func archiveFormatOf(name string) (kind, compress, canonical string) {
	low := strings.ToLower(name)
	switch {
	case strings.HasSuffix(low, ".tar.gz") || strings.HasSuffix(low, ".tgz"):
		if strings.HasSuffix(low, ".tgz") {
			name = strings.TrimSuffix(name, ".tgz") + ".tar.gz"
		}
		return "tar", "gzip", name
	case strings.HasSuffix(low, ".tar.bz2") || strings.HasSuffix(low, ".tbz2"):
		if strings.HasSuffix(low, ".tbz2") {
			name = strings.TrimSuffix(name, ".tbz2") + ".tar.bz2"
		}
		return "tar", "bzip2", name
	case strings.HasSuffix(low, ".tar"):
		return "tar", "", name
	default:
		if !strings.HasSuffix(low, ".zip") {
			name += ".zip"
		}
		return "zip", "", name
	}
}

// archiveSuffixOf 返回归档文件的完整后缀（用于冲突改名时保留扩展名）
func archiveSuffixOf(name string) string {
	low := strings.ToLower(name)
	for _, s := range []string{".tar.gz", ".tar.bz2", ".tar", ".zip"} {
		if strings.HasSuffix(low, s) {
			return s
		}
	}
	return ""
}

// uniqueArchiveName 在 dir 下为 name 找一个不与现有文件冲突的虚拟路径（保留归档扩展名）
func (p *TaskPool) uniqueArchiveName(d fscore.Driver, dir, name string) (string, error) {
	suf := archiveSuffixOf(name)
	base := strings.TrimSuffix(name, suf)
	cand, err := fscore.Join(dir, name)
	if err != nil {
		return "", err
	}
	for n := 1; ; n++ {
		if _, serr := d.Stat(cand); serr != nil {
			return cand, nil // 不存在 → 可用
		}
		cand, err = fscore.Join(dir, fmt.Sprintf("%s_%d%s", base, n, suf))
		if err != nil {
			return "", err
		}
	}
}

// accountQuota 任务下载内容计入用户配额（BT 多文件导入用，defer 调用）
func (p *TaskPool) accountQuota(t *model.Task, bytes *int64) {
	if *bytes > 0 {
		model.DB.Model(&model.User{}).Where("id = ?", t.UserID).
			UpdateColumn("used_bytes", gorm.Expr("MAX(used_bytes + ?, 0)", *bytes))
	}
}

// ---- Offline API ----

type OfflineHandler struct{}

func (h *OfflineHandler) Create(c *gin.Context) {
	x := ctxOf(c)
	if !x.group.AllowOffline {
		dto.Fail(c, 403, "当前用户组未启用离线下载")
		return
	}
	var in struct {
		PolicyID uint   `json:"policyId" binding:"required"`
		Dest     string `json:"dest"`
		URL      string `json:"url" binding:"required"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		dto.Fail(c, 400, "参数错误")
		return
	}
	dest, err := fscore.Clean(in.Dest)
	if err != nil || dest == "" {
		dest = "/"
	}
	if !x.group.CanUsePolicy(in.PolicyID) && x.user.Role != "admin" {
		dto.Fail(c, 403, "无权使用该存储")
		return
	}
	kind := sniffOfflineKind(in.URL)
	trimmed := strings.TrimSpace(in.URL)
	// SSRF 防护：非磁力链（http 直链 / .torrent）都按 URL 校验，禁止内网/保留地址
	if !strings.HasPrefix(trimmed, "magnet:") {
		if err := validateFetchURL(in.URL); err != nil {
			dto.Fail(c, 400, err.Error())
			return
		}
	}
	if kind == "bt" {
		// BT/磁力要求「BT/磁力」功能独立开启（offline_http 只覆盖 HTTP 直链，
		// 避免仅有直链权限的用户借磁力链走 P2P 下载通道）
		if !model.AppAllowed("bt", x.user) {
			dto.Fail(c, 403, "BT/磁力功能未启用")
			return
		}
		if strings.HasPrefix(trimmed, "magnet:") {
			if err := validateMagnetTrackers(trimmed); err != nil {
				dto.Fail(c, 400, err.Error())
				return
			}
		}
	}
	props, _ := json.Marshal(map[string]interface{}{
		"url": in.URL, "policyId": in.PolicyID, "dest": dest, "name": in.Name, "kind": kind,
	})
	taskType := "offline"
	if kind == "bt" {
		taskType = "bt"
	}
	t := &model.Task{UserID: x.user.ID, Type: taskType, Props: string(props)}
	if err := pool.submit(t); err != nil {
		dto.Fail(c, 500, err.Error())
		return
	}
	middleware.Audit(c, "offline", in.URL)
	dto.OK(c, t)
}

func (h *OfflineHandler) List(c *gin.Context) {
	x := ctxOf(c)
	var items []model.Task
	model.DB.Where("user_id = ? AND type IN ?", x.user.ID, []string{"offline", "bt"}).Order("id DESC").Limit(50).Find(&items)
	dto.OK(c, items)
}

func (h *OfflineHandler) Cancel(c *gin.Context) {
	x := ctxOf(c)
	id := parseUintParam(c, "id")
	var t model.Task
	if err := model.DB.Where("id = ? AND user_id = ?", id, x.user.ID).First(&t).Error; err != nil {
		dto.Fail(c, 404, "任务不存在")
		return
	}
	pool.cancel(id)
	model.DB.Model(&t).UpdateColumn("status", "canceled")
	dto.OK(c, nil)
}

func parseUintParam(c *gin.Context, key string) uint {
	var v uint64
	fmt.Sscanf(c.Param(key), "%d", &v)
	return uint(v)
}

var _ = context.Background
var _ = time.Now
