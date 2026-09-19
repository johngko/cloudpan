import type { Component } from 'vue'

export type ThemeId = 'win12' | 'macos' | 'deepin'

export interface WallpaperDef {
  key: string
  name: string
}

/** 主题在屏幕四周保留的像素区域（菜单栏/任务栏/Dock），窗口最大化与初始定位以此为界。
 *  各主题 CSS 中的 --shell-top/bottom/left/right 变量须与此保持一致。 */
export interface ThemeGeometry {
  top: number
  bottom: number
  left: number
  right: number
}

export interface ThemeDef {
  id: ThemeId
  name: string
  icon: string // AppIcon 名称
  /** 挂到 <html> 上的主题类 */
  rootClass: string
  // 一整套外壳组件（结构随主题完全不同，全部由现有 Pinia stores 驱动）
  Boot: Component
  Login: Component
  Register: Component
  Lock: Component
  Desktop: Component
  WindowFrame: Component
  geometry: ThemeGeometry
  /** 窗口标题栏控制按钮位置：macOS=left（红绿灯），Windows/Deepin=right */
  caption: 'left' | 'right'
  /** 是否支持贴边分屏（Windows/Deepin 有，macOS 用 zoom 语义） */
  snapEdges: boolean
  wallpapers: WallpaperDef[]
  defaultWallpaper: string
}
