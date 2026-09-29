// Explorer 列表排序的纯逻辑（与组件解耦，便于单测）
//
// 语义与 Windows 资源管理器一致：文件夹恒在文件之前（不随升降序反转），
// 排序方向只作用于「同为文件夹」或「同为文件」的内部。

export type SortMode = 'name' | 'size' | 'modTime' | 'type'
export type SortDir = 'asc' | 'desc'

/** 排序只依赖这些字段，便于测试构造最小数据；FileItem 天然满足该结构 */
export interface SortableEntry {
  name: string
  isDir: boolean
  size: number
  modTime: number
  ext?: string
}

/** 点击列头/右键菜单项后的新排序状态：同列翻转方向，换列重置为升序 */
export function nextSort(cur: { mode: SortMode; dir: SortDir }, clicked: SortMode): { mode: SortMode; dir: SortDir } {
  if (cur.mode === clicked) return { mode: clicked, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
  return { mode: clicked, dir: 'asc' }
}

/** 返回排好序的新数组（不修改入参；相同输入必然得到相同输出） */
export function sortEntries<T extends SortableEntry>(items: readonly T[], mode: SortMode, dir: SortDir): T[] {
  const k = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    let r = 0
    switch (mode) {
      case 'size': r = a.size - b.size; break
      case 'modTime': r = a.modTime - b.modTime; break
      // 同类型（同扩展名）时回落按名称排序，避免顺序随机
      case 'type': r = (a.ext || '').localeCompare(b.ext || '') || a.name.localeCompare(b.name, 'zh-CN'); break
      default: r = a.name.localeCompare(b.name, 'zh-CN')
    }
    return r * k
  })
}