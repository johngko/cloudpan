import { defineAsyncComponent, type Component } from 'vue'
import type { ThemeDef, ThemeId } from './types'
import win12 from './windows'
import macos from './macos'
import deepin from './deepin'

// 主题包注册表：新增主题 = 新建 themes/<id>/ 目录 + 在此登记
export const THEMES: Partial<Record<ThemeId, ThemeDef>> = {
  win12,
  macos,
  deepin
}

export function availableThemes(): ThemeDef[] {
  return Object.values(THEMES)
}

/** 按 id 解析主题；未知 id 回落 win12（默认主题永远存在） */
export function resolveTheme(id?: string | null): ThemeDef {
  return (id && THEMES[id as ThemeId]) || THEMES.win12!
}

// ---- 应用组件注册表（统一入口，各主题窗口框架共用）----

// 懒加载应用组件；构建升级后旧页面的缓存 chunk 会 404，此时自动刷新一次以加载新资源，
// 避免用户看到空白窗口 / 旧功能（如升级前的伪终端）
const STALE_KEY = 'cp_chunk_stale'
function asyncApp(loader: () => Promise<any>): Component {
  return defineAsyncComponent({
    loader,
    onError(err, retry, fail, attempts) {
      if (attempts <= 1 && !sessionStorage.getItem(STALE_KEY)) {
        sessionStorage.setItem(STALE_KEY, '1')
        setTimeout(() => location.reload(), 300)
        return
      }
      if (attempts <= 2) { retry(); return }
      fail()
    }
  })
}

const APP_COMPONENTS: Record<string, Component> = {
  explorer: asyncApp(() => import('../apps/Explorer.vue')),
  thispc: asyncApp(() => import('../apps/Explorer.vue')),
  recycle: asyncApp(() => import('../apps/RecycleBin.vue')),
  notepad: asyncApp(() => import('../apps/Notepad.vue')),
  terminal: asyncApp(() => import('../apps/Terminal.vue')),
  calculator: asyncApp(() => import('../apps/Calculator.vue')),
  speedtest: asyncApp(() => import('../apps/SpeedTest.vue')),
  browser: asyncApp(() => import('../apps/Browser.vue')),
  imageviewer: asyncApp(() => import('../apps/ImageViewer.vue')),
  mediaviewer: asyncApp(() => import('../apps/MediaViewer.vue')),
  mediacenter: asyncApp(() => import('../apps/MediaCenter.vue')),
  officeeditor: asyncApp(() => import('../apps/OfficeEditor.vue')),
  shared: asyncApp(() => import('../apps/SharedBrowser.vue')),
  appcenter: asyncApp(() => import('../apps/AppCenter.vue')),
  settings: asyncApp(() => import('../apps/SettingsApp.vue')),
  admin: asyncApp(() => import('../apps/AdminConsole.vue'))
}

export function appComponent(id: string): Component {
  return APP_COMPONENTS[id] || APP_COMPONENTS.notepad!
}
