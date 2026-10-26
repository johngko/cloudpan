package handler

// C4 网页剪藏：服务端代抓 URL → readability 抽正文存 Markdown；可附带原始 HTML 快照。
// SSRF 三层防线复用离线下载的 ssrf 体系（validateFetchURL + ssrfCheckRedirect + ssrfHTTP 拨号层）。
// 整页单文件归档（monolith）为可选附加组件，此处不做（见 docs/improvement-research-2026-10.md C4）。

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"cloudpan/internal/dto"
	"cloudpan/internal/fscore"
	"cloudpan/internal/model"

	"github.com/gin-gonic/gin"
)

const (
	clipMaxBody     = 6 << 20 // 抓取响应体上限 6MB
	clipTimeout     = 20 * time.Second
	clipTextMinRunes = 200 // 正文少于该字数视为抽取失败（退回快照/原始文本）
)

// Clip POST /clip {url, policyId, dir, snapshot}
func (h *SiteHandler) Clip(c *gin.Context) {
	var in struct {
		URL      string `json:"url"`
		PolicyID uint   `json:"policyId"`
		Dir      string `json:"dir"`
		Snapshot bool   `json:"snapshot"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.URL == "" || in.PolicyID == 0 {
		dto.Fail(c, 400, "参数不完整")
		return
	}
	if err := validateFetchURL(in.URL); err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}
	p, d, ok := h.resolveWritableByID(in.PolicyID, c)
	if !ok {
		return
	}
	dir := strings.TrimSpace(in.Dir)
	if dir == "" {
		dir = "/"
	}
	vd, err := fscore.Clean(dir)
	if err != nil {
		dto.Fail(c, 400, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), clipTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, in.URL, nil)
	if err != nil {
		dto.Fail(c, 400, "URL 无法解析")
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; CloudPanClip/1.0)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5")
	resp, err := ssrfHTTP.Do(req)
	if err != nil {
		dto.Fail(c, 502, "抓取失败："+err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		dto.Fail(c, 502, fmt.Sprintf("目标返回 %d", resp.StatusCode))
		return
	}
	ct := strings.ToLower(resp.Header.Get("Content-Type"))
	if !strings.Contains(ct, "text/html") && !strings.Contains(ct, "text/plain") {
		dto.Fail(c, 422, "不是 HTML 页面（"+ct+"）")
		return
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, clipMaxBody+1))
	if err != nil {
		dto.Fail(c, 502, "读取响应失败")
		return
	}
	if len(raw) > clipMaxBody {
		dto.Fail(c, 413, "页面超过 6MB 上限")
		return
	}

	doc := extractReadable(raw)
	base := clipBaseName(in.URL, doc.Title)
	now := time.Now()

	var finalPath string
	if runeLen(doc.Text) >= clipTextMinRunes {
		var sb strings.Builder
		title := doc.Title
		if title == "" {
			title = base
		}
		sb.WriteString("# " + title + "\n\n")
		sb.WriteString("> 剪藏自 <" + in.URL + "> · " + now.Format("2006-01-02 15:04") + "\n\n")
		sb.WriteString(doc.Text)
		fp, jerr := fscore.Join(vd, base+".md")
		if jerr != nil {
			dto.Fail(c, 400, jerr.Error())
			return
		}
		if ferr := d.CreateFile(fp, strings.NewReader(sb.String())); ferr != nil {
			dto.Fail(c, 500, "写入失败："+ferr.Error())
			return
		}
		finalPath = fp
	} else if strings.Contains(ct, "text/plain") {
		// 纯文本页无 HTML 结构可抽取：原样落 .txt
		fp, _ := fscore.Join(vd, base+".txt")
		if ferr := d.CreateFile(fp, strings.NewReader(string(raw))); ferr != nil {
			dto.Fail(c, 500, "写入失败："+ferr.Error())
			return
		}
		finalPath = fp
	} else {
		dto.Fail(c, 422, "未能抽取到正文（页面过短或纯脚本渲染），可勾选保存原始快照")
		return
	}

	if in.Snapshot {
		if fp, jerr := fscore.Join(vd, base+".html"); jerr == nil {
			_ = d.CreateFile(fp, strings.NewReader(string(raw))) // 快照失败不影响主结果
			if finalPath == "" {
				finalPath = fp
			}
		}
	}

	// 索引刚剪藏的 md（正文可搜）：本地盘 FileText 增量索引会在下次搜索时覆盖，
	// 这里主动插一条让"剪完即搜"成立
	if strings.HasSuffix(finalPath, ".md") {
		if e, serr := d.Stat(finalPath); serr == nil {
			x := ctxOf(c)
			row := model.FileText{
				UserID: x.user.ID, PolicyID: p.ID, Path: finalPath, Name: path.Base(finalPath), Ext: "md",
				Size: e.Size, ModTime: e.ModTime, Text: doc.Text, IndexedAt: now,
			}
			var old model.FileText
			if model.DB.Where("user_id = ? AND policy_id = ? AND path = ?", x.user.ID, p.ID, finalPath).First(&old).Error == nil {
				row.ID = old.ID
				model.DB.Save(&row)
			} else {
				model.DB.Create(&row)
			}
		}
	}
	dto.OK(c, gin.H{"path": finalPath, "title": doc.Title})
}

// clipBaseName 标题优先（清洗 + 截断），无标题退回域名；追加短时间戳防重名
var clipNameBad = regexp.MustCompile(`[\\/:*?"<>|\x00-\x1f]+`)

func clipBaseName(rawURL, title string) string {
	name := strings.TrimSpace(clipNameBad.ReplaceAllString(title, ""))
	name = strings.TrimSuffix(name, ".") // Windows 名净化同源考虑
	if runeLen(name) < 2 {
		host := rawURL
		if u, err := url.Parse(rawURL); err == nil && u.Hostname() != "" {
			host = u.Hostname()
		}
		name = clipNameBad.ReplaceAllString(host, "")
	}
	name = clipRunes(name, 60)
	if name == "" {
		name = "clip"
	}
	return fmt.Sprintf("%s-%s", name, time.Now().Format("20060102-150405"))
}

func runeLen(s string) int { return len([]rune(s)) }
