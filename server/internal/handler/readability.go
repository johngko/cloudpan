package handler

// C4 网页剪藏的正文抽取（自研简化版，非第三方库移植）：
// 思路同 arc90 readability —— 去掉样板节点（导航/页脚/脚本…）后，
// 对块级容器按「文本密度 × (1 − 链接密度) + 段落/逗号加权」打分，取最高分子树；
// 再按段落收集文本，丢弃链接密度过高的块（残留导航/推荐位）。
// 只服务剪藏场景（新闻/博客/文档页），不追求全场景精度；失败时调用方退回存原始快照。

import (
	"bytes"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type readableDoc struct {
	Title string
	Text  string
}

// dropAtoms 候选子树里整体移除的样板标签（连子树一起删）
var dropAtoms = map[atom.Atom]bool{
	atom.Script: true, atom.Style: true, atom.Noscript: true, atom.Nav: true,
	atom.Footer: true, atom.Header: true, atom.Aside: true, atom.Form: true,
	atom.Iframe: true, atom.Svg: true, atom.Button: true, atom.Template: true,
	atom.Link: true, atom.Meta: true, atom.Audio: true, atom.Video: true}

func extractReadable(raw []byte) readableDoc {
	doc, err := html.Parse(bytes.NewReader(raw))
	if err != nil {
		return readableDoc{}
	}
	title := extractTitle(doc)
	root := findElement(doc, atom.Body) // html.Parse 后文档首子节点是 doctype，必须递归搜 body
	if root == nil {
		root = doc
	}
	dropSubtrees(root)
	best, bestScore := scoreBest(root)
	if best == nil || bestScore <= 0 {
		return readableDoc{Title: title}
	}
	var sb strings.Builder
	collectBlocks(best, &sb)
	text := strings.TrimSpace(sb.String())
	if len(text) > contentMaxTextBytes {
		text = text[:contentMaxTextBytes]
	}
	return readableDoc{Title: title, Text: text}
}

// dropSubtrees 迭代移除所有样板标签子树（先收集再删，避免边删边遍历）
func dropSubtrees(root *html.Node) {
	var doomed []*html.Node
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
			if ch.Type == html.ElementNode && dropAtoms[ch.DataAtom] {
				doomed = append(doomed, ch)
				continue
			}
			walk(ch)
		}
	}
	walk(root)
	for _, n := range doomed {
		n.Parent.RemoveChild(n)
	}
}

// fullTextLen 子树全部可见文本长度；linkTextLen 子树内 <a> 文本长度
func fullTextLen(n *html.Node) int {
	if n.Type == html.TextNode {
		return len(strings.TrimSpace(n.Data))
	}
	total := 0
	for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
		total += fullTextLen(ch)
	}
	return total
}

func linkTextLen(n *html.Node) int {
	if n.Type == html.ElementNode && n.DataAtom == atom.A {
		return fullTextLen(n)
	}
	total := 0
	for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
		total += linkTextLen(ch)
	}
	return total
}

// scoreBest 在 div/article/section/main/pre/table/blockquote/td 中找正文分最高的节点
func scoreBest(root *html.Node) (*html.Node, float64) {
	var best *html.Node
	var bestScore float64
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.DataAtom {
			case atom.Div, atom.Article, atom.Section, atom.Main, atom.Pre, atom.Table, atom.Blockquote, atom.Td:
				text := fullTextLen(n)
				if text > 100 {
					links := linkTextLen(n)
					paras, commas := countParasCommas(n)
					linkDensity := float64(links) / float64(text)
					score := float64(text)/1024.0*0.9 + float64(paras)*0.5 + float64(commas)*0.05
					score *= 1.0 - linkDensity
					if score > bestScore {
						bestScore = score
						best = n
					}
				}
			}
		}
		for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
			walk(ch)
		}
	}
	walk(root)
	return best, bestScore
}

// countParasCommas 段落块数与逗号数（正文语言特征，导航/标签云几乎没有逗号）
func countParasCommas(n *html.Node) (paras, commas int) {
	var walk func(m *html.Node)
	walk = func(m *html.Node) {
		if m.Type == html.ElementNode {
			switch m.DataAtom {
			case atom.P, atom.Li, atom.Blockquote, atom.Pre:
				if fullTextLen(m) > 40 {
					paras++
				}
			}
			for _, r := range []rune(nodeDirectText(m)) {
				if r == '，' || r == ',' || r == '、' {
					commas++
				}
			}
		}
		for ch := m.FirstChild; ch != nil; ch = ch.NextSibling {
			walk(ch)
		}
	}
	walk(n)
	return
}

// nodeDirectText 仅该元素的直接文本子节点（不递归，配合外层 walk 避免重复计数）
func nodeDirectText(n *html.Node) string {
	var sb strings.Builder
	for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
		if ch.Type == html.TextNode {
			sb.WriteString(ch.Data)
		}
	}
	return sb.String()
}

// collectBlocks 按块级元素收集段落文本；块内链接密度 >0.6 视为残留导航丢弃。
// 块命中即输出并停止深入（本身即防嵌套重复），兄弟块各自独立收集。
func collectBlocks(root *html.Node, sb *strings.Builder) {
	var emit func(n *html.Node)
	emit = func(n *html.Node) {
		if n.Type == html.ElementNode && (n.DataAtom == atom.P || n.DataAtom == atom.Li ||
			n.DataAtom == atom.Pre || n.DataAtom == atom.Blockquote || n.DataAtom == atom.H1 ||
			n.DataAtom == atom.H2 || n.DataAtom == atom.H3 || n.DataAtom == atom.H4 ||
			n.DataAtom == atom.Tr || n.DataAtom == atom.Dd || n.DataAtom == atom.Dt) {
			txt := collapseSpace(fullNodeText(n))
			if txt != "" && (linkTextLen(n)*10 < fullTextLen(n)*6 || fullTextLen(n) > 200) {
				sb.WriteString(txt)
				sb.WriteString("\n\n")
			}
			return
		}
		for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
			emit(ch)
		}
	}
	emit(root)
}

func fullNodeText(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	if n.Type == html.ElementNode && (n.DataAtom == atom.Script || n.DataAtom == atom.Style) {
		return ""
	}
	var sb strings.Builder
	for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
		sb.WriteString(fullNodeText(ch))
	}
	return sb.String()
}

func collapseSpace(s string) string {
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

func extractTitle(doc *html.Node) string {
	var find func(n *html.Node, a atom.Atom) *html.Node
	find = func(n *html.Node, a atom.Atom) *html.Node {
		if n.Type == html.ElementNode && n.DataAtom == a {
			return n
		}
		for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
			if r := find(ch, a); r != nil {
				return r
			}
		}
		return nil
	}
	if h1 := find(doc, atom.H1); h1 != nil {
		if t := collapseSpace(fullNodeText(h1)); t != "" {
			return clipRunes(t, 120)
		}
	}
	if t := find(doc, atom.Title); t != nil {
		if s := collapseSpace(fullNodeText(t)); s != "" {
			return clipRunes(s, 120)
		}
	}
	return ""
}

// findElement 深度优先查找第一个指定标签的元素节点
func findElement(n *html.Node, a atom.Atom) *html.Node {
	if n.Type == html.ElementNode && n.DataAtom == a {
		return n
	}
	for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
		if r := findElement(ch, a); r != nil {
			return r
		}
	}
	return nil
}

func clipRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}
