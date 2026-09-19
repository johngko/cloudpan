import type { ThemeDef } from '../types'
import './deepin.css'
import DeepinBoot from './DeepinBoot.vue'
import DeepinLogin from './DeepinLogin.vue'
import DeepinRegister from './DeepinRegister.vue'
import DeepinLock from './DeepinLock.vue'
import DeepinDesktop from './DeepinDesktop.vue'
import DeepinWindowFrame from './DeepinWindowFrame.vue'
import { WALLPAPERS } from './wallpapers'

// 注意：geometry 与 deepin.css 中 .theme-deepin 的 --shell-* 变量保持一致
const theme: ThemeDef = {
  id: 'deepin',
  name: 'Deepin',
  icon: 'cloud',
  rootClass: 'theme-deepin',
  Boot: DeepinBoot,
  Login: DeepinLogin,
  Register: DeepinRegister,
  Lock: DeepinLock,
  Desktop: DeepinDesktop,
  WindowFrame: DeepinWindowFrame,
  // DDE 25 布局：无顶部面板，底部全宽 48px 任务栏（dock 即任务栏）
  geometry: { top: 0, bottom: 48, left: 0, right: 0 },
  caption: 'right',
  snapEdges: true,
  wallpapers: WALLPAPERS,
  defaultWallpaper: 'ph-lake'
}

export default theme
