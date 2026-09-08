import { defineStore } from 'pinia'
import { authApi, siteApi, type User, type UserGroup } from '../api/modules'
import type { ThemeId } from '../themes/types'
import { resolveTheme, availableThemes } from '../themes/registry'

// 主题类挂在 <html> 上：theme-<id> + 可选 dark；CSS token 按此激活
function applyTheme(dark: boolean, osTheme: ThemeId) {
  const el = document.documentElement
  for (const t of availableThemes()) el.classList.remove(t.rootClass)
  el.classList.add(resolveTheme(osTheme).rootClass)
  el.classList.toggle('dark', dark)
}

function readTheme(): ThemeId {
  const v = (localStorage.getItem('cp_theme') || 'win12') as ThemeId
  return (v && availableThemes().some(t => t.id === v)) ? v : 'win12'
}

export const useSession = defineStore('session', {
  state: () => ({
    user: null as User | null,
    group: null as UserGroup | null,
    site: { siteName: 'CloudPan', registerOpen: false, needInviteCode: false, officeConfigured: false, announcement: '' },
    wallpaper: localStorage.getItem('cp_wallpaper') || 'win12',
    dark: localStorage.getItem('cp_dark') === '1',
    osTheme: readTheme(),
    locked: false
  }),
  actions: {
    initTheme() { applyTheme(this.dark, this.osTheme) },
    async loadSite() {
      try { this.site = await siteApi.publicInfo() } catch { /* offline */ }
    },
    async loadMe() {
      const d = await authApi.me()
      this.user = d.user
      this.group = d.group
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
    // 切换系统主题；当前壁纸若不属于新主题则回落到新主题默认壁纸
    setOsTheme(id: ThemeId) {
      const t = resolveTheme(id)
      this.osTheme = id
      localStorage.setItem('cp_theme', id)
      if (!t.wallpapers.some(w => w.key === this.wallpaper)) this.setWallpaper(t.defaultWallpaper)
      applyTheme(this.dark, id)
    },
    logout() {
      localStorage.removeItem('cp_token')
      this.user = null
      this.locked = false
      location.hash = '#/login'
    }
  }
})
