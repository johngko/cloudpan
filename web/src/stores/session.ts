import { defineStore } from 'pinia'
import { authApi, siteApi, adminApi, type User, type UserGroup } from '../api/modules'
import { clearToken } from '../api/http'
import { applyWallpaperEffect } from '../assets/wallpapers'
import type { ThemeId } from '../themes/types'
import { resolveTheme, availableThemes } from '../themes/registry'

const sysDarkMQ = window.matchMedia('(prefers-color-scheme: dark)')
// 存量迁移：旧版只存 cp_dark 布尔（'1'/'0'）；未存过偏好（新用户）默认跟随系统
function initDarkMode(): 'auto' | 'light' | 'dark' {
  const m = localStorage.getItem('cp_dark_mode')
  if (m === 'auto' || m === 'light' || m === 'dark') return m
  const legacy = localStorage.getItem('cp_dark')
  return legacy ? (legacy === '1' ? 'dark' : 'light') : 'auto'
}
function effDark(mode: 'auto' | 'light' | 'dark'): boolean {
  return mode === 'auto' ? sysDarkMQ.matches : mode === 'dark'
}
let sysDarkBound = false

// 主题类挂在 <html> 上：theme-<id> + 可选 dark；CSS token 按此激活
function applyTheme(dark: boolean, osTheme: ThemeId) {
  const el = document.documentElement
  const t = resolveTheme(osTheme)
  for (const x of availableThemes()) el.classList.remove(x.rootClass)
  el.classList.add(t.rootClass)
  el.classList.toggle('dark', dark)
  // 强调色由主题契约注入：应用层只引用 --accent/--accent-weak，切主题即整体换色
  el.style.setProperty('--accent', t.accentColor)
  el.style.setProperty('--accent-weak', t.accentWeak)
}

function validTheme(v: unknown): v is ThemeId {
  return typeof v === 'string' && availableThemes().some(t => t.id === v)
}

export const useSession = defineStore('session', {
  state: () => ({
    user: null as User | null,
    group: null as UserGroup | null,
    // 游客共享账号：系统托管身份（全体访客共用），无账号自管理入口（后端 GuestReadOnly 兜底）
    isGuest: false,
    site: { siteName: 'CloudPan', registerOpen: false, needInviteCode: false, officeConfigured: false, announcement: '', guestLogin: false, theme: 'win12', demoShare: '', wallpaperCatalog: [] as { name: string; url: string }[] },
    wallpaper: localStorage.getItem('cp_wallpaper') || 'win12',
    // 深色偏好三态：auto=跟随系统（新用户默认）；light/dark=手动固定（老用户保留原选择）
    darkMode: initDarkMode() as 'auto' | 'light' | 'dark',
    // dark 是「生效值」：auto 时由系统 prefers-color-scheme 推导，手动时即所选
    dark: effDark(initDarkMode()),
    // 系统主题由站点设置全局决定（管理员设置，所有用户看到同一主题），不再存本机偏好
    osTheme: 'win12' as ThemeId,
    locked: false
  }),
  actions: {
    initTheme() {
      applyTheme(this.dark, this.osTheme)
      applyWallpaperEffect(this.wallpaper) // 外部 URL 壁纸：启动即注入 CSS 变量
      // auto 模式下系统切换深浅色时实时跟随（监听只挂一次）
      if (!sysDarkBound) {
        sysDarkBound = true
        const self = this
        const onChange = () => {
          if (self.darkMode === 'auto') { self.dark = sysDarkMQ.matches; applyTheme(self.dark, self.osTheme) }
        }
        if (sysDarkMQ.addEventListener) sysDarkMQ.addEventListener('change', onChange)
        else sysDarkMQ.addListener(onChange) // Safari <14 兜底
      }
    },
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
      applyWallpaperEffect(w)
    },
    // 快捷开关（任务栏/快速设置）：翻转生效值并固定为手动模式（auto 下点击一次即离开 auto）
    setDark(v: boolean) { this.setDarkMode(v ? 'dark' : 'light') },
    setDarkMode(m: 'auto' | 'light' | 'dark') {
      this.darkMode = m
      this.dark = effDark(m)
      localStorage.setItem('cp_dark_mode', m)
      localStorage.setItem('cp_dark', this.dark ? '1' : '0') // 生效值同步旧键，兼容旧读取点
      applyTheme(this.dark, this.osTheme)
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
