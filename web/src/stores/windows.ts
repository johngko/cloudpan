import { defineStore } from 'pinia'
import { appDef } from './apps'
import { useSession } from './session'
import { resolveTheme } from '../themes/registry'
import { isMobileLayout } from '../utils/mobile'

// 屏幕保留区（菜单栏/任务栏/Dock）统一取自当前主题 geometry
function shellInsets() {
  return resolveTheme(useSession().osTheme).geometry
}

export interface WinRect { x: number; y: number; w: number; h: number }
/** Snap 分区：L/R 半屏，TL..BR 四象限（Flyout 与 Win+方向键共用） */
export type SnapZone = 'L' | 'R' | 'TL' | 'TR' | 'BL' | 'BR'
/** B8 虚拟桌面：窗口归属一个桌面，任务视图只在桌面间切换可见性 */
export interface Desktop { id: number; name: string }

export interface WinState {
  id: number
  app: string
  /** 所属虚拟桌面 id（缺省 = 1 号桌面；open() 自动打上当前桌面） */
  desktop?: number
  title: string
  icon: string
  x: number; y: number; w: number; h: number
  minimized: boolean
  maximized: boolean
  z: number
  /** 窗口负载：每个应用各不相同（explorer 带 policyId/path、office 带 shareId/rel…），
   *  刻意保持宽松 —— 收紧成具体类型会让全部应用组件都来改这里，收益远小于波及面 */
  props: any
  prev?: WinRect
  /** 最小化飞行动画进行中（CSS .minimizing，timer 落定后转 minimized） */
  minimizing?: boolean
  /** 从最小化恢复的飞行动画进行中（CSS .restoring） */
  restoring?: boolean
}

let nextId = 1
let topZ = 100

// 最小化/恢复动画的落定 timer（不依赖 animationend——后台 tab 动画不播时也能收敛）
const settleTimers = new Map<number, number>()
function settle(id: number, fn: () => void, ms: number) {
  const old = settleTimers.get(id)
  if (old) window.clearTimeout(old)
  settleTimers.set(id, window.setTimeout(() => { settleTimers.delete(id); fn() }, ms))
}

export const useWindows = defineStore('windows', {
  state: () => ({
    wins: [] as WinState[],
    activeId: 0,
    desktops: [{ id: 1, name: '桌面 1' }] as Desktop[],
    currentDesktop: 1,
    nextDesktopId: 2
  }),
  getters: {
    /** 当前桌面的窗口（桌面渲染/任务栏只认这些） */
    visibleWins(state): WinState[] { return state.wins.filter(w => (w.desktop ?? 1) === state.currentDesktop) },
    taskbarWins(state): WinState[] { return state.wins.filter(w => (w.desktop ?? 1) === state.currentDesktop) },
    /** 焦点历史（最近使用优先）：Alt+Tab 切换器与任务栏预览取序用 */
    mru(state): WinState[] { return state.wins.filter(w => (w.desktop ?? 1) === state.currentDesktop).sort((a, b) => b.z - a.z) }
  },
  actions: {
    open(app: string, props: any = null, opts: { title?: string; icon?: string; w?: number; h?: number } = {}) {
      // 单实例应用（AppDef.multi 未置位的）：聚焦已有窗口（带新 props 时同步——设置深链/浏览器 URL 等场景）。
      // 文档类应用在 apps.ts 里标了 multi: true，按文档多开：组件没有 props 变更监听，
      // 复用窗口会出现标题/内容错位（旧文件预览 + 新文件名）
      const existing = appDef(app)?.multi
        ? undefined
        : this.wins.find(w => w.app === app)
      if (existing) {
        if (props) existing.props = props
        this.focus(existing.id)
        return existing.id
      }
      // 未显式给尺寸时用应用注册表默认值（开始菜单/桌面启动不传 opts）
      const ww = opts.w || appDef(app)?.w || 900, wh = opts.h || appDef(app)?.h || 600
      const g = shellInsets()
      const maxW = window.innerWidth - g.left - g.right, maxH = window.innerHeight - g.top - g.bottom
      // 手机布局：窗口直接铺满可用区并标记为最大化。
      // 不做居中偏移（手机上偏移会顶出屏幕），也不留浮动状态——手机下拖拽已禁用，
      // 浮动窗口会变成既移不动又占不满屏的残窗
      const area = isMobileLayout() ? this.isMaximizedArea() : null
      const w = area ? area.w : Math.min(ww, maxW - 40), h = area ? area.h : Math.min(wh, maxH - 40)
      const off = (this.wins.length % 6) * 28
      const win: WinState = {
        id: nextId++, app, title: opts.title || appDef(app)?.name || app, icon: opts.icon || app,
        desktop: this.currentDesktop,
        x: area ? area.x : Math.max(g.left + 8, Math.round(g.left + (maxW - w) / 2) - 80 + off),
        y: area ? area.y : Math.max(g.top + 8, Math.round(g.top + (maxH - h) / 2) - 30 + off),
        w, h, minimized: false, maximized: !!area, z: ++topZ, props: props || {}
      }
      this.wins.push(win)
      this.activeId = win.id
      return win.id
    },
    close(id: number) {
      // 动画过渡中的窗口被直接关闭：清掉落定 timer，回调里 find 不到也不会误伤
      // （移出列表后由桌面 TransitionGroup 播 win-anim leave 离场动画）
      const t = settleTimers.get(id)
      if (t) { window.clearTimeout(t); settleTimers.delete(id) }
      const i = this.wins.findIndex(w => w.id === id)
      if (i >= 0) this.wins.splice(i, 1)
      if (this.activeId === id) this.activeId = this.wins.length ? this.wins[this.wins.length - 1].id : 0
    },
    // ---- B8 虚拟桌面 ----
    addDesktop() {
      if (this.desktops.length >= 6) return
      const id = this.nextDesktopId++
      this.desktops.push({ id, name: `桌面 ${id}` })
      this.currentDesktop = id
    },
    switchDesktop(id: number) {
      if (this.desktops.some(d => d.id === id)) this.currentDesktop = id
    },
    cycleDesktop(dir: number) {
      if (this.desktops.length < 2) return
      const i = this.desktops.findIndex(d => d.id === this.currentDesktop)
      const n = ((i + dir) % this.desktops.length + this.desktops.length) % this.desktops.length
      this.currentDesktop = this.desktops[n].id
    },
    removeDesktop(id: number) {
      if (this.desktops.length <= 1) return
      const rest = this.desktops.filter(d => d.id !== id)
      const dest = rest[0].id
      for (const w of this.wins) if ((w.desktop ?? 1) === id) w.desktop = dest
      this.desktops = rest
      if (this.currentDesktop === id) this.currentDesktop = dest
    },
    moveWinToDesktop(winId: number, desktopId: number) {
      const w = this.wins.find(x => x.id === winId)
      if (w && this.desktops.some(d => d.id === desktopId)) w.desktop = desktopId
    },

    focus(id: number) {
      const w = this.wins.find(x => x.id === id)
      if (!w) return
      w.z = ++topZ
      this.activeId = id
      if (w.minimized) {
        // 恢复：先播飞行入场动画（.restoring），timer 落定
        w.minimized = false
        w.restoring = true
        settle(id, () => { const win = this.wins.find(x => x.id === id); if (win) win.restoring = false }, 300)
      }
    },
    minimize(id: number) {
      const w = this.wins.find(x => x.id === id)
      if (!w || w.minimized || w.minimizing) return
      // 最小化：先播飞离动画（.minimizing），timer 落定才真正隐藏
      w.minimizing = true
      if (this.activeId === id) {
        const others = this.wins.filter(x => !x.minimized && !x.minimizing && x.id !== id).sort((a, b) => b.z - a.z)
        this.activeId = others.length ? others[0].id : 0
      }
      settle(id, () => { const win = this.wins.find(x => x.id === id); if (win) { win.minimized = true; win.minimizing = false } }, 300)
    },
    minimizeAll() {
      for (const w of [...this.wins]) if (!w.minimized && !w.minimizing) this.minimize(w.id)
    },
    toggleMax(id: number) {
      const w = this.wins.find(x => x.id === id)
      if (!w) return
      // 手机布局下窗口必须始终铺满：标题栏双击/最大化按钮都可能触发到这里，
      // 若允许还原成浮动窗口，用户会发现窗口既拖不动（拖拽已禁用）又没占满屏
      if (isMobileLayout()) {
        const r = this.isMaximizedArea()
        if (!w.maximized) w.prev = { x: w.x, y: w.y, w: w.w, h: w.h }
        Object.assign(w, { x: r.x, y: r.y, w: r.w, h: r.h, maximized: true })
        this.focus(id)
        return
      }
      if (w.maximized) {
        if (w.prev) { Object.assign(w, w.prev); w.prev = undefined }
        w.maximized = false
      } else {
        w.prev = { x: w.x, y: w.y, w: w.w, h: w.h }
        w.maximized = true
        w.z = ++topZ
      }
      this.focus(id)
    },
    /** 把窗口吸附到指定分区（Flyout / Win+方向键共用）。半屏/四象限几何按主题保留区计算 */
    snapTo(id: number, zone: SnapZone) {
      const w = this.wins.find(x => x.id === id)
      if (!w) return
      const area = this.isMaximizedArea()
      const half = { w: Math.round(area.w / 2), h: Math.round(area.h / 2) }
      const rects: Record<SnapZone, WinRect> = {
        L: { x: area.x, y: area.y, w: area.w - half.w, h: area.h },
        R: { x: area.x + half.w, y: area.y, w: area.w - half.w, h: area.h },
        TL: { x: area.x, y: area.y, w: half.w, h: area.h - half.h },
        TR: { x: area.x + half.w, y: area.y, w: area.w - half.w, h: area.h - half.h },
        BL: { x: area.x, y: area.y + half.h, w: half.w, h: area.h - half.h },
        BR: { x: area.x + half.w, y: area.y + half.h, w: area.w - half.w, h: area.h - half.h }
      }
      const r = rects[zone]
      if (!r) return
      // 从最大化吸附：maximized 关掉即可，prev 里存着原浮动几何不动
      w.maximized = false
      this.focus(id)
      this.setRect(id, r)
    },
    setRect(id: number, r: Partial<WinRect>) {
      const w = this.wins.find(x => x.id === id)
      if (!w) return
      Object.assign(w, r)
    },
    setTitle(id: number, title: string) {
      const w = this.wins.find(x => x.id === id)
      if (w) w.title = title
    },
    // patch 同样是各应用自定义的负载片段，与 props 保持同一宽松度
    updateProps(id: number, patch: any) {
      const w = this.wins.find(x => x.id === id)
      if (!w || !patch) return
      w.props = { ...(w.props || {}), ...patch }
    },
    isMaximizedArea(): WinRect {
      const g = shellInsets()
      return { x: g.left, y: g.top, w: window.innerWidth - g.left - g.right, h: window.innerHeight - g.top - g.bottom }
    }
  }
})
