import { computed } from 'vue'
import { useWindows, type WinState } from '../stores/windows'
import { useSession } from '../stores/session'
import { resolveTheme } from '../themes/registry'
import { isMobileLayout } from '../utils/mobile'

/**
 * 窗口框架共享行为（各主题的 WindowFrame 组件复用）：
 * 定位/最大化样式、拖拽移动、八向缩放、贴边分屏（按主题开关）。
 * 屏幕保留区来自当前主题 geometry，是窗口几何的唯一事实来源。
 *
 * 拖拽/缩放统一走 Pointer Events（模板绑 @pointerdown）：鼠标与触屏同一套代码，
 * 原先只绑 mousedown，移动端/触屏无法拖动或缩放窗口。
 */
// Aero Snap 预览幽灵（Win11）：拖窗口贴近屏幕边缘时，先画出目标区域的半透明预览，
// 松手才真正分屏；全页只建一个，各窗口拖拽共用
let snapGhost: HTMLDivElement | null = null
function ensureSnapGhost(): HTMLDivElement {
  if (!snapGhost || !snapGhost.isConnected) {
    snapGhost = document.createElement('div')
    snapGhost.className = 'win-snap-ghost'
    document.body.appendChild(snapGhost)
  }
  return snapGhost
}
function hideSnapGhost() { if (snapGhost) snapGhost.style.display = 'none' }
const SNAP_M = 8 // 贴边判定阈值（预览与真实吸附共用）
// 拖拽边界钳制：横向至少保留这么多像素可见，纵向标题栏必须留在工作区内（否则拖不回来）
const KEEP_VISIBLE_X = 120
const KEEP_VISIBLE_Y = 40

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }

type Geo = { top: number; bottom: number; left: number; right: number }

function workArea(g: Geo) {
  return { X: g.left, Y: g.top, W: window.innerWidth - g.left - g.right, H: window.innerHeight - g.top - g.bottom }
}

// 命中哪条边：top（最大化）/ bottom（下半屏）/ left（左半屏）/ right（右半屏）
function snapTarget(g: Geo, cx: number, cy: number): [number, number, number, number] | null {
  const { X, Y, W, H } = workArea(g)
  if (cy <= Y + SNAP_M) return [X, Y, W, H]
  if (cy >= Y + H - SNAP_M) return [X, Y + H / 2, W, H / 2]
  if (cx <= X + SNAP_M) return [X, Y, W / 2, H]
  if (cx >= X + W - SNAP_M) return [X + W / 2, Y, W / 2, H]
  return null
}

function updateSnapGhost(g: Geo, cx: number, cy: number) {
  const r = snapTarget(g, cx, cy)
  const el = ensureSnapGhost()
  if (r) {
    el.style.display = 'block'
    el.style.left = r[0] + 'px'
    el.style.top = r[1] + 'px'
    el.style.width = r[2] + 'px'
    el.style.height = r[3] + 'px'
  } else {
    el.style.display = 'none'
  }
}

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
  function rootOf(e: Event): HTMLElement | null {
    return (e.currentTarget as HTMLElement | null)?.closest?.('.window') ?? null
  }

  function onTitlebarDown(e: PointerEvent) {
    if (e.button !== 0) return
    store.focus(w.id)
    // 手机布局：窗口铺满屏幕，禁用拖拽（否则会把窗口拖出可视区且无路可回）
    if (isMobileLayout()) return
    e.preventDefault() // 触屏：阻止默认滚动手势，改由拖拽接管
    const root = rootOf(e)
    root?.classList.add('win-dragging')
    const startX = e.clientX, startY = e.clientY
    let moved = false
    let sx = w.x, sy = w.y
    const onMove = (ev: PointerEvent) => {
      const g = geo.value
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return
      if (w.maximized) {
        // 从最大化拖出：还原并跟随鼠标
        store.toggleMax(w.id)
        const { X, W } = workArea(g)
        sx = clamp(ev.clientX - w.w / 2, X, X + W - w.w)
        sy = g.top
        store.setRect(w.id, { x: sx, y: sy })
        return
      }
      moved = true
      const { X, Y, W, H } = workArea(g)
      // 边界钳制：横向至少保留 KEEP_VISIBLE_X 可见，纵向标题栏不越过工作区底部
      const nx = clamp(sx + dx, X - w.w + KEEP_VISIBLE_X, X + W - KEEP_VISIBLE_X)
      const ny = clamp(sy + dy, Y, Y + H - KEEP_VISIBLE_Y)
      store.setRect(w.id, { x: nx, y: ny })
      if (snapEdges.value) updateSnapGhost(g, ev.clientX, ev.clientY) // 贴边即显示目标区域预览
    }
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      root?.classList.remove('win-dragging')
      hideSnapGhost()
      if (!snapEdges.value || !moved) return
      // 贴边分屏（Windows/Deepin 风格，阈值与预览一致；含底部下半屏）
      const g = geo.value
      const r = snapTarget(g, ev.clientX, ev.clientY)
      if (!r) return
      if (r[1] === g.top && r[2] === workArea(g).W && r[3] === workArea(g).H) {
        w.prev = { x: w.x, y: w.y, w: w.w, h: w.h }
        store.setRect(w.id, { x: r[0], y: r[1], w: r[2], h: r[3] })
        w.maximized = true
        return
      }
      store.setRect(w.id, { x: r[0], y: r[1], w: r[2], h: r[3] })
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }

  function onResizeDown(dir: string, e: PointerEvent) {
    e.stopPropagation()
    // 手机布局：禁用八向缩放（句柄在窄屏上也已隐藏，这里再兜一层）
    if (isMobileLayout()) return
    e.preventDefault() // 触屏：阻止默认手势
    store.focus(w.id)
    const root = rootOf(e)
    root?.classList.add('win-dragging')
    const startX = e.clientX, startY = e.clientY
    const s = { x: w.x, y: w.y, w: w.w, h: w.h }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      const r: any = {}
      // 最小宽度不能大于当前视口，否则窄屏（如平板分屏/窄窗口）拖拽会把窗口顶出屏
      const minW = Math.min(360, window.innerWidth - 24)
      if (dir.includes('e')) r.w = Math.max(minW, s.w + dx)
      if (dir.includes('s')) r.h = Math.max(240, s.h + dy)
      if (dir.includes('w')) { r.w = Math.max(minW, s.w - dx); r.x = s.x + (s.w - r.w) }
      if (dir.includes('n')) { r.h = Math.max(240, s.h - dy); r.y = s.y + (s.h - r.h) }
      store.setRect(w.id, r)
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      root?.classList.remove('win-dragging')
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }

  return { style, focusWin, minimize, toggleMax, close, onTitlebarDown, onResizeDown }
}