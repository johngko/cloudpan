import { defineStore } from 'pinia'
import { appsApi, settingsApi } from '../api/modules'

// 系统功能启用状态（应用中心门控的数据源）
// 未加载完成前一律视为启用，避免启动时入口闪烁
export const useAppState = defineStore('appstate', {
  state: () => ({
    enabled: {} as Record<string, boolean>,
    loaded: false,
    // 用户自装的应用 id 列表（可安装应用；存用户设置 KV）
    installed: [] as string[]
  }),
  actions: {
    async load() {
      try {
        const list = await appsApi.list()
        const m: Record<string, boolean> = {}
        for (const a of list) m[a.key] = a.enabled
        this.enabled = m
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
    isOn: (s) => (key: string) => (s.loaded ? s.enabled[key] !== false : true)
  }
})
