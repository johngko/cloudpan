import { describe, it, expect } from 'vitest'
import { newTab, activeIdxAfterClose, recordHistory, backTarget, fwdTarget, parentPath } from './tabs'

describe('newTab', () => {
  it('默认落在根目录、大图标视图、无历史', () => {
    expect(newTab(null)).toEqual({
      policyId: null, path: '/', keyword: '', globalMode: false,
      viewMode: 'grid', history: [], fwdStack: []
    })
  })

  it('可指定盘与路径', () => {
    const t = newTab(3, '/docs')
    expect(t.policyId).toBe(3)
    expect(t.path).toBe('/docs')
  })
})

describe('activeIdxAfterClose（传入的是"已移除该项后"的长度）', () => {
  it('关掉最后一个标签 → null（调用方关闭窗口）', () => {
    expect(activeIdxAfterClose(0, 0, 0)).toBeNull()
  })

  it('关掉活动页左侧的标签 → 活动下标整体左移', () => {
    // 原为 3 个标签（下标 0..2），活动在 2；关掉下标 0 → 新列表长度 2，活动应变 1
    expect(activeIdxAfterClose(2, 0, 2)).toBe(1)
  })

  it('关掉活动页且右侧还有标签 → 活动下标不变', () => {
    // 原 3 个（0..2），活动 0；关掉 0 → 新长度 2，活动仍在 0
    expect(activeIdxAfterClose(2, 0, 0)).toBe(0)
  })

  it('关掉末尾的活动页 → 左移到新的末尾', () => {
    // 原 3 个（0..2），活动 2；关掉 2 → 新长度 2，活动应为 1
    expect(activeIdxAfterClose(2, 2, 2)).toBe(1)
  })
})

describe('recordHistory', () => {
  it('压入历史并清空前进栈', () => {
    const h: string[] = []
    const f = ['/x']
    recordHistory(h, f, '/a')
    expect(h).toEqual(['/a'])
    expect(f).toEqual([])
  })

  it('只保留最近 60 条', () => {
    const h: string[] = []
    const f: string[] = []
    for (let i = 0; i < 61; i++) recordHistory(h, f, `/${i}`)
    expect(h).toHaveLength(60)
    expect(h[0]).toBe('/1')
    expect(h[59]).toBe('/60')
  })
})

describe('backTarget', () => {
  it('跳过与当前路径相同的栈顶（否则第一次按后退会原地不动）', () => {
    const h = ['/a', '/b', '/b']
    expect(backTarget(h, '/b')).toBe('/a')
    expect(h).toEqual([])
  })

  it('无可退历史返回 null', () => {
    expect(backTarget([], '/a')).toBeNull()
    expect(backTarget(['/a'], '/a')).toBeNull()
  })
})

describe('fwdTarget', () => {
  it('前进栈为空返回 null，否则弹出栈顶', () => {
    expect(fwdTarget([])).toBeNull()
    const f = ['/x', '/y']
    expect(fwdTarget(f)).toBe('/y')
    expect(f).toEqual(['/x'])
  })
})

describe('parentPath', () => {
  it('取上一级；根目录仍返回根', () => {
    expect(parentPath('/a/b/c')).toBe('/a/b')
    expect(parentPath('/a')).toBe('/')
    expect(parentPath('/')).toBe('/')
  })
})