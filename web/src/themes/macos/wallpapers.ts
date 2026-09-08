import type { WallpaperDef } from '../types'

// 壁纸：照片（Unsplash 免费授权，见 public/wallpapers/）+ CSS 渐变（macOS 各版本风格，类名 wp-<key> 定义于 mac.css）
export const WALLPAPERS: WallpaperDef[] = [
  { key: 'ph-yosemite', name: '优胜美地' },
  { key: 'ph-field', name: '原野' },
  { key: 'ph-forest', name: '森林' },
  { key: 'ph-starry', name: '星空' },
  { key: 'sonoma', name: 'Sonoma' },
  { key: 'sequoia', name: 'Sequoia' },
  { key: 'ventura', name: 'Ventura' },
  { key: 'monterey', name: 'Monterey' },
  { key: 'bigsur', name: 'Big Sur' }
]
