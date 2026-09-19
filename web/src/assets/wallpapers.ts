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

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const x of bytes) bin += String.fromCharCode(x)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// 外部壁纸统一走同源代理 /api/fs/wallpaper?p=<b64url(url)>：
// 顶层文档 CSP img-src 只有 'self' data: blob:（放宽 https: 会让恶意 .md/office
// 文件的 <img> 成为像素外传通道），代理端做 SSRF 段检查 + 20MB 上限
// （server/internal/handler/wallpaper.go）。未登录（登录页）时无 token，
// 代理 401 → 背景回落到渐变底图，与既往行为一致。
// 同源地址（管理员壁纸目录里可能配 /vendor/… 相对路径）不经代理，直接引用。
export function wallpaperProxyUrl(u: string): string {
  if (!/^https?:\/\//i.test(u)) return u
  const t = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cp_token') : ''
  return '/api/fs/wallpaper?p=' + b64url(u) + (t ? '&t=' + encodeURIComponent(t) : '')
}

// 应用外部壁纸的 CSS 变量（登录页/桌面/锁屏等挂载点都会用到，启动时与切换时各调一次）
export function applyWallpaperEffect(key: string) {
  if (key && key.startsWith('ext:')) {
    const url = key.slice(4)
    if (url) document.documentElement.style.setProperty('--wp-ext-url', `url("${wallpaperProxyUrl(url)}")`)
  }
}
