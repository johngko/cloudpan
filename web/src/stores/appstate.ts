import { defineStore } from 'pinia'
import { appsApi, settingsApi } from '../api/modules'

// 系统功能启用状态（应用中心门控的数据源）
// 未加载完成前一律视为启用，避免启动时入口闪烁
export const useAppState = defineStore('appstate', {
  state: () => ({
    enabled: {} as Record<string, boolean>,
    // 当前用户的功能权限（组/个人权限解析后；未加载前视为允许，避免入口闪烁）
    allowed: {} as Record<string, boolean>,
    loaded: false,
    // 用户自装的应用 id 列表（可安装应用；存用户设置 KV）
    installed: [] as string[]
  }),
  actions: {
    async load() {
      try {
        const list = await appsApi.list()
        const m: Record<string, boolean> = {}
        const am: Record<string, boolean> = {}
        for (const a of list) { m[a.key] = a.enabled; am[a.key] = a.allowed }
        this.enabled = m
        this.allowed = am
        this.loaded = true
      } catch { /* 离线或功能被停用时忽略 */ }
    },
    set(key: string, on: boolean) {
      this.enabled[key] = on
      this.loaded = true
    },
    async loadInstalled() {
      try {
        const m = await settingsApi.get(['installed_apps'])
        const v = m['installed_apps']
        if (v) {
          const arr = JSON.parse(v)
          if (Array.isArray(arr)) this.installed = arr.filter(x => typeof x === 'string')
        }
      } catch { /* 忽略 */ }
    },
    setInstalled(id: string, on: boolean) {
      const s = new Set(this.installed)
      if (on) s.add(id); else s.delete(id)
      this.installed = [...s]
      // 持久化（fire-and-forget；失败时 UI 状态仍有效，下次加载回退服务端值）
      settingsApi.set('installed_apps', JSON.stringify(this.installed)).catch(() => {})
    },
    isInstalled(id: string) {
      return this.installed.includes(id)
    }
  },
  getters: {
    isOn: (s) => (key: string) => (s.loaded ? s.enabled[key] !== false : true),
    // 当前用户是否有权使用该功能（组/个人权限；未加载前视为允许）
    isAllowed: (s) => (key: string) => (s.loaded ? s.allowed[key] !== false : true),
    // 入口可见性 = 全局启用 且 当前用户有权
    isAvailable: (s) => (key: string) => (s.isOn(key) && s.isAllowed(key))
  }
})
