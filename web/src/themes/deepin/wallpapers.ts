import type { WallpaperDef } from '../types'

// 壁纸：照片（Unsplash 免费授权，见 public/wallpapers/）+ CSS 渐变（DDE 风格，类名 wp-<key> 定义于 deepin.css）
export const WALLPAPERS: WallpaperDef[] = [
  { key: 'ph-lake', name: '山湖' },
  { key: 'ph-sea', name: '海面' },
  { key: 'ph-peak', name: '群峰' },
  { key: 'ph-wave', name: '海滩' },
  { key: 'dde-blue', name: '深海' },
  { key: 'dde-dawn', name: '晨曦' },
  { key: 'dde-night', name: '星夜' },
  { key: 'dde-mint', name: '青野' },
  { key: 'dde-rose', name: '蔷薇' }
]
