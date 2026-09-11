import { defineStore } from 'pinia'
import { appDef } from './apps'
import { useSession } from './session'
import { resolveTheme } from '../themes/registry'

// 屏幕保留区（菜单栏/任务栏/Dock）统一取自当前主题 geometry
function shellInsets() {
  return resolveTheme(useSession().osTheme).geometry
}

export interface WinRect { x: number; y: number; w: number; h: number }
export interface WinState {
  id: number
  app: string
  title: string
  icon: string
  x: number; y: number; w: number; h: number
  minimized: boolean
  maximized: boolean
  z: number
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
    activeId: 0
  }),
  getters: {
    taskbarWins(state): WinState[] { return state.wins }
  },
  actions: {
    open(app: string, props: any = null, opts: { title?: string; icon?: string; w?: number; h?: number } = {}) {
      // 单实例应用：聚焦已有窗口（带新 props 时同步——设置深链/浏览器 URL 等场景）。
      // 文档类应用（officeeditor）按文档多开：组件无 props 变更监听，复用窗口会出现
      // 标题/工具栏新文件名但预览停留在旧文件的状态，编辑保存会错位到另一文件
      const existing = this.wins.find(w => w.app === app && (app !== 'explorer' && app !== 'notepad' && app !== 'imageviewer' && app !== 'mediaviewer' && app !== 'officeeditor' && app !== 'archiveviewer' && app !== 'mindmap' && app !== 'whiteboard' && app !== 'flowchart' && app !== 'imageeditor' && app !== 'pdfreader'))
      if (existing) {
        if (props) existing.props = props
        this.focus(existing.id)
        return existing.id
      }
      const ww = opts.w || 900, wh = opts.h || 600
      const g = shellInsets()
      const maxW = window.innerWidth - g.left - g.right, maxH = window.innerHeight - g.top - g.bottom
      const w = Math.min(ww, maxW - 40), h = Math.min(wh, maxH - 40)
      const off = (this.wins.length % 6) * 28
      const win: WinState = {
        id: nextId++, app, title: opts.title || appDef(app)?.name || app, icon: opts.icon || app,
        x: Math.max(g.left + 8, Math.round(g.left + (maxW - w) / 2) - 80 + off),
        y: Math.max(g.top + 8, Math.round(g.top + (maxH - h) / 2) - 30 + off),
        w, h, minimized: false, maximized: false, z: ++topZ, props: props || {}
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
    setRect(id: number, r: Partial<WinRect>) {
      const w = this.wins.find(x => x.id === id)
      if (!w) return
      Object.assign(w, r)
    },
    setTitle(id: number, title: string) {
      const w = this.wins.find(x => x.id === id)
      if (w) w.title = title
    },
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
