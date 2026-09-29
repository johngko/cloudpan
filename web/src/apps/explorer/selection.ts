// 选择语义纯逻辑（从 Explorer.vue 抽出，便于单测）
//
// 与 Windows 资源管理器一致：
//   - 右键：点未选中项 → 单选它；点已在选中集内的项 → 保持整组不动（右键菜单作用于整组）
//   - Ctrl：切换该项
//   - Shift：以「当前选中集最后一项」为锚点，选中有序列表中的区间
//   - 其他：单选

export interface SelectClick {
  path: string
  button?: number
  ctrlKey?: boolean
  shiftKey?: boolean
}

/**
 * 返回新的选中集；返回 null 表示「无需变更」（右键点在已选中项上）。
 * ordered 为当前排序后的路径顺序（Shift 区间依赖它）。
 */
export function nextSelection(
  cur: ReadonlySet<string>,
  ordered: readonly string[],
  clicked: SelectClick
): Set<string> | null {
  if (clicked.button === 2) {
    return cur.has(clicked.path) ? null : new Set([clicked.path])
  }
  if (clicked.ctrlKey) {
    const s = new Set(cur)
    if (s.has(clicked.path)) s.delete(clicked.path)
    else s.add(clicked.path)
    return s
  }
  if (clicked.shiftKey && cur.size) {
    // 锚点 = 选中集的最后一项（Array.from 保持插入顺序）
    const arr = Array.from(cur)
    const i1 = ordered.indexOf(arr[arr.length - 1])
    const i2 = ordered.indexOf(clicked.path)
    const [a, b] = i1 < i2 ? [i1, i2] : [i2, i1]
    return new Set(ordered.slice(a, b + 1))
  }
  return new Set([clicked.path])
}

/** 复选框叠加勾选（Windows 11 同款） */
export function toggleInSet(cur: ReadonlySet<string>, path: string): Set<string> {
  const s = new Set(cur)
  if (s.has(path)) s.delete(path)
  else s.add(path)
  return s
}

/** 是否已全选（空列表视为未全选，避免全选框在空目录里显示为勾选） */
export function isAllSelected(ordered: readonly string[], cur: ReadonlySet<string>): boolean {
  return ordered.length > 0 && ordered.every(p => cur.has(p))
}