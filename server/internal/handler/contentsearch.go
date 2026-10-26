package handler

// B1 内容全文检索：GET /fs/global-search?q=…&kind=content
// 懒索引模型——没有常驻索引进程：查询时把本地盘上未索引/已变更的文本小文件
// 读入 file_texts（每请求限量，防止大目录把请求拖死），再在库内 LIKE 匹配出
// 命中并附 ±80 字符上下文摘要。云盘不参与（读外部 API 代价不可控）。
// 删除/移动的旧索引行在命中验证（Stat）时顺手清掉，无需挂删除钩子。

import (
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
)

// 可索引的文本类扩展名（小写）
var textIndexExts = map[string]bool{
	"txt": true, "md": true, "markdown": true, "csv": true, "tsv": true, "json": true,
	"log": true, "xml": true, "html": true, "htm": true, "yaml": true, "yml": true,
	"ini": true, "conf": true, "cfg": true, "js": true, "ts": true, "py": true,
	"go": true, "java": true, "c": true, "h": true, "sh": true, "bat": true,
	"sql": true, "srt": true, "vtt": true, "ass": true, "lrc": true, "nfo": true,
}

const (
	contentMaxFileBytes = 512 << 10 // 超过此大小的文件不索引
	contentMaxTextBytes = 256 << 10 // 入库正文截断上限
	contentWalkDepth    = 6
	contentPerPolicyCap = 300 // 每盘候选文件上限
	contentIndexBudget  = 200 // 每请求新建/刷新索引的文件数上限
	contentResultCap    = 40  // 返回命中上限
)

// escapeLike 转义 LIKE 通配符
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// snippet 围绕第一个（不分大小写）匹配处截取上下文
func snippet(text, kw string) string {
	lt, lk := strings.ToLower(text), strings.ToLower(kw)
	i := strings.Index(lt, lk)
	if i < 0 {
		r := []rune(text)
		if len(r) > 120 {
			return string(r[:120]) + "…"
		}
		return text
	}
	// 以字节定位后换算 rune 边界，避免切碎多字节字符
	pre := runesBefore(lt, i, 80)
	start := i - pre
	endByte := i + len(lk)
	endByte += runesAfter(lt, endByte, 80)
	s := text[start:endByte]
	if start > 0 {
		s = "…" + s
	}
	if endByte < len(text) {
		s += "…"
	}
	return strings.ReplaceAll(s, "\n", " ")
}

func runesBefore(s string, byteIdx, n int) int {
	cnt, i := 0, byteIdx
	for i > 0 && cnt < n {
		_, sz := decodeLastRune(s[:i])
		if sz <= 0 {
			i--
		} else {
			i -= sz
		}
		cnt++
	}
	return byteIdx - i
}

func runesAfter(s string, byteIdx, n int) int {
	cnt, i := 0, byteIdx
	for i < len(s) && cnt < n {
		_, sz := utf8.DecodeRuneInString(s[i:])
		if sz <= 0 {
			i++
		} else {
			i += sz
		}
		cnt++
	}
	return i - byteIdx
}

func decodeLastRune(s string) (rune, int) {
	for i := len(s) - 1; i >= 0 && i >= len(s)-4; i-- {
		if r := utf8.RuneStart(s[i]); r {
			rr, sz := utf8.DecodeRuneInString(s[i:])
			return rr, sz
		}
	}
	return utf8.DecodeRuneInString(s)
}

// ContentSearch 内容检索主入口（GlobalSearch 的 kind=content 分支）
func (h *SiteHandler) ContentSearch(c *gin.Context) {
	x := ctxOf(c)
	kw := strings.TrimSpace(c.Query("q"))
	if len([]rune(kw)) < 2 {
		dto.OK(c, gin.H{"items": []gin.H{}, "partial": false, "note": "关键字至少 2 个字符"})
		return
	}

	var list []model.Policy
	model.DB.Where("status != ? AND type = ?", "disabled", "local").Order("letter").Find(&list)

	partial := false
	budget := contentIndexBudget
	for i := range list {
		p := &list[i]
		if !policyUsable(x.user, x.group, p) {
			continue
		}
		d, err := h.Fs.DriverFor(p, x.user)
		if err != nil {
			continue
		}
		// 1) 收集候选（文本扩展名 + 大小限制 + 深度限制）
		var cands []fscore.Entry
		var walk func(vp string, depth int)
		walk = func(vp string, depth int) {
			if len(cands) >= contentPerPolicyCap || depth > contentWalkDepth {
				return
			}
			items, err := d.List(vp)
			if err != nil {
				return
			}
			for _, it := range items {
				if it.IsDir {
					if child, jerr := fscore.Join(vp, it.Name); jerr == nil {
						walk(child, depth+1)
					}
					continue
				}
				if textIndexExts[strings.ToLower(it.Ext)] && it.Size > 0 && it.Size <= contentMaxFileBytes {
					if child, jerr := fscore.Join(vp, it.Name); jerr == nil {
						it.Path = child
						cands = append(cands, it)
					}
				}
				if len(cands) >= contentPerPolicyCap {
					return
				}
			}
		}
		walk("/", 0)

		// 2) 增量索引（限量）
		for _, it := range cands {
			if budget <= 0 {
				partial = true
				break
			}
			var old model.FileText
			hit := model.DB.Where("user_id = ? AND policy_id = ? AND path = ?", x.user.ID, p.ID, it.Path).First(&old)
			if hit.Error == nil && old.Size == it.Size && old.ModTime == it.ModTime {
				continue // 未变化，跳过
			}
			rc, err := d.Open(it.Path)
			if err != nil {
				continue
			}
			buf, rerr := io.ReadAll(io.LimitReader(rc, contentMaxTextBytes+1))
			rc.Close()
			if rerr != nil || len(buf) == 0 {
				continue
			}
			if len(buf) > contentMaxTextBytes {
				buf = buf[:contentMaxTextBytes]
				// 截断可能切在 rune 中间：回退到最近的有效边界（最多退 3 字节）
				for j := 0; j < 3 && !utf8.Valid(buf); j++ {
					buf = buf[:len(buf)-1]
				}
			}
			if bytesContainsNUL(buf) || !utf8.Valid(buf) {
				// 二进制 / 非 UTF-8（如 GBK）不索引
				if hit.Error == nil {
					model.DB.Delete(&old)
				}
				continue
			}
			row := model.FileText{
				UserID: x.user.ID, PolicyID: p.ID, Path: it.Path, Name: it.Name,
				Ext: strings.ToLower(it.Ext), Size: it.Size, ModTime: it.ModTime,
				Text: string(buf), IndexedAt: time.Now(),
			}
			if hit.Error == nil {
				row.ID = old.ID
				model.DB.Save(&row)
			} else {
				model.DB.Create(&row)
			}
		}
	}

	// 3) 库内匹配 + 命中验证（文件被删/移则清行）
	// 注意：不要写 ESCAPE '\'——MySQL 的字符串字面量里反斜杠会转义收尾引号导致语法错误
	// （错误被 Find 吞掉后表现为"永远搜不到"）；MySQL LIKE 默认转义符本来就是反斜杠，
	// escapeLike 生成的 \% \_ \\ 直接生效
	var rows []model.FileText
	if err := model.DB.Where("user_id = ? AND text LIKE ?", x.user.ID, "%"+escapeLike(kw)+"%").
		Order("id DESC").Limit(contentResultCap * 2).Find(&rows).Error; err != nil {
		dto.Fail(c, 500, "内容搜索失败："+err.Error())
		return
	}

	out := make([]gin.H, 0, contentResultCap)
	policies := map[uint]*model.Policy{}
	for i := range list {
		policies[list[i].ID] = &list[i]
	}
	for _, r := range rows {
		if len(out) >= contentResultCap {
			break
		}
		p := policies[r.PolicyID]
		if p == nil {
			model.DB.Delete(&model.FileText{}, r.ID)
			continue
		}
		d, err := h.Fs.DriverFor(p, x.user)
		if err != nil {
			continue
		}
		if _, serr := d.Stat(r.Path); serr != nil {
			model.DB.Delete(&model.FileText{}, r.ID) // 已删除/改名：清掉旧索引
			continue
		}
		out = append(out, gin.H{
			"policyId": p.ID, "letter": p.Letter, "policyName": p.Name, "policyType": p.Type,
			"name": r.Name, "isDir": false, "size": r.Size, "ext": r.Ext, "path": r.Path,
			"snippet": snippet(r.Text, kw),
		})
	}
	// 给前端的诚实说明：语料未全量索引时 partial=true
	note := ""
	if partial {
		note = "索引仍在追赶：本次只增量索引了一部分文件，换关键字或稍后再搜可覆盖更多"
	}
	dto.OK(c, gin.H{"items": out, "partial": partial, "note": note})
}

func bytesContainsNUL(b []byte) bool {
	for _, c := range b {
		if c == 0 {
			return true
		}
	}
	return false
}
