import { computed } from 'vue'
import { useWindows, type WinState } from '../stores/windows'
import { useSession } from '../stores/session'
import { resolveTheme } from '../themes/registry'

/**
 * 窗口框架共享行为（各主题的 WindowFrame 组件复用）：
 * 定位/最大化样式、拖拽移动、八向缩放、贴边分屏（按主题开关）。
 * 屏幕保留区来自当前主题 geometry，是窗口几何的唯一事实来源。
 */
export function useWindowChrome(w: WinState) {
  const store = useWindows()
  const session = useSession()

  const geo = computed(() => resolveTheme(session.osTheme).geometry)
  const snapEdges = computed(() => resolveTheme(session.osTheme).snapEdges)

  const style = computed(() => {
    const g = geo.value
    if (w.maximized) {
      return {
        left: g.left + 'px',
        top: g.top + 'px',
        width: `calc(100vw - ${g.left + g.right}px)`,
        height: `calc(100vh - ${g.top + g.bottom}px)`,
        zIndex: w.z,
        borderRadius: '0'
      }
    }
    return { left: w.x + 'px', top: w.y + 'px', width: w.w + 'px', height: w.h + 'px', zIndex: w.z }
  })

  function focusWin() { store.focus(w.id) }
  function minimize() { store.minimize(w.id) }
  function toggleMax() { store.toggleMax(w.id) }
  function close() { store.close(w.id) }

  // 拖拽/缩放期间给窗口根挂 .win-dragging（禁用 left/top/w/h 过渡，避免跟随延迟）
  function rootOf(e: MouseEvent): HTMLElement | null {
    return (e.currentTarget as HTMLElement | null)?.closest?.('.window') ?? null
  }

  function onTitlebarDown(e: MouseEvent) {
    if (e.button !== 0) return
    store.focus(w.id)
    const root = rootOf(e)
    root?.classList.add('win-dragging')
    const startX = e.clientX, startY = e.clientY
    let moved = false
    let sx = w.x, sy = w.y
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return
      if (w.maximized) {
        // 从最大化拖出：还原并跟随鼠标
        store.toggleMax(w.id)
        sx = Math.max(0, ev.clientX - w.w / 2)
        sy = 0
        store.setRect(w.id, { x: sx, y: sy })
        return
      }
      moved = true
      const g = geo.value
      store.setRect(w.id, { x: sx + dx, y: Math.max(g.top, sy + dy) })
    }
    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      root?.classList.remove('win-dragging')
      if (!snapEdges.value) return
      // 贴边分屏（Windows/Deepin 风格）
      if (moved) {
        const g = geo.value
        const H = window.innerHeight - g.top - g.bottom
        const W = window.innerWidth - g.left - g.right
        const X = g.left
        if (ev.clientY <= g.top + 2) { w.prev = { x: w.x, y: w.y, w: w.w, h: w.h }; store.setRect(w.id, { x: X, y: g.top, w: W, h: H }); w.maximized = true }
        else if (ev.clientX <= X + 2) { store.setRect(w.id, { x: X, y: g.top, w: W / 2, h: H }) }
        else if (ev.clientX >= X + W - 2) { store.setRect(w.id, { x: X + W / 2, y: g.top, w: W / 2, h: H }) }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function onResizeDown(dir: string, e: MouseEvent) {
    e.stopPropagation()
    store.focus(w.id)
    const root = rootOf(e)
    root?.classList.add('win-dragging')
    const startX = e.clientX, startY = e.clientY
    const s = { x: w.x, y: w.y, w: w.w, h: w.h }
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      const r: any = {}
      if (dir.includes('e')) r.w = Math.max(360, s.w + dx)
      if (dir.includes('s')) r.h = Math.max(240, s.h + dy)
      if (dir.includes('w')) { r.w = Math.max(360, s.w - dx); r.x = s.x + (s.w - r.w) }
      if (dir.includes('n')) { r.h = Math.max(240, s.h - dy); r.y = s.y + (s.h - r.h) }
      store.setRect(w.id, r)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      root?.classList.remove('win-dragging')
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return { style, focusWin, minimize, toggleMax, close, onTitlebarDown, onResizeDown }
}
