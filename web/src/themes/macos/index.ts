import type { ThemeDef } from '../types'
import './mac.css'
import MacBoot from './MacBoot.vue'
import MacLogin from './MacLogin.vue'
import MacRegister from './MacRegister.vue'
import MacLock from './MacLock.vue'
import MacDesktop from './MacDesktop.vue'
import MacWindowFrame from './MacWindowFrame.vue'
import { WALLPAPERS } from './wallpapers'

// 注意：geometry 与 mac.css 中 .theme-macos 的 --shell-* 变量保持一致
const theme: ThemeDef = {
  id: 'macos',
  name: 'macOS',
  icon: 'cloud',
  rootClass: 'theme-macos',
  Boot: MacBoot,
  Login: MacLogin,
  Register: MacRegister,
  Lock: MacLock,
  Desktop: MacDesktop,
  WindowFrame: MacWindowFrame,
  geometry: { top: 24, bottom: 78, left: 0, right: 0 },
  caption: 'left',
  snapEdges: false,
  wallpapers: WALLPAPERS,
  defaultWallpaper: 'ph-yosemite'
}

export default theme
