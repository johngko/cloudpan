import { describe, it, expect } from 'vitest'
import { sortEntries, nextSort, type SortableEntry } from './sortEntries'

// Explorer 排序纯逻辑：文件夹恒在前 + 方向只作用于同类型内部（Windows 语义）

function entry(name: string, isDir: boolean, size = 0, modTime = 0, ext?: string): SortableEntry {
  return { name, isDir, size, modTime, ext: ext ?? name.split('.').pop() }
}

const dir = (n: string) => entry(n, true)
const file = (n: string, size = 0, modTime = 0) => entry(n, false, size, modTime)

describe('sortEntries', () => {
  it('文件夹恒在文件之前（升序与降序都一样）', () => {
    const items = [file('a.txt'), dir('zdir'), file('b.txt'), dir('adir')]
    for (const d of ['asc', 'desc'] as const) {
      const out = sortEntries(items, 'name', d)
      expect(out.slice(0, 2).every(x => x.isDir)).toBe(true)
      expect(out.slice(2).every(x => !x.isDir)).toBe(true)
    }
  })

  it('按名称升序/降序（zh-CN 排序）', () => {
    const items = [file('c.txt'), file('a.txt'), file('b.txt')]
    expect(sortEntries(items, 'name', 'asc').map(x => x.name)).toEqual(['a.txt', 'b.txt', 'c.txt'])
    expect(sortEntries(items, 'name', 'desc').map(x => x.name)).toEqual(['c.txt', 'b.txt', 'a.txt'])
  })

  it('按大小与修改时间排序', () => {
    const items = [file('big', 300, 1), file('small', 100, 3), file('mid', 200, 2)]
    expect(sortEntries(items, 'size', 'asc').map(x => x.name)).toEqual(['small', 'mid', 'big'])
    expect(sortEntries(items, 'size', 'desc').map(x => x.name)).toEqual(['big', 'mid', 'small'])
    expect(sortEntries(items, 'modTime', 'asc').map(x => x.name)).toEqual(['big', 'mid', 'small'])
    expect(sortEntries(items, 'modTime', 'desc').map(x => x.name)).toEqual(['small', 'mid', 'big'])
  })

  it('按类型排序，同扩展名回落按名称（顺序不随机）', () => {
    const items = [file('b.zip'), file('a.txt'), file('a.zip'), file('c.txt')]
    expect(sortEntries(items, 'type', 'asc').map(x => x.name)).toEqual(['a.txt', 'c.txt', 'a.zip', 'b.zip'])
  })

  it('不修改入参，且相同输入得到相同输出', () => {
    const items = [file('b.txt'), file('a.txt')]
    const snapshot = items.map(x => x.name)
    const out1 = sortEntries(items, 'name', 'asc')
    const out2 = sortEntries(items, 'name', 'asc')
    expect(items.map(x => x.name)).toEqual(snapshot)
    expect(out1.map(x => x.name)).toEqual(out2.map(x => x.name))
    expect(out1).not.toBe(items)
  })

  it('空数组返回空数组', () => {
    expect(sortEntries([], 'name', 'asc')).toEqual([])
  })
})

describe('nextSort', () => {
  it('同列点击翻转方向', () => {
    expect(nextSort({ mode: 'name', dir: 'asc' }, 'name')).toEqual({ mode: 'name', dir: 'desc' })
    expect(nextSort({ mode: 'name', dir: 'desc' }, 'name')).toEqual({ mode: 'name', dir: 'asc' })
  })

  it('换列重置为升序', () => {
    expect(nextSort({ mode: 'name', dir: 'desc' }, 'size')).toEqual({ mode: 'size', dir: 'asc' })
  })
})