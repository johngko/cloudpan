// 桌面图标顺序的纯逻辑（三主题桌面共用；与渲染解耦，便于单测）。
//
// 顺序持久化在用户设置 KV：desktop_icon_order = JSON.stringify(string[])，
// 只存图标 id。主题自有图标（此电脑/回收站等）在三个主题里 id 相同，故同一份
// 顺序可在三主题间通用；应用新增/卸载/权限变更导致的图标增删不写回 KV——
// 渲染时按「KV 里有的按 KV 排，其余保持原顺序追加末尾」实时合并。

/** 参与排序的最小结构（桌面图标、主题自有图标都满足） */
export interface OrderableIcon {
  id: string
}

/** 规范化顺序表：丢弃空串/非字符串并去重（KV 可被手工改坏或跨版本残留） */
export function normalizeOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string' || v === '' || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/** 解析 KV 里的顺序串；坏值一律回退为空表（顺序丢失只会回到默认序，不影响功能） */
export function parseOrder(raw?: string | null): string[] {
  if (!raw) return []
  try {
    return normalizeOrder(JSON.parse(raw))
  } catch {
    return []
  }
}

/**
 * 按持久化顺序排列图标：顺序表里出现的按其位置排在前，其余（新装应用、
 * 换主题后新增的主题图标、KV 尚未拉到的首帧）保持传入顺序追加到末尾。
 * 任何图标都不会因顺序表缺项而消失或换位。
 */
export function sortByOrder<T extends OrderableIcon>(icons: T[], order: string[]): T[] {
  if (order.length === 0) return icons.slice()
  const rank = new Map<string, number>()
  order.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i)
  })
  return icons
    .map((ic, i) => ({ ic, i }))
    .sort((a, b) => {
      const ra = rank.get(a.ic.id)
      const rb = rank.get(b.ic.id)
      if (ra === undefined && rb === undefined) return a.i - b.i
      if (ra === undefined) return 1
      if (rb === undefined) return -1
      return ra - rb
    })
    .map((x) => x.ic)
}

/**
 * 拖放重排：把 fromId 移到 toId 的位置（落地即占位）。
 * 先摘除 fromId 再从 toId 的索引插入，于是向上拖落在目标之前、向下拖落在目标之后，
 * 与"拖到哪就停在哪"的直觉一致。
 * 任一侧 id 不存在或两者相同则原样返回（防御拖拽被中断/跨主题的残缺状态）。
 */
export function moveIcon(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  if (from < 0 || to < 0 || from === to) return ids.slice()
  const next = ids.slice()
  next.splice(from, 1)
  next.splice(to, 0, fromId)
  return next
}