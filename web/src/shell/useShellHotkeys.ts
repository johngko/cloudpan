import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useWindows, type WinState } from '../stores/windows'
import { isMobileLayout } from '../utils/mobile'

/** 输入控件里的按键不劫持（Ctrl+A/方向键/Alt+Tab 都属于用户） */
function inField(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

/**
 * 桌面全局键位（三主题 Desktop 共用挂载）：
 *  - Alt+Tab / Alt+Shift+Tab：窗口切换器（Win11 式：按下即切换焦点，覆盖层显示候选；
 *    松开 Alt 落定，Esc 退回原窗口）
 *  - Win(⌘)+方向键 或 Ctrl+Alt+方向键：左右半屏 / 上最大化 / 下还原（再按最小化），
 *    Win11 的键盘分屏语义；Linux/Windows 下 ⌘ 常被系统占用，Ctrl+Alt 是备用键位
 */
export function useShellHotkeys() {
  const store = useWindows()
  const altTab = ref(false)
  const altTabIdx = ref(0)
  const tabWins = ref<WinState[]>([])

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

  function onKey(e: KeyboardEvent) {
    // Alt+Tab（含 Cmd+Tab，mac 习惯）
    if (e.key === 'Tab' && (e.altKey || e.metaKey) && !e.ctrlKey && !inField(e)) {
      e.preventDefault()
      cycle(e.shiftKey)
      return
    }
    if (altTab.value) {
      if (e.key === 'Escape') { e.preventDefault(); cancelAltTab(); return }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); cycle(e.key === 'ArrowLeft'); return }
    }
    // Win/⌘ + 方向键（备用：Ctrl+Alt）——桌面级分屏
    if ((e.metaKey || (e.ctrlKey && e.altKey)) && !inField(e) && !isMobileLayout()) {
      const w = store.wins.find(x => x.id === store.activeId)
      if (!w) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); store.snapTo(w.id, 'L') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); store.snapTo(w.id, 'R') }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!w.maximized) store.toggleMax(w.id) }
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (w.maximized) store.toggleMax(w.id)
        else store.minimize(w.id)
      }
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
  })

  return { altTab, altTabIdx, tabWins, pickWin, closeAltTab }
}
