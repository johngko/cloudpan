import { describe, it, expect } from 'vitest'
import { nextSelection, toggleInSet, isAllSelected } from './selection'

const ordered = ['/a', '/b', '/c', '/d']

describe('nextSelection · 普通点击', () => {
  it('无修饰键 → 单选', () => {
    expect(nextSelection(new Set(['/a', '/b']), ordered, { path: '/c' })).toEqual(new Set(['/c']))
  })
})

describe('nextSelection · 右键', () => {
  it('点在未选中项 → 单选它', () => {
    expect(nextSelection(new Set(['/a']), ordered, { path: '/c', button: 2 })).toEqual(new Set(['/c']))
  })

  it('点在已选中项 → 保持整组不动（返回 null，右键菜单作用于整组）', () => {
    expect(nextSelection(new Set(['/a', '/b']), ordered, { path: '/b', button: 2 })).toBeNull()
  })
})

describe('nextSelection · Ctrl 切换', () => {
  it('未选中则加入', () => {
    expect(nextSelection(new Set(['/a']), ordered, { path: '/c', ctrlKey: true })).toEqual(new Set(['/a', '/c']))
  })

  it('已选中则移除', () => {
    expect(nextSelection(new Set(['/a', '/c']), ordered, { path: '/c', ctrlKey: true })).toEqual(new Set(['/a']))
  })
})

describe('nextSelection · Shift 区间', () => {
  it('以选中集最后一项为锚点，按当前列表顺序取区间', () => {
    // 锚点 /b（最后一项），点到 /d → 选 /b,/c,/d
    expect(nextSelection(new Set(['/b']), ordered, { path: '/d', shiftKey: true })).toEqual(new Set(['/b', '/c', '/d']))
  })

  it('反向选择同样取区间（锚点在点击项之后）', () => {
    expect(nextSelection(new Set(['/d']), ordered, { path: '/b', shiftKey: true })).toEqual(new Set(['/b', '/c', '/d']))
  })

  it('多选后取最后一项作为锚点', () => {
    expect(nextSelection(new Set(['/a', '/b']), ordered, { path: '/c', shiftKey: true })).toEqual(new Set(['/b', '/c']))
  })

  it('无选中项时 Shift 退化为单选', () => {
    expect(nextSelection(new Set(), ordered, { path: '/c', shiftKey: true })).toEqual(new Set(['/c']))
  })
})

describe('toggleInSet', () => {
  it('叠加勾选/取消，不影响其他项', () => {
    expect(toggleInSet(new Set(['/a']), '/c')).toEqual(new Set(['/a', '/c']))
    expect(toggleInSet(new Set(['/a', '/c']), '/c')).toEqual(new Set(['/a']))
  })
})

describe('isAllSelected', () => {
  it('空列表不算全选', () => {
    expect(isAllSelected([], new Set())).toBe(false)
  })

  it('全部包含才为 true，缺一个即为 false', () => {
    expect(isAllSelected(ordered, new Set(ordered))).toBe(true)
    expect(isAllSelected(ordered, new Set(['/a', '/b', '/c']))).toBe(false)
  })
})