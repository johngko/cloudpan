import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useWindows, type WinState } from '../stores/windows'
import { isMobileLayout } from '../utils/mobile'
import { registerHotkey, allHotkeys, globalSearchTick } from './hotkeys'

/** 输入控件里的按键不劫持（Ctrl+A/方向键/Alt+Tab 都属于用户） */
function inField(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

/**
 * 桌面全局键位（三主题 Desktop 共用挂载）：注册进 shell/hotkeys.ts 统一分发。
 *  - Alt+Tab / Alt+Shift+Tab：窗口切换器（Win11 式：按下即切换焦点，覆盖层显示候选；
 *    松开 Alt 落定，Esc 退回原窗口）
 *  - Win(⌘)+方向键 或 Ctrl+Alt+方向键：左右半屏 / 上最大化 / 下还原（再按最小化），
 *    Win11 的键盘分屏语义；Linux/Windows 下 ⌘ 常被系统占用，Ctrl+Alt 是备用键位
 *  - Ctrl/⌘+K：全局搜索（globalSearchTick 信号，由主题 chrome 弹出面板）
 *  - ? / F1：快捷键速查浮层
 */
export function useShellHotkeys() {
  const store = useWindows()
  const altTab = ref(false)
  const altTabIdx = ref(0)
  const tabWins = ref<WinState[]>([])
  const helpOpen = ref(false)
  const closeHelp = () => { helpOpen.value = false }

  function cycle(back: boolean) {
    const list = store.mru
    if (list.length < 2) return
    if (!altTab.value) {
      // 冻结一份焦点历史快照：0 = 当前窗口，首次 Tab 跳到 1；
      // 焦点变化会改 z，但本周期内的顺序保持快照，行为可预期
      tabWins.value = [...list]
      altTabIdx.value = back ? tabWins.value.length - 1 : 1
      altTab.value = true
    } else {
      altTabIdx.value = (altTabIdx.value + (back ? -1 : 1) + tabWins.value.length) % tabWins.value.length
    }
    const w = tabWins.value[altTabIdx.value]
    if (w) store.focus(w.id)
  }
  function closeAltTab() { altTab.value = false }
  function cancelAltTab() {
    if (altTab.value && tabWins.value[0]) store.focus(tabWins.value[0].id)
    altTab.value = false
  }
  function pickWin(id: number) {
    store.focus(id)
    altTab.value = false
  }

  // Alt/Meta 或 Ctrl+Alt + 方向键：分屏四连（Win11 语义）
  const snapCombo = (e: KeyboardEvent) =>
    (e.metaKey || (e.ctrlKey && e.altKey)) && !e.shiftKey
  function snap(e: KeyboardEvent) {
    const w = store.wins.find(x => x.id === store.activeId)
    if (!w || isMobileLayout()) return
    if (e.key === 'ArrowLeft') store.snapTo(w.id, 'L')
    else if (e.key === 'ArrowRight') store.snapTo(w.id, 'R')
    else if (e.key === 'ArrowUp') { if (!w.maximized) store.toggleMax(w.id) }
    else if (e.key === 'ArrowDown') {
      if (w.maximized) store.toggleMax(w.id)
      else store.minimize(w.id)
    }
  }

  // 注册表条目：速查表数据 + 分发行为同源，不会漂移
  const unregisterers: (() => void)[] = []
  function reg(a: Parameters<typeof registerHotkey>[0]) { unregisterers.push(registerHotkey(a)) }
  reg({
    id: 'alttab', group: '窗口与分屏', keys: ['Alt', 'Tab'], manual: true,
    desc: '切换窗口（按住连续按循环，松开落定；←→ 也可循环，Esc 取消）',
    match: e => e.key === 'Tab' && (e.altKey || e.metaKey) && !e.ctrlKey,
  })
  reg({
    id: 'snap-l', group: '窗口与分屏', keys: ['Win / ⌘', '←'],
    desc: '贴左半屏（备用键位 Ctrl+Alt+方向键）',
    match: e => snapCombo(e) && e.key === 'ArrowLeft', run: snap,
  })
  reg({
    id: 'snap-r', group: '窗口与分屏', keys: ['Win / ⌘', '→'],
    desc: '贴右半屏',
    match: e => snapCombo(e) && e.key === 'ArrowRight', run: snap,
  })
  reg({
    id: 'snap-max', group: '窗口与分屏', keys: ['Win / ⌘', '↑'],
    desc: '最大化 / 还原',
    match: e => snapCombo(e) && e.key === 'ArrowUp', run: snap,
  })
  reg({
    id: 'snap-min', group: '窗口与分屏', keys: ['Win / ⌘', '↓'],
    desc: '还原 / 最小化',
    match: e => snapCombo(e) && e.key === 'ArrowDown', run: snap,
  })
  reg({
    id: 'search', group: '桌面', keys: ['Ctrl / ⌘', 'K'],
    desc: '全局搜索（文件、应用、设置、网页）',
    match: e => (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K'),
    run: () => { globalSearchTick.value++ },
  })
  reg({
    id: 'help', group: '桌面', keys: ['?'],
    desc: '打开 / 关闭快捷键速查（F1 同）',
    match: e => ((e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) || e.key === 'F1'),
    run: () => { helpOpen.value = !helpOpen.value },
  })

  function onKey(e: KeyboardEvent) {
    // Alt+Tab 状态机优先（有状态，manual 条目不走下面的分发）
    if (e.key === 'Tab' && (e.altKey || e.metaKey) && !e.ctrlKey && !inField(e)) {
      e.preventDefault()
      cycle(e.shiftKey)
      return
    }
    if (altTab.value) {
      if (e.key === 'Escape') { e.preventDefault(); cancelAltTab(); return }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); cycle(e.key === 'ArrowLeft'); return }
    }
    // 通用分发：首条 match 命中即 preventDefault + run
    const field = inField(e)
    for (const a of allHotkeys()) {
      if (!a.run || a.manual) continue
      if (field && !a.allowInField) continue
      if (a.match(e)) { e.preventDefault(); a.run(e); return }
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    // 松开修饰键即落定（Win11：Alt+Tab 是"按住循环、松手确认"）
    if (altTab.value && (e.key === 'Alt' || e.key === 'Meta' || e.key === 'Control')) closeAltTab()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKeyUp)
    unregisterers.forEach(u => u())
    unregisterers.length = 0
  })

  return { altTab, altTabIdx, tabWins, pickWin, closeAltTab, helpOpen, closeHelp }
}
