import type { ThemeDef } from '../types'
import './win.css'
import WinBoot from './WinBoot.vue'
import WinLogin from './WinLogin.vue'
import WinRegister from './WinRegister.vue'
import WinLock from './WinLock.vue'
import WinDesktop from './WinDesktop.vue'
import WinWindowFrame from './WinWindowFrame.vue'
import { WALLPAPERS } from './wallpapers'

  // 注意：geometry 与 win.css 中 .theme-win12 的 --shell-* 变量保持一致
  // （底部 10px 浮动 dock 高 40px → 保留区 50px）
  const theme: ThemeDef = {
    id: 'win12',
    name: 'Windows 12',
    icon: 'windows',
    rootClass: 'theme-win12',
    Boot: WinBoot,
    Login: WinLogin,
    Register: WinRegister,
    Lock: WinLock,
    Desktop: WinDesktop,
    WindowFrame: WinWindowFrame,
    geometry: { top: 0, bottom: 50, left: 0, right: 0 },
  caption: 'right',
  snapEdges: true,
  wallpapers: WALLPAPERS,
  defaultWallpaper: 'ph-alpine'
}

export default theme
