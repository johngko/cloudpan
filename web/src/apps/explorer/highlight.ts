// 搜索命中高亮：把文本按关键词切成片段（纯逻辑，便于单测）
//
// 渲染侧按片段拼 <mark>，**不做 v-html** —— 文件名是用户可控内容，拼 HTML 字符串等于开了注入口子。
// 片段按原样拼接必然等于入参（见单测的不变式），所以高亮不会改变显示内容。

export interface HLPart {
  /** 片段文本（原样切片，未做任何转义/改写） */
  t: string
  /** 是否是命中的那一截 */
  hit: boolean
}

/**
 * 按关键词切分。大小写不敏感（ASCII 范围内），支持多次命中。
 * 关键词为空 / 无命中 / 入参为空时，返回「整段 + 未命中」单个片段，
 * 这样调用方可以无条件按片段渲染，非搜索态不会产生额外 DOM。
 */
export function splitHighlight(text: string, keyword: string): HLPart[] {
  const src = text ?? ''
  const kw = (keyword ?? '').trim().toLowerCase()
  if (!kw || !src) return [{ t: src, hit: false }]

  const lower = src.toLowerCase()
  const out: HLPart[] = []
  let i = 0
  for (;;) {
    const p = lower.indexOf(kw, i)
    if (p < 0) break
    if (p > i) out.push({ t: src.slice(i, p), hit: false })
    out.push({ t: src.slice(p, p + kw.length), hit: true })
    i = p + kw.length
  }
  if (!out.length) return [{ t: src, hit: false }]
  if (i < src.length) out.push({ t: src.slice(i), hit: false })
  return out
}
