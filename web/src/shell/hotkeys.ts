import { ref } from 'vue'

/**
 * 全局快捷键注册表（B11）：
 *  - 每条动作自带 match/run + 速查表展示信息（group/keys/desc），"?" 浮层直接从注册表渲染，
 *    新增键位只改注册处，不会再出现"实现了但没人知道"的孤儿快捷键；
 *  - 分发器在 useShellHotkeys（桌面级唯一挂载点），输入框内默认不劫持；
 *  - Alt+Tab 这类"按住循环 / 松开落定"的有状态键位设 manual=true，只登记展示，
 *    实际行为由 useShellHotkeys 的状态机处理。
 */
export interface HotkeyAction {
  id: string
  /** 速查表分组标题 */
  group: string
  /** 展示键位，如 ['Win / ⌘', '← →'] */
  keys: string[]
  desc: string
  /** 输入控件聚焦时是否仍允许触发（默认 false） */
  allowInField?: boolean
  /** 有状态键位：只登记不进分发器 */
  manual?: boolean
  match: (e: KeyboardEvent) => boolean
  run?: (e: KeyboardEvent) => void
}

const actions: HotkeyAction[] = []

/** 当前注册的全部快捷键（分发器与速查表共用） */
export function allHotkeys(): HotkeyAction[] { return actions }

/** 注册一条快捷键，返回注销函数（组件卸载时调用，避免多窗口/切主题重复触发） */
export function registerHotkey(a: HotkeyAction): () => void {
  actions.push(a)
  return () => {
    const i = actions.findIndex(x => x.id === a.id)
    if (i >= 0) actions.splice(i, 1)
  }
}

export interface HotkeyGroup { title: string; rows: { keys: string[]; desc: string }[] }

/** 按注册顺序聚合成速查表分组 */
export function hotkeyGroups(): HotkeyGroup[] {
  const map = new Map<string, HotkeyGroup['rows']>()
  for (const a of actions) {
    if (!map.has(a.group)) map.set(a.group, [])
    map.get(a.group)!.push({ keys: a.keys, desc: a.desc })
  }
  return [...map].map(([title, rows]) => ({ title, rows }))
}

/** Ctrl/⌘+K 的全局信号：桌面 chrome（任务栏/菜单栏/Dock）watch 它来弹出全局搜索 */
export const globalSearchTick = ref(0)
// B2 命令面板：主题桌面挂的 <CommandPalette/> 监听此计数（Ctrl/⌘+K）
export const paletteTick = ref(0)
