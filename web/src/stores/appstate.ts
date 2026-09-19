import { defineStore } from 'pinia'
import { appsApi, settingsApi } from '../api/modules'
import { useSession } from './session'

// 系统功能启用状态（应用中心门控的数据源）
// 未加载完成前一律视为禁用：宁可桌面图标晚 100ms 出现，也不能让访客在
// /apps 返回的瞬间看到无权限的图标（权限竞态，刷新桌面时闪现管理台入口）
export const useAppState = defineStore('appstate', {
  state: () => ({
    enabled: {} as Record<string, boolean>,
    // 当前用户的功能权限（组/个人权限解析后；未加载前视为允许，避免入口闪烁）
    allowed: {} as Record<string, boolean>,
    loaded: false,
    // 用户自装的应用 id 列表（可安装应用；存用户设置 KV）
    installed: [] as string[],
    // 自装应用清单是否已拉取（boot.ts 的就绪门据此判断，避免误判"装了但还没拉到"）
    installedLoaded: false
  }),
  actions: {
    // 返回 false = 401（令牌失效且续期失败）：保持"未决"且不回落全允许，
    // 调用方（boot 就绪门）据此踢回登录页，避免登出瞬间闪现全量功能入口
    async load(): Promise<boolean> {
      // 重新拉取前先回落到"未决"：登录/切账号后必须重拉 /apps（allowed 与身份相关），
      // 若不回落，旧的空 allowed 会让访客在两次响应之间再次看到全量图标
      this.loaded = false
      try {
        const list = await appsApi.list()
        const m: Record<string, boolean> = {}
        const am: Record<string, boolean> = {}
        for (const a of list) { m[a.key] = a.enabled; am[a.key] = a.allowed }
        this.enabled = m
        this.allowed = am
        this.loaded = true
        return true
      } catch (e: any) {
        if (e && e.response && e.response.status === 401) return false
        // 网络故障/离线：标记为已决并回退默认全允许，保证离线时桌面入口不空白；
        // 后端 AppGate 仍逐请求鉴权，前端仅影响入口显隐
        this.loaded = true
        return true
      }
    },
    set(key: string, on: boolean) {
      // 必须整体替换对象：桌面/Dock/开始菜单入口以 watch(() => apps.enabled)
      // 引用比较驱动响应式增删，原地改属性不会触发
      this.enabled = { ...this.enabled, [key]: on }
      this.loaded = true
    },
    async loadInstalled() {
      try {
        const m = await settingsApi.get(['installed_apps'])
        const v = m['installed_apps']
        // 必须无条件覆盖：KV 为空（新用户/未装过）也要清空列表，
        // 否则同页切换账号时会沿用上一账号的安装态（图标越权显示）
        const arr = v ? JSON.parse(v) : []
        this.installed = Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
      } catch { /* 忽略 */ } finally { this.installedLoaded = true }
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
    // 未加载完成前一律 false（不渲染），加载失败时 loaded=true + 空表 → 全允许（离线兜底）
    isOn: (s) => (key: string) => (s.loaded ? s.enabled[key] !== false : false),
    // 当前用户是否有权使用该功能（组/个人权限）
    isAllowed: (s) => (key: string) => (s.loaded ? s.allowed[key] !== false : false),
    // 入口可见性/可用性 = 全局启用 且 当前用户有权；
    // 管理员不受约束（与后端 AppAllowed 一致：所有应用对管理员可见可用）
    isAvailable: (s) => (key: string) => {
      if (!s.loaded) return false
      if (useSession().user?.role === 'admin') return true
      return s.isOn(key) && s.isAllowed(key)
    }
  }
})
