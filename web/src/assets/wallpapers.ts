export interface WallpaperDef { key: string; name: string }

export const WALLPAPERS: WallpaperDef[] = [
  { key: 'win12', name: 'Concept 12' },
  { key: 'bloom', name: '初始之花' },
  { key: 'aurora', name: '极光' },
  { key: 'midnight', name: '午夜' },
  { key: 'sunset', name: '黄昏' },
  { key: 'mint', name: '薄荷' }
]

// 壁纸以 CSS 渐变实现（无版权风险），类名 wp-<key> 定义于 styles.css
export function wallpaperClass(key: string): string {
  return 'wp-' + (key || 'win12')
}
