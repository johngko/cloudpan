import { describe, it, expect } from 'vitest'
import { normalizeOrder, parseOrder, sortByOrder, moveIcon } from './desktopIcons'

const ic = (id: string) => ({ id, name: id, icon: id, appId: id })

describe('normalizeOrder', () => {
  it('非数组回退空表', () => {
    expect(normalizeOrder(null)).toEqual([])
    expect(normalizeOrder('a')).toEqual([])
    expect(normalizeOrder({})).toEqual([])
  })

  it('丢弃空串与非字符串项', () => {
    expect(normalizeOrder(['a', '', 3, null, 'b'])).toEqual(['a', 'b'])
  })

  it('去重且保留首次出现的位置', () => {
    expect(normalizeOrder(['b', 'a', 'b', 'a'])).toEqual(['b', 'a'])
  })
})

describe('parseOrder', () => {
  it('解析正常 JSON 串', () => {
    expect(parseOrder('["a","b"]')).toEqual(['a', 'b'])
  })

  it('空值/坏 JSON 回退空表（顺序丢失只回到默认序）', () => {
    expect(parseOrder(undefined)).toEqual([])
    expect(parseOrder('')).toEqual([])
    expect(parseOrder('not json')).toEqual([])
  })
})

describe('sortByOrder', () => {
  it('顺序表为空时保持传入顺序', () => {
    expect(sortByOrder([ic('a'), ic('b')], []).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('按顺序表重排', () => {
    const items = [ic('a'), ic('b'), ic('c')]
    expect(sortByOrder(items, ['c', 'a', 'b']).map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('顺序表缺项（新装应用/新主题图标）追加到末尾并保持原相对顺序', () => {
    const items = [ic('a'), ic('new1'), ic('b'), ic('new2')]
    expect(sortByOrder(items, ['b', 'a']).map((x) => x.id)).toEqual(['b', 'a', 'new1', 'new2'])
  })

  it('顺序表含已不存在的 id 时不影响其余图标', () => {
    const items = [ic('a'), ic('b')]
    expect(sortByOrder(items, ['gone', 'b', 'a']).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('不改动传入数组（纯函数）', () => {
    const items = [ic('a'), ic('b')]
    sortByOrder(items, ['b', 'a'])
    expect(items.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('moveIcon', () => {
  it('向上拖：落在目标之前', () => {
    expect(moveIcon(['a', 'b', 'c', 'd'], 'c', 'b')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('向下拖：落在目标之后', () => {
    expect(moveIcon(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('拖到首位', () => {
    expect(moveIcon(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
  })

  it('拖到末位', () => {
    expect(moveIcon(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
  })

  it('拖到自身/未知 id 原样返回', () => {
    expect(moveIcon(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
    expect(moveIcon(['a', 'b'], 'x', 'a')).toEqual(['a', 'b'])
    expect(moveIcon(['a', 'b'], 'a', 'x')).toEqual(['a', 'b'])
  })

  it('返回新数组，不改动入参', () => {
    const ids = ['a', 'b']
    moveIcon(ids, 'a', 'b')
    expect(ids).toEqual(['a', 'b'])
  })
})