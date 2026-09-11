import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Markdown → 安全 HTML（公告/记事本分享预览等场景）：
// marked 负责解析（含换行转 <br>），DOMPurify 过滤 XSS（站点公告由管理员编写，
// 分享页面向匿名访客，必须消毒）
marked.setOptions({ breaks: true })

export function renderMD(src: string): string {
  if (!src) return ''
  let html: string
  try {
    html = marked.parse(src) as string
  } catch {
    return DOMPurify.sanitize(src)
  }
  return DOMPurify.sanitize(html, { ADD_TAGS: ['details', 'summary'] })
}
