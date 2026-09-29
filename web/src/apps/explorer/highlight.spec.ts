import { describe, it, expect } from 'vitest'
import { splitHighlight } from './highlight'

const join = (parts: { t: string }[]) => parts.map(p => p.t).join('')
const hits = (parts: { t: string; hit: boolean }[]) => parts.filter(p => p.hit).map(p => p.t)

describe('splitHighlight · 不命中', () => {
  it('关键词为空/纯空白 → 整段未命中', () => {
    expect(splitHighlight('报告.docx', '')).toEqual([{ t: '报告.docx', hit: false }])
    expect(splitHighlight('报告.docx', '   ')).toEqual([{ t: '报告.docx', hit: false }])
  })
  it('无命中 → 整段未命中', () => {
    expect(splitHighlight('报告.docx', 'zzz')).toEqual([{ t: '报告.docx', hit: false }])
  })
  it('空文本 → 单个空片段（调用方不必特判）', () => {
    expect(splitHighlight('', 'x')).toEqual([{ t: '', hit: false }])
  })
})

describe('splitHighlight · 命中位置', () => {
  it('开头命中', () => {
    expect(splitHighlight('report.docx', 'rep')).toEqual([
      { t: 'rep', hit: true }, { t: 'ort.docx', hit: false }
    ])
  })
  it('中间命中', () => {
    expect(splitHighlight('my-report.docx', 'report')).toEqual([
      { t: 'my-', hit: false }, { t: 'report', hit: true }, { t: '.docx', hit: false }
    ])
  })
  it('结尾命中', () => {
    expect(splitHighlight('report.docx', 'docx')).toEqual([
      { t: 'report.', hit: false }, { t: 'docx', hit: true }
    ])
  })
  it('整段命中', () => {
    expect(splitHighlight('docx', 'docx')).toEqual([{ t: 'docx', hit: true }])
  })
  it('多次命中全部标出', () => {
    const p = splitHighlight('a-b-a-b', 'a')
    expect(hits(p)).toEqual(['a', 'a'])
    expect(join(p)).toBe('a-b-a-b')
  })
})

describe('splitHighlight · 大小写与长度', () => {
  it('大小写不敏感，但保留原文大小写', () => {
    expect(splitHighlight('Report.DOCX', 'report')).toEqual([
      { t: 'Report', hit: true }, { t: '.DOCX', hit: false }
    ])
  })
  it('关键词比文本长 → 不命中', () => {
    expect(splitHighlight('ab', 'abcdef')).toEqual([{ t: 'ab', hit: false }])
  })
  it('中文关键词', () => {
    expect(splitHighlight('季度报告-最终版.xlsx', '报告')).toEqual([
      { t: '季度', hit: false }, { t: '报告', hit: true }, { t: '-最终版.xlsx', hit: false }
    ])
  })
})

describe('splitHighlight · 不变式', () => {
  const cases: [string, string][] = [
    ['报告.docx', '报'], ['a-b-a-b', 'a'], ['Report.DOCX', 'o'], ['my-report.docx', 'report'],
    ['x', 'x'], ['', 'a'], ['aaa', 'aa'], ['a.b.c', '.'], ['abc', 'zzz'],
    ['$^.*+?[]{}()|\\', '.*'], ['😀表情😀', '😀'], ['备份-2026-09-28.tar.gz', '-'],
  ]
  it('片段拼接 === 原文（高亮绝不改变显示内容）', () => {
    for (const [text, kw] of cases) expect(join(splitHighlight(text, kw))).toBe(text)
  })
  it('命中片段全部等于关键词的原文切片（长度一致）', () => {
    for (const [text, kw] of cases) {
      for (const h of hits(splitHighlight(text, kw))) expect(h.length).toBe(kw.trim().length)
    }
  })
  it('绝不返回空数组；非空文本下不产生空片段', () => {
    for (const [text, kw] of cases) {
      const parts = splitHighlight(text, kw)
      expect(parts.length).toBeGreaterThan(0)
      if (text) expect(parts.every(p => p.t !== '')).toBe(true) // 空文本按约定返回单个空片段
    }
  })
})
