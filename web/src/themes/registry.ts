import { defineAsyncComponent, defineComponent, h, type Component } from 'vue'
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

// v9os 商店 webapp 通用容器：静态应用自包含于 /webapps/<code>/，桥接层共享
//（web/public/webapps/_bridge/cloudpan.js ↔ web/src/webapp/bridge.ts），移植新应用只需
// 放静态资源 + 这里登记一行（方案见 docs/DOCS-v9os应用移植.md）
function webappLoader(code: string): () => Promise<any> {
  return async () => {
    const mod = await import('../apps/WebAppHost.vue')
    const Host: any = mod.default
    // 注意：defineAsyncComponent 只解包「真 ESM 模块」的 default（__esModule 或
    // Symbol.toStringTag==='Module'），普通 {default: comp} 对象会被当成组件选项
    // 静默渲染空窗口——这里直接返回组件本体
    return defineComponent({
      name: `WebApp_${code}`,
      props: ['winId', 'props'],
      setup(p: any) { return () => h(Host, { winId: p.winId, props: p.props, webapp: code }) }
    })
  }
}

// 加载器表与组件表分离：preloadApps 直接触发 import() 预热 chunk（模块缓存去重），
// 消除「首次打开某应用要等网络拉 chunk」的卡顿——桌面就绪后空闲预热，打开即出画面
const APP_LOADERS: Record<string, () => Promise<any>> = {
  explorer: () => import('../apps/Explorer.vue'),
  thispc: () => import('../apps/Explorer.vue'),
  recycle: () => import('../apps/RecycleBin.vue'),
  notepad: () => import('../apps/Notepad.vue'),
  terminal: () => import('../apps/Terminal.vue'),
  calculator: () => import('../apps/Calculator.vue'),
  speedtest: () => import('../apps/SpeedTest.vue'),
  browser: () => import('../apps/Browser.vue'),
  // imageviewer 已下线：图片打开统一走 picasa（webappLoader）；ImageViewer.vue 保留作回退参照
  mediaviewer: () => import('../apps/MediaViewer.vue'),
  mediacenter: () => import('../apps/MediaCenter.vue'),
  tasks: () => import('../apps/TaskCenter.vue'),
  wallpapers: () => import('../apps/WallpaperCenter.vue'),
  photos: () => import('../apps/Photos.vue'),
  officeeditor: () => import('../apps/OfficeEditor.vue'),
  archiveviewer: () => import('../apps/ArchiveViewer.vue'),
  mindmap: () => import('../apps/MindMap.vue'),
  whiteboard: () => import('../apps/Whiteboard.vue'),
  flowchart: () => import('../apps/Flowchart.vue'),
  // v9os 商店移植 webapps：批次 0（music/picasa），批次 1（pdfjs 替换旧 PDF 阅读器、
  // tui_image 替换旧图片编辑器——旧 Vue 组件保留作回退参照，不再被注册表引用）
  musicplayer: webappLoader('music'),
  picasa: webappLoader('picasa'),
  pdfreader: webappLoader('pdfjs'),
  imageeditor: webappLoader('tui_image'),
  // 批次 2：epub 阅读器 / ace 多功能编辑器（替换记事本的代码场景，记事本保留）/
  // svg 编辑器 / EML 查看器
  epubreader: webappLoader('epub'),
  codeeditor: webappLoader('ace'),
  svgeditor: webappLoader('svg_editor'),
  emlviewer: webappLoader('eml_viewer'),
  // 批次 3：在线PS（photopea，完整 vendored）。birdpaper（小鸟壁纸）已下线，见 stores/apps.ts
  photopea: webappLoader('photopea'),
  cadviewer: webappLoader('cad'),
  shared: () => import('../apps/SharedBrowser.vue'),
  myshares: () => import('../apps/ShareCenter.vue'),
  appcenter: () => import('../apps/AppCenter.vue'),
  settings: () => import('../apps/SettingsApp.vue'),
  admin: () => import('../apps/AdminConsole.vue')
}

const APP_COMPONENTS: Record<string, Component> = {}
for (const [k, loader] of Object.entries(APP_LOADERS)) APP_COMPONENTS[k] = asyncApp(loader)

export function appComponent(id: string): Component {
  return APP_COMPONENTS[id] || APP_COMPONENTS.notepad!
}

// 空闲预热全部应用 chunk：桌面进入后错峰触发（每个间隔 200ms，避免并发挤占带宽）；
// import() 走模块缓存，重复调用零成本，幂等
let preloading = false
export function preloadApps() {
  if (preloading) return
  preloading = true
  const ids = Object.keys(APP_LOADERS)
  const start = () => {
    ids.forEach((id, i) => {
      window.setTimeout(() => { APP_LOADERS[id]().catch(() => { /* 预热失败不影响功能，首开仍会重试 */ }) }, 300 + i * 200)
    })
  }
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(start, { timeout: 4000 })
  else window.setTimeout(start, 1200)
}
