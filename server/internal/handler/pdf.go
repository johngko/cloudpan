package handler

// A6 PDF 工具箱（pdfcpu，纯 Go 无外部进程）：页数信息 / 合并 / 按页拆分。
// 文件搬运走 fscore Driver：Open 取 ReadSeeker，产物 CreateFile 落回原存储；
// 云盘也支持（读写经驱动抽象）。大小/数量上限防超大 PDF 撑爆内存与临时盘。

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

const (
	pdfMaxFileBytes = 200 << 20 // 单个 PDF ≤ 200MB
	pdfMergeMax     = 30        // 合并份数上限
	pdfSplitMaxOut  = 300       // 拆分产物份数上限
)

func pdfConf() *model.Configuration {
	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed
	return conf
}

// checkPdfEntry 校验虚拟路径指向 .pdf 且大小合规
func checkPdfEntry(d fscore.Driver, vp string) (*fscore.Entry, error) {
	e, err := d.Stat(vp)
	if err != nil {
		return nil, fmt.Errorf("文件不存在")
	}
	if e.IsDir || !strings.EqualFold(e.Ext, "pdf") {
		return nil, fmt.Errorf("不是 PDF 文件")
	}
	if e.Size <= 0 || e.Size > pdfMaxFileBytes {
		return nil, fmt.Errorf("PDF 大小超限（1B ~ 200MB）")
	}
	return e, nil
}

// uniqueNameIn 同目录撞名时追加 -1/-2…（suffix 为扩展名，dir 传空扩展名时传 ""）
func uniqueNameIn(d fscore.Driver, dir, base, ext string) string {
	try := func(n string) bool {
		vp, _ := fscore.Join(dir, n)
		_, err := d.Stat(vp)
		return err != nil
	}
	if try(base) {
		return base
	}
	for i := 1; i <= 999; i++ {
		if try(fmt.Sprintf("%s-%d%s", base, i, ext)) {
			return fmt.Sprintf("%s-%d%s", base, i, ext)
		}
	}
	return base
}

// PdfInfo 页数 + 结构校验（只读接口）
func (h *SiteHandler) PdfInfo(c *gin.Context) {
	_, d, ok := h.resolve(c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(c.Query("path"))
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	if _, err := checkPdfEntry(d, vp); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	rc, err := d.Open(vp)
	if err != nil {
		dto.Fail(c, 404, "打开失败")
		return
	}
	defer rc.Close()
	n, err := api.PageCount(context.Background(), rc, pdfConf())
	if err != nil {
		dto.Fail(c, 400, "PDF 解析失败: "+err.Error())
		return
	}
	dto.OK(c, gin.H{"pages": n})
}

// PdfMerge 合并多个 PDF（顺序 = 选择顺序）→ 新文件落回首个文件的目录
func (h *SiteHandler) PdfMerge(c *gin.Context) {
	if !requireWritable(c) {
		return
	}
	var in struct {
		PolicyID uint     `json:"policyId" binding:"required"`
		Paths    []string `json:"paths" binding:"required"`
		Name     string   `json:"name"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Paths) < 2 {
		dto.Fail(c, 400, "至少选择 2 个 PDF")
		return
	}
	if len(in.Paths) > pdfMergeMax {
		dto.Fail(c, 400, fmt.Sprintf("一次最多合并 %d 个 PDF", pdfMergeMax))
		return
	}
	p, d, ok := h.resolveWritableByID(in.PolicyID, c)
	if !ok {
		return
	}
	rss := make([]io.ReadSeeker, 0, len(in.Paths))
	defer func() {
		for _, r := range rss {
			if c, ok := r.(io.Closer); ok {
				_ = c.Close()
			}
		}
	}()
	dir := ""
	names := []string{}
	for _, raw := range in.Paths {
		vp, err := fscore.Clean(raw)
		if err != nil {
			dto.Fail(c, 400, err.Error())
			return
		}
		e, err := checkPdfEntry(d, vp)
		if err != nil {
			dto.Fail(c, 400, filepath.Base(vp)+": "+err.Error())
			return
		}
		rc, err := d.Open(vp)
		if err != nil {
			dto.Fail(c, 400, filepath.Base(vp)+": 打开失败")
			return
		}
		rss = append(rss, rc)
		names = append(names, e.Name)
		if dir == "" {
			dir = filepath.Dir(vp)
		}
	}
	base := strings.TrimSpace(in.Name)
	if base == "" {
		base = strings.TrimSuffix(names[0], filepath.Ext(names[0])) + "-合并.pdf"
	}
	if !strings.EqualFold(filepath.Ext(base), ".pdf") {
		base += ".pdf"
	}
	out := uniqueNameIn(d, dir, base, ".pdf")
	tmp, err := os.CreateTemp("", "cppdf-merge-*.pdf")
	if err != nil {
		dto.Fail(c, 500, "临时文件失败")
		return
	}
	defer func() { tmp.Close(); os.Remove(tmp.Name()) }()
	if err := api.MergeRaw(context.Background(), rss, tmp, false, pdfConf()); err != nil {
		dto.Fail(c, 400, "合并失败: "+err.Error())
		return
	}
	if _, err := tmp.Seek(0, 0); err != nil {
		dto.Fail(c, 500, "合并产物回读失败")
		return
	}
	outVP, _ := fscore.Join(dir, out)
	if err := d.CreateFile(outVP, tmp); err != nil {
		dto.Fail(c, 500, "写入失败: "+err.Error())
		return
	}
	touchPolicyUsage(p.ID)
	middleware.Audit(c, "pdf_merge", fmt.Sprintf("%s: %v → %s", p.Name, names, outVP))
	dto.OK(c, gin.H{"path": outVP, "name": out})
}

// PdfSplit 按 span 页拆分为多个 PDF，写入 <stem>-拆分/ 子目录
func (h *SiteHandler) PdfSplit(c *gin.Context) {
	if !requireWritable(c) {
		return
	}
	var in struct {
		PolicyID uint   `json:"policyId" binding:"required"`
		Path     string `json:"path" binding:"required"`
		Span     int    `json:"span" binding:"required"` // 每个产物含几页（1..50）
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Span < 1 || in.Span > 50 {
		dto.Fail(c, 400, "参数错误（span 1~50）")
		return
	}
	p, d, ok := h.resolveWritableByID(in.PolicyID, c)
	if !ok {
		return
	}
	vp, err := fscore.Clean(in.Path)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	e, err := checkPdfEntry(d, vp)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	rc, err := d.Open(vp)
	if err != nil {
		dto.Fail(c, 404, "打开失败")
		return
	}
	defer rc.Close()
	pages, err := api.PageCount(context.Background(), rc, pdfConf())
	if err != nil {
		dto.Fail(c, 400, "PDF 解析失败: "+err.Error())
		return
	}
	if (pages+in.Span-1)/in.Span > pdfSplitMaxOut {
		dto.Fail(c, 400, fmt.Sprintf("产物过多（%d 页），请增大每份页数", pages))
		return
	}
	tmpDir, err := os.MkdirTemp("", "cppdf-split-")
	if err != nil {
		dto.Fail(c, 500, "临时目录失败")
		return
	}
	defer os.RemoveAll(tmpDir)
	if _, err := rc.Seek(0, 0); err != nil {
		dto.Fail(c, 500, "回读失败")
		return
	}
	if err := api.Split(context.Background(), rc, tmpDir, e.Name, in.Span, pdfConf()); err != nil {
		dto.Fail(c, 400, "拆分失败: "+err.Error())
		return
	}
	entries, err := os.ReadDir(tmpDir)
	if err != nil || len(entries) == 0 {
		dto.Fail(c, 500, "拆分无产物")
		return
	}
	dir := filepath.Dir(vp)
	sub := uniqueNameIn(d, dir, strings.TrimSuffix(e.Name, filepath.Ext(e.Name))+"-拆分", "")
	subVP, _ := fscore.Join(dir, sub)
	if err := d.Mkdir(subVP); err != nil {
		dto.Fail(c, 500, "创建子目录失败: "+err.Error())
		return
	}
	created := make([]string, 0, len(entries))
	for _, ent := range entries {
		if ent.IsDir() || !strings.EqualFold(filepath.Ext(ent.Name()), ".pdf") {
			continue
		}
		f, err := os.Open(filepath.Join(tmpDir, ent.Name()))
		if err != nil {
			continue
		}
		outVP, _ := fscore.Join(subVP, ent.Name())
		if err := d.CreateFile(outVP, f); err == nil {
			created = append(created, outVP)
		}
		f.Close()
	}
	if len(created) == 0 {
		dto.Fail(c, 500, "写入产物失败")
		return
	}
	touchPolicyUsage(p.ID)
	middleware.Audit(c, "pdf_split", fmt.Sprintf("%s: %s → %s (%d 份)", p.Name, vp, subVP, len(created)))
	dto.OK(c, gin.H{"dir": subVP, "count": len(created)})
}
