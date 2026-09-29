import { watch } from 'vue'
import { defineStore } from 'pinia'
import { notifyApi, type NotifyItem } from '../api/modules'
import { getToken } from '../api/http'
import { useAppState } from './appstate'

// 模块级：权限未决时的 watcher（页面生命周期内只建一个，任务栏多次挂载不重复订阅）
let permWatcher: (() => void) | null = null

// SSE 重连退避：EventSource 自带重连节奏不可控且拿不到状态码，改为自行指数退避
const SSE_BASE_DELAY = 1000
const SSE_MAX_DELAY = 60000
const SSE_GIVE_UP = 8 // 连续失败上限：超过则放弃重连（功能被停用/无权限），靠 30s 轮询兜底

// 站内通知：30s 轮询未读数，打开面板时拉取列表
export const useNotify = defineStore('notify', {
  state: () => ({
    list: [] as NotifyItem[],
    unread: 0,
    open: false,
    loading: false,
    timer: 0 as ReturnType<typeof setTimeout> | undefined,
    es: null as EventSource | null,
    // 实时推送（SSE）是否已断开：面板据此提示"改为定时刷新"
    streamDown: false,
    sseFails: 0,
    sseTimer: 0 as ReturnType<typeof setTimeout> | undefined
  }),
  getters: {
    hasUnread: (s) => s.unread > 0
  },
  actions: {
    async poll() {
      try {
        const r = await notifyApi.unread()
        this.unread = r.count || 0
      } catch { /* 会话过期时静默 */ }
    },
    async openPanel() {
      this.open = !this.open
      if (this.open) await this.refresh()
    },
    close() { this.open = false },
    async refresh() {
      this.loading = true
      try {
        // 未读数必须走专用计数接口：列表上限 50 条，未读超过 50 时按列表重算会把角标数算小
        const [items, u] = await Promise.all([notifyApi.list(50), notifyApi.unread()])
        this.list = items
        this.unread = u.count || 0
      } catch { /* 忽略 */ } finally { this.loading = false }
    },
    async markRead(id: number) {
      const n = this.list.find(x => x.id === id)
      if (!n || n.read) return // 已读项重复点击不应再减未读数
      await notifyApi.read(id)
      n.read = true
      this.unread = Math.max(0, this.unread - 1)
    },
    async markAll() {
      await notifyApi.readAll()
      this.list.forEach(n => { n.read = true })
      this.unread = 0
    },
    // 一键软清除：数据保留在库（管理员可在审计/通知记录查看），本地面板立即清空
    async clear() {
      try { await notifyApi.clear() } catch { return }
      this.list = []
      this.unread = 0
    },
    startPolling() {
      if (this.timer) return
      const appstate = useAppState()
      const start = () => {
        if (this.timer) return
        // 当前用户被禁用 notify（组/个人权限，与后端 AppGate 一致）：不轮询、不开 SSE，
        // 否则会连续收到 403 且 EventSource 报 MIME 错误；权限变更时 watcher 会重新评估
        if (!appstate.isAvailable('notify')) return
        this.poll()
        this.timer = setInterval(() => this.poll(), 30000)
        this.startStream() // SSE 实时推送 + 轮询兜底
      }
      // appstate 异步加载：权限未决时不能按"默认允许"开流（无权限用户会拿到 403）
      if (appstate.loaded) start()
      else if (!permWatcher) permWatcher = watch([() => appstate.loaded, () => appstate.allowed], ([l]) => { if (l) start() })
    },
    stopPolling() {
      if (this.timer) { clearInterval(this.timer); this.timer = 0 }
      this.stopStream()
      // 释放模块级权限 watcher：登出/切换账号后不再持有旧的 appstate 响应式订阅
      if (permWatcher) { permWatcher(); permWatcher = null }
    },
    // SSE：/api/notify/stream（?t= JWT；EventSource 不能自定义请求头）。
    // 连上新通知立即刷新；失败后自行关闭并按指数退避重连，连续 SSE_GIVE_UP 次仍失败
    // （如功能被管理员停用）则放弃，靠 30s 轮询兜底，并把"实时推送已断开"暴露给面板。
    startStream() {
      this.sseFails = 0
      this.streamDown = false
      this.openStream()
    },
    openStream() {
      if (this.es) { this.es.close(); this.es = null }
      const t = getToken()
      if (!t) return
      let es: EventSource
      try { es = new EventSource('/api/notify/stream?t=' + t) } catch { return }
      es.onopen = () => { this.sseFails = 0; this.streamDown = false; this.refresh() }
      es.addEventListener('notify', () => { this.refresh() })
      es.onerror = () => {
        es.close()
        if (this.es === es) this.es = null
        this.sseFails++
        this.streamDown = true
        if (this.sseFails >= SSE_GIVE_UP) return // 放弃重连：轮询兜底
        // 指数退避 1s → 2s → 4s … 上限 60s；轮询已停（登出）则不再重连
        const delay = Math.min(SSE_MAX_DELAY, SSE_BASE_DELAY * 2 ** (this.sseFails - 1))
        if (this.sseTimer) clearTimeout(this.sseTimer)
        this.sseTimer = window.setTimeout(() => { if (this.timer) this.openStream() }, delay)
      }
      this.es = es
    },
    stopStream() {
      if (this.sseTimer) { clearTimeout(this.sseTimer); this.sseTimer = 0 }
      if (this.es) { this.es.close(); this.es = null }
      this.streamDown = false
      this.sseFails = 0
    }
  }
})
