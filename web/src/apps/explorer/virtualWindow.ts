// 大文件夹「窗口化渲染」纯逻辑（从 Explorer.vue 抽出，便于单测）
//
// 背景（实测）：一个 3000 项的目录，Explorer 会一次性渲染 3000 个 DOM 条目 ——
//   首次渲染约 1.2s、之后每次点选/框选都要重刷全部条目（约 +90~150ms）。
//   条目数越大越慢，呈线性。
// 做法：只渲染视口内的行（外加 overscan 行），上下用占位高度撑住滚动条总高，
//   于是滚动位置、框选坐标（都基于视口坐标）语义完全不变。
//
// 只在总数超过阈值时启用（见 VIRTUAL_THRESHOLD）：普通目录仍走「全量渲染」，
// 渲染结果与样式一个像素都不变，把改动风险关在大目录里。

/** 超过该条目数才启用窗口化渲染 */
export const VIRTUAL_THRESHOLD = 300
/** 视口上下各多渲染的行数（滚动时留缓冲，避免白屏） */
export const VIRTUAL_OVERSCAN = 2

export interface WindowRange {
  /** 渲染区间的起始下标（含） */
  start: number
  /** 渲染区间的结束下标（不含） */
  end: number
  /** 上占位高度（px），撑住被折叠掉的行 */
  padTop: number
  /** 下占位高度（px） */
  padBottom: number
}

export interface WindowInput {
  /** 条目总数 */
  total: number
  /** 是否走窗口化（视口/行高未就绪时应传 false，退回全量渲染） */
  windowed?: boolean
  /** 容器当前滚动距离 */
  scrollTop?: number
  /** 容器可视高度 */
  viewportH?: number
  /** 单行高度（含行间距）；行高不固定时不能窗口化 */
  rowH?: number
  /** 每行条目数（网格=列数，列表=1） */
  perRow?: number
  overscan?: number
  threshold?: number
}

const FULL = (total: number): WindowRange => ({ start: 0, end: total, padTop: 0, padBottom: 0 })

/**
 * 计算要渲染的区间与上下占位高度。
 * 任何前置条件不满足（未开窗口化 / 未超阈值 / 行高或视口未测到）都退回全量渲染，
 * 保证「算不出来就老实全渲染」，不会出现空白。
 */
export function computeWindow(o: WindowInput): WindowRange {
  const total = Math.max(0, Math.floor(o.total) || 0)
  if (!o.windowed) return FULL(total)
  const threshold = o.threshold ?? VIRTUAL_THRESHOLD
  if (total <= threshold) return FULL(total)

  const perRow = Math.max(1, Math.floor(o.perRow ?? 1) || 1)
  const rowH = o.rowH && o.rowH > 0 ? o.rowH : 0
  const viewportH = o.viewportH && o.viewportH > 0 ? o.viewportH : 0
  if (!rowH || !viewportH) return FULL(total)

  const rows = Math.ceil(total / perRow)
  const overscan = Math.max(0, Math.floor(o.overscan ?? VIRTUAL_OVERSCAN) || 0)
  // 滚动位置钳到合法范围：切目录后容器可能残留旧滚动值
  const maxTop = Math.max(0, rows * rowH - viewportH)
  const top = Math.min(Math.max(0, o.scrollTop || 0), maxTop)

  const firstRow = Math.max(0, Math.floor(top / rowH) - overscan)
  const lastRow = Math.min(rows, Math.ceil((top + viewportH) / rowH) + overscan)

  return {
    start: firstRow * perRow,
    end: Math.min(total, lastRow * perRow),
    padTop: firstRow * rowH,
    padBottom: (rows - lastRow) * rowH,
  }
}
