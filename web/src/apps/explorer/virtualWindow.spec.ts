import { describe, it, expect } from 'vitest'
import { computeWindow, VIRTUAL_THRESHOLD, VIRTUAL_OVERSCAN } from './virtualWindow'

const grid = (over: Partial<Parameters<typeof computeWindow>[0]> = {}) => computeWindow({
  total: 3000, windowed: true, scrollTop: 0, viewportH: 600, rowH: 108, perRow: 10, ...over
})

describe('computeWindow · 退回全量渲染', () => {
  it('未开窗口化 → 全量且无占位', () => {
    expect(grid({ windowed: false })).toEqual({ start: 0, end: 3000, padTop: 0, padBottom: 0 })
  })
  it('未超阈值 → 全量（阈值本身也全量）', () => {
    expect(grid({ total: VIRTUAL_THRESHOLD })).toEqual({ start: 0, end: VIRTUAL_THRESHOLD, padTop: 0, padBottom: 0 })
    expect(grid({ total: VIRTUAL_THRESHOLD - 1 })).toEqual({ start: 0, end: VIRTUAL_THRESHOLD - 1, padTop: 0, padBottom: 0 })
  })
  it('行高或视口未测到 → 全量（宁全渲染，不留白）', () => {
    expect(grid({ rowH: 0 })).toEqual({ start: 0, end: 3000, padTop: 0, padBottom: 0 })
    expect(grid({ viewportH: 0 })).toEqual({ start: 0, end: 3000, padTop: 0, padBottom: 0 })
  })
  it('空目录 → 全量空区间', () => {
    expect(computeWindow({ total: 0, windowed: true })).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 })
  })
})

describe('computeWindow · 顶部', () => {
  it('滚动为 0 → 从第 0 行起，无上占位，且带 overscan 下缓冲', () => {
    // 600/108 = 5.56 → 需要第 0..5 行，加 2 行 overscan → 第 0..7 行 → 80 项
    const w = grid()
    expect(w.start).toBe(0)
    expect(w.end).toBe((Math.ceil(600 / 108) + VIRTUAL_OVERSCAN) * 10)
    expect(w.padTop).toBe(0)
    expect(w.padBottom).toBe((300 - w.end / 10) * 108)
  })
})

describe('computeWindow · 中部', () => {
  it('上下都有占位，且「上占位+渲染高度+下占位 = 总高」', () => {
    const w = grid({ scrollTop: 5400 }) // 第 50 行
    expect(w.start % 10).toBe(0)
    expect(w.start / 10).toBe(50 - VIRTUAL_OVERSCAN)
    const rows = 300
    const renderedRows = (w.end - w.start) / 10
    expect(w.padTop + renderedRows * 108 + w.padBottom).toBe(rows * 108)
  })
  it('渲染区间始终不越界且非空', () => {
    for (const t of [0, 108, 5000, 32000, 999999]) {
      const w = grid({ scrollTop: t })
      expect(w.start).toBeGreaterThanOrEqual(0)
      expect(w.end).toBeLessThanOrEqual(3000)
      expect(w.start).toBeLessThan(w.end)
    }
  })
})

describe('computeWindow · 底部与钳制', () => {
  it('滚到底 → 下占位为 0', () => {
    const w = grid({ scrollTop: 300 * 108 - 600 })
    expect(w.padBottom).toBe(0)
    expect(w.end).toBe(3000)
  })
  it('滚动值超出内容（切目录残留）→ 钳到最大合法值，不出现负占位/空区间', () => {
    const w = grid({ scrollTop: 999999 })
    expect(w.padBottom).toBe(0)
    expect(w.end).toBe(3000)
    expect(w.start).toBeLessThan(3000)
  })
  it('负滚动值 → 当作 0', () => {
    const w = grid({ scrollTop: -50 })
    expect(w.start).toBe(0)
    expect(w.padTop).toBe(0)
  })
})

describe('computeWindow · 列表视图（每行 1 项）', () => {
  it('按行切片，占位合计等于总高', () => {
    const w = computeWindow({ total: 1000, windowed: true, scrollTop: 3400, viewportH: 680, rowH: 34, perRow: 1 })
    const rendered = w.end - w.start
    expect(w.padTop + rendered * 34 + w.padBottom).toBe(1000 * 34)
    expect(w.start).toBe(100 - VIRTUAL_OVERSCAN)
  })
  it('每行条目数非法（0/负数）→ 按 1 处理，不产生重叠', () => {
    const w = computeWindow({ total: 1000, windowed: true, scrollTop: 0, viewportH: 680, rowH: 34, perRow: 0 })
    expect(w.start).toBe(0)
    expect(w.end).toBeGreaterThan(0)
  })
})
