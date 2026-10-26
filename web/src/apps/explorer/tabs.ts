// 标签页与其前进/后退历史的纯逻辑（从 Explorer.vue 抽出，便于单测）
//
// 历史语义（与浏览器一致）：
//   - history 记录「到达过的路径」（含当前），上限 60
//   - 新导航清空 fwdStack
//   - 后退时先跳过与当前路径相同的栈顶，否则第一次按后退会原地不动

export interface ExplorerTab {
  policyId: number | null
  path: string
  keyword: string
  globalMode: boolean
  /** 全局搜索子模式：false=按文件名，true=按文件内容（懒索引） */
  contentMode: boolean
  viewMode: 'grid' | 'list'
  history: string[]
  fwdStack: string[]
}

/** 新建标签页的初始状态（大图标视图、无搜索、无历史） */
export function newTab(policyId: number | null = null, path = '/'): ExplorerTab {
  return { policyId, path, keyword: '', globalMode: false, contentMode: false, viewMode: 'grid', history: [], fwdStack: [] }
}

/**
 * 关闭下标 closed 的标签「之后」计算新的活动下标（此时列表已移除该项）。
 * 返回 null = 已无标签，调用方应关闭整个窗口。
 */
export function activeIdxAfterClose(postLength: number, closed: number, activeIdx: number): number | null {
  if (postLength <= 0) return null
  if (closed < activeIdx) return activeIdx - 1
  // 关掉的是当前页且右侧已无标签 → 左移到新的末尾
  if (closed === activeIdx && activeIdx >= postLength) return postLength - 1
  return activeIdx
}

/** 记录一次导航：压入 history（保留最近 60 条）并清空前进栈 */
export function recordHistory(history: string[], fwdStack: string[], p: string): void {
  history.push(p)
  if (history.length > 60) history.shift()
  fwdStack.length = 0
}

/** 后退一步：返回目标路径；null = 无历史可退（此时不应改动前进栈） */
export function backTarget(history: string[], current: string): string | null {
  while (history.length && history[history.length - 1] === current) history.pop()
  if (!history.length) return null
  return history.pop() as string
}

/** 前进一步：返回目标路径；null = 前进栈为空 */
export function fwdTarget(fwdStack: string[]): string | null {
  if (!fwdStack.length) return null
  return fwdStack.pop() as string
}

/** 上一级目录（根目录仍返回根，调用方需自行短路以免重复入栈） */
export function parentPath(p: string): string {
  return p.slice(0, p.lastIndexOf('/')) || '/'
}