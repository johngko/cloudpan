import { defineStore } from 'pinia'
import { authApi, siteApi, adminApi, type User, type UserGroup } from '../api/modules'
import { clearToken } from '../api/http'
import type { ThemeId } from '../themes/types'
import { resolveTheme, availableThemes } from '../themes/registry'

// 主题类挂在 <html> 上：theme-<id> + 可选 dark；CSS token 按此激活
function applyTheme(dark: boolean, osTheme: ThemeId) {
  const el = document.documentElement
  for (const t of availableThemes()) el.classList.remove(t.rootClass)
  el.classList.add(resolveTheme(osTheme).rootClass)
  el.classList.toggle('dark', dark)
}

function validTheme(v: any): v is ThemeId {
  return !!v && availableThemes().some(t => t.id === v)
}

export const useSession = defineStore('session', {
  state: () => ({
    user: null as User | null,
    group: null as UserGroup | null,
    // 游客共享账号：系统托管身份（全体访客共用），无账号自管理入口（后端 GuestReadOnly 兜底）
    isGuest: false,
    site: { siteName: 'CloudPan', registerOpen: false, needInviteCode: false, officeConfigured: false, announcement: '', guestLogin: false, theme: 'win12', demoShare: '' },
    wallpaper: localStorage.getItem('cp_wallpaper') || 'win12',
    dark: localStorage.getItem('cp_dark') === '1',
    // 系统主题由站点设置全局决定（管理员设置，所有用户看到同一主题），不再存本机偏好
    osTheme: 'win12' as ThemeId,
    locked: false
  }),
  actions: {
    initTheme() { applyTheme(this.dark, this.osTheme) },
    async loadSite() {
      try {
        this.site = await siteApi.publicInfo()
        // 同步站点主题：登录页/桌面等挂载时拉到管理员设置即切换（含壁纸回落）
        const t = this.site.theme
        if (validTheme(t) && t !== this.osTheme) this.applyOsTheme(t)
      } catch { /* offline */ }
    },
    async loadMe() {
      const d = await authApi.me()
      this.user = d.user
      this.group = d.group
      this.isGuest = !!d.isGuest
      return d
    },
    setWallpaper(w: string) {
      this.wallpaper = w
      localStorage.setItem('cp_wallpaper', w)
    },
    setDark(v: boolean) {
      this.dark = v
      localStorage.setItem('cp_dark', v ? '1' : '0')
      applyTheme(v, this.osTheme)
    },
    // 应用主题（不持久化——主题以站点设置为准）；当前壁纸若不属于新主题则回落到新主题默认壁纸
    applyOsTheme(id: ThemeId) {
      const t = resolveTheme(id)
      this.osTheme = id
      if (!t.wallpapers.some(w => w.key === this.wallpaper)) this.setWallpaper(t.defaultWallpaper)
      applyTheme(this.dark, id)
    },
    // 管理员切换站点主题：写入站点设置，对全体用户（游客/普通/管理员）生效
    async setOsTheme(id: ThemeId) {
      await adminApi.settingsSet({ site_theme: id })
      this.site.theme = id
      this.applyOsTheme(id)
    },
    logout() {
      clearToken()
      this.user = null
      this.locked = false
      location.hash = '#/login'
    }
  }
})
