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
const APP_COMPONENTS: Record<string, Component> = {
  explorer: defineAsyncComponent(() => import('../apps/Explorer.vue')),
  thispc: defineAsyncComponent(() => import('../apps/Explorer.vue')),
  recycle: defineAsyncComponent(() => import('../apps/RecycleBin.vue')),
  notepad: defineAsyncComponent(() => import('../apps/Notepad.vue')),
  terminal: defineAsyncComponent(() => import('../apps/Terminal.vue')),
  calculator: defineAsyncComponent(() => import('../apps/Calculator.vue')),
  speedtest: defineAsyncComponent(() => import('../apps/SpeedTest.vue')),
  browser: defineAsyncComponent(() => import('../apps/Browser.vue')),
  imageviewer: defineAsyncComponent(() => import('../apps/ImageViewer.vue')),
  mediaviewer: defineAsyncComponent(() => import('../apps/MediaViewer.vue')),
  mediacenter: defineAsyncComponent(() => import('../apps/MediaCenter.vue')),
  officeeditor: defineAsyncComponent(() => import('../apps/OfficeEditor.vue')),
  shared: defineAsyncComponent(() => import('../apps/SharedBrowser.vue')),
  appcenter: defineAsyncComponent(() => import('../apps/AppCenter.vue')),
  settings: defineAsyncComponent(() => import('../apps/SettingsApp.vue')),
  admin: defineAsyncComponent(() => import('../apps/AdminConsole.vue'))
}

export function appComponent(id: string): Component {
  return APP_COMPONENTS[id] || APP_COMPONENTS.notepad!
}
