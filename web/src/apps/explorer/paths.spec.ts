import { describe, it, expect } from 'vitest'
import { joinPath, sharedPathParse } from './paths'

describe('joinPath', () => {
  it('父目录为根时不产生双斜杠', () => {
    expect(joinPath('/', 'a.txt')).toBe('/a.txt')
    expect(joinPath('', 'a.txt')).toBe('/a.txt')
  })

  it('普通父目录拼接', () => {
    expect(joinPath('/docs', 'a.txt')).toBe('/docs/a.txt')
    expect(joinPath('/docs/2026', 'a.txt')).toBe('/docs/2026/a.txt')
  })
})

describe('sharedPathParse', () => {
  it('共享根不是共享路径', () => {
    expect(sharedPathParse('/')).toBeNull()
    expect(sharedPathParse('/docs')).toBeNull()
    expect(sharedPathParse('/s')).toBeNull()
    expect(sharedPathParse('/sabc')).toBeNull()
  })

  it('解析共享根与共享内相对路径', () => {
    expect(sharedPathParse('/s12')).toEqual({ shareId: 12, rel: '' })
    expect(sharedPathParse('/s12/a/b.txt')).toEqual({ shareId: 12, rel: 'a/b.txt' })
    expect(sharedPathParse('/s7/')).toEqual({ shareId: 7, rel: '' })
  })
})