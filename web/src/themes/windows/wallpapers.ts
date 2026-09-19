import type { WallpaperDef } from '../types'

// 壁纸：照片（Unsplash 免费授权，见 public/wallpapers/）+ 渐变/SVG（类名 wp-<key> 定义于 base.css / win.css）
export const WALLPAPERS: WallpaperDef[] = [
  { key: 'ph-alpine', name: '雪山' },
  { key: 'ph-mist', name: '晨雾' },
  { key: 'ph-valley', name: '山谷' },
  { key: 'ph-coast', name: '海岸' },
  { key: 'win12', name: 'Concept 12' },
  { key: 'bloom', name: '初始之花' },
  { key: 'aurora', name: '极光' },
  { key: 'midnight', name: '午夜' },
  { key: 'sunset', name: '黄昏' },
  { key: 'mint', name: '薄荷' }
]
