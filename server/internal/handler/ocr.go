package handler

// C2 图片 OCR 入库：识别在浏览器端完成（tesseract.js wasm，见 web/src/utils/ocrQueue.ts），
// 本文件只接收识别结果并入 B1 全文索引（file_texts）。服务端不跑 OCR（不引入外部依赖）。
// 复用 FileText 表：图片路径 + OCR 文本；命中校验 Stat 只看路径存在，图片天然通过；
// B1 增量索引只扫文本扩展名，不会覆盖/误删 OCR 行。

import (
	"path"
	"strings"
	"time"
	"unicode/utf8"

	"cloudpan/internal/dto"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
)

const ocrTextMaxBytes = 200 << 10 // 单图 OCR 文本入库上限（防灌库）

// SaveOcr POST /fs/ocr {policyId, path, text}
func (h *SiteHandler) SaveOcr(c *gin.Context) {
	var in struct {
		PolicyID uint   `json:"policyId"`
		Path     string `json:"path"`
		Text     string `json:"text"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.PolicyID == 0 || in.Path == "" {
		dto.Fail(c, 400, "参数不完整")
		return
	}
	text := strings.TrimSpace(in.Text)
	if text == "" {
		dto.OK(c, gin.H{"ok": true, "skipped": "empty"})
		return
	}
	if len(text) > ocrTextMaxBytes {
		cut := ocrTextMaxBytes
		for cut < len(text) && !utf8.RuneStart(text[cut]) {
			cut++
		}
		text = text[:cut]
	}
	p, d, ok := h.resolveWritableByID(in.PolicyID, c)
	if !ok {
		return
	}
	e, err := d.Stat(in.Path)
	if err != nil || e.IsDir {
		dto.Fail(c, 404, "目标文件不存在")
		return
	}
	x := ctxOf(c)
	row := model.FileText{
		UserID: x.user.ID, PolicyID: p.ID, Path: in.Path,
		Name: path.Base(in.Path), Ext: strings.ToLower(e.Ext),
		Size: e.Size, ModTime: e.ModTime,
		Text: text, IndexedAt: time.Now(),
	}
	var old model.FileText
	if model.DB.Where("user_id = ? AND policy_id = ? AND path = ?", x.user.ID, p.ID, in.Path).First(&old).Error == nil {
		row.ID = old.ID
		model.DB.Save(&row)
	} else {
		model.DB.Create(&row)
	}
	dto.OK(c, gin.H{"ok": true})
}
