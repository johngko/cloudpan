export interface WallpaperDef { key: string; name: string }

export const WALLPAPERS: WallpaperDef[] = [
  { key: 'win12', name: 'Concept 12' },
  { key: 'bloom', name: '初始之花' },
  { key: 'aurora', name: '极光' },
  { key: 'midnight', name: '午夜' },
  { key: 'sunset', name: '黄昏' },
  { key: 'mint', name: '薄荷' }
]

// 壁纸以 CSS 渐变实现（无版权风险），类名 wp-<key> 定义于 styles.css；
// 外部 URL 壁纸以 ext:<url> 形式存储，统一渲染为 .wp-ext（背景图走 CSS 变量 --wp-ext-url）
export function wallpaperClass(key: string): string {
  if (!key) return 'wp-win12'
  if (key.startsWith('ext:')) return 'wp-ext'
  return 'wp-' + key
}

// 应用外部壁纸的 CSS 变量（登录页/桌面/锁屏等挂载点都会用到，启动时与切换时各调一次）
export function applyWallpaperEffect(key: string) {
  if (key && key.startsWith('ext:')) {
    const url = key.slice(4)
    if (url) document.documentElement.style.setProperty('--wp-ext-url', `url("${url}")`)
  }
}
