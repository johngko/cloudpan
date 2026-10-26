// 全局搜索逻辑（从 themes/windows/WinSearchWin.vue 原样抽出，供三套主题共用）
//
// 只搬逻辑、不动外观：
//   - win12：WinSearchWin.vue 继续用 w12-* 模板与 win.css，仅改为调用本 composable；
//   - mac/deepin：shell/GlobalSearchPanel.vue 用主题中立外观渲染同一份逻辑。
// 图标解析、模板结构都留在各自组件里（win12 用位图 <img>，其余主题用 AppIcon），
// 因此本文件不含任何外观相关代码。
import { ref, computed, watch, onMounted, nextTick, type Ref } from 'vue'
import { visibleApps, canUseOffline } from '../stores/apps'
import { useWindows } from '../stores/windows'
import { useSession } from '../stores/session'
import { fsApi } from '../api/modules'
import { copyText } from '../utils/clipboard'
import type { SearchHit } from '../api/modules'

/** 搜索/浏览得到的文件条目：就是后端的全局搜索命中，直接用它的类型（唯一一份定义） */
export type SearchFile = SearchHit

/** 当前选中项：文件或应用（item 不细分，模板里按 kind 分支取值） */
export interface SearchSel { kind: 'file' | 'app'; item: any; idx: number }

export interface GlobalSearchHandlers {
  /** 搜索框元素（组件模板 ref 传入），面板打开时自动聚焦 */
  inputEl?: Ref<HTMLInputElement | undefined>
  /** 打开结果 / 跳转设置 / 打开网页后，请求父组件收起面板 */
  onClose?: () => void
}

const TABS = ['全部', '应用', '文档', '网页', '设置', '文件夹', '照片']
// 文件类页签（无关键字时展示各盘顶层首屏，有关键词时展示搜索命中）
const FILE_TABS = new Set(['全部', '文档', '文件夹', '照片'])
const DOC_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md', 'csv', 'rtf', 'wps', 'epub', 'mobi', 'log', 'json', 'xml']
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'tif', 'tiff', 'avif']

// 设置页深链（与 SettingsApp 侧边栏一致）
export const SETTINGS_AREAS = [
  { id: 'person', name: '个性化', icon: 'sun', kws: ['主题', '壁纸', '深色', '外观', '个性化'] },
  { id: 'account', name: '账号', icon: 'user', kws: ['账号', '账户', '密码', '昵称', 'webdav'] },
  { id: 'shares', name: '我的分享', icon: 'share', kws: ['分享', '外链'] },
  { id: 'offline', name: '离线下载', icon: 'download', kws: ['离线', '下载', '磁力', '种子'] },
  { id: 'about', name: '关于', icon: 'info', kws: ['关于', '版本'] }
]

export function useGlobalSearch(handlers: GlobalSearchHandlers = {}) {
  const store = useWindows()
  const session = useSession()

  const kw = ref('')
  const tab = ref('全部')
  const tabs = TABS
  const fileHits = ref<SearchFile[]>([])
  // 无关键字浏览：各盘顶层首屏（后端 kind=browse），开面板时预取一次，页签切换仅客户端过滤
  const recentHits = ref<SearchFile[]>([])
  const recentLoading = ref(false)
  let recentSeq = 0
  // 初始即全量应用：watch(q) 只在 q 变化时触发，挂载时不触发——否则无关键字态应用区恒空
  const appHits = ref<any[]>(visibleApps())
  const searching = ref(false)
  const sel = ref<SearchSel | null>(null)
  // 搜索框元素由组件传入（模板 ref），不在此自建
  const inputEl = handlers.inputEl
  let t: any

  const q = computed(() => kw.value.trim().toLowerCase())
  const isFileTab = computed(() => FILE_TABS.has(tab.value))

  // 有关键词=搜索命中；无关键字=浏览源（各盘顶层首屏），按当前页签过滤
  const shownFiles = computed(() => {
    const src = q.value ? fileHits.value : recentHits.value
    if (!src.length) return []
    if (tab.value === '文档') return src.filter(f => DOC_EXTS.includes((f.ext || '').toLowerCase()))
    if (tab.value === '照片') return src.filter(f => IMG_EXTS.includes((f.ext || '').toLowerCase()))
    if (tab.value === '文件夹') return src.filter(f => f.isDir)
    return src
  })

  // 个性化（站点主题）为管理员全局设置：非管理员（含游客）搜不到该设置区；
  // 离线下载对无权限用户（含游客）整体隐藏
  const canOffline = computed(() => canUseOffline())
  const settingsAreas = computed(() => {
    let areas = session.user?.role === 'admin' ? SETTINGS_AREAS : SETTINGS_AREAS.filter(s => s.id !== 'person')
    if (!canOffline.value) areas = areas.filter(s => s.id !== 'offline')
    return areas
  })
  const settingsHits = computed(() => {
    const v = q.value
    const areas = settingsAreas.value
    if (!v) return areas
    return areas.filter(s => s.name.toLowerCase().includes(v) || s.kws.some(k => k.includes(v)))
  })

  // 无关键字=列出全部应用（Win11「应用」页签语义），有关键词=按名/id 过滤
  function searchApps(v: string) {
    appHits.value = v ? visibleApps().filter(a => a.name.toLowerCase().includes(v) || a.id.includes(v)) : visibleApps()
  }

  // 无关键字浏览源：各盘顶层首屏（深度≤3），一次预取后各文件页签客户端过滤
  function loadRecent() {
    if (recentHits.value.length || recentLoading.value) return
    recentLoading.value = true
    const seq = ++recentSeq
    fsApi.globalSearch('', 'browse').then((r: any[]) => {
      if (seq !== recentSeq) return
      recentHits.value = (r || []).slice(0, 60)
      // 浏览态也给出右侧详情（与搜索态一致：默认选中第一项）；用户已手动选中则不覆盖
      if (!kw.value.trim() && FILE_TABS.has(tab.value) && recentHits.value.length && !sel.value) {
        const first = shownFiles.value[0] || recentHits.value[0]
        sel.value = { kind: 'file', item: first, idx: shownFiles.value.indexOf(first) }
      }
    }).catch(() => { if (seq === recentSeq) recentHits.value = [] })
      .finally(() => { if (seq === recentSeq) recentLoading.value = false })
  }

  watch(q, v => {
    searchApps(v)
    if (v && isFileTab.value && !searching.value && !fileHits.value.length) onInput()
    else if (!v && isFileTab.value) loadRecent()
  })

  // 切换页签：有关键词且还没搜过则补搜；无关键字则确保浏览源就绪并让详情跟随新页签
  watch(tab, () => {
    const v = kw.value.trim()
    if (!v) {
      if (FILE_TABS.has(tab.value)) {
        loadRecent()
        const first = shownFiles.value[0]
        sel.value = first ? { kind: 'file', item: first, idx: 0 } : null
      }
      return
    }
    sel.value = null
    if (FILE_TABS.has(tab.value) && !searching.value && !fileHits.value.length) onInput()
  })

  function onInput() {
    clearTimeout(t)
    const v = kw.value.trim()
    sel.value = null
    searchApps(v)
    if (!v) { fileHits.value = []; searching.value = false; return }
    if (!isFileTab.value) { fileHits.value = []; return }
    searching.value = true
    t = setTimeout(async () => {
      try {
        const r = await fsApi.globalSearch(v)
        fileHits.value = (r || []).slice(0, 30)
        if (fileHits.value.length && FILE_TABS.has(tab.value)) {
          sel.value = { kind: 'file', item: shownFiles.value[0] || fileHits.value[0], idx: 0 }
        }
      } catch { fileHits.value = [] }
      searching.value = false
    }, 350)
  }

  function selFile(f: SearchFile, i: number) { sel.value = { kind: 'file', item: f, idx: i } }

  function openApp(a: any) {
    if (a.id === 'explorer') store.open('explorer', null, { title: '文件资源管理器' })
    else if (a.id === 'settings') store.open('settings')
    else store.open(a.id)
    handlers.onClose?.()
  }
  function openSettings(area: { id: string }) {
    store.open('settings', { tab: area.id })
    handlers.onClose?.()
  }
  function openWeb() {
    store.open('browser', { url: 'https://www.baidu.com/s?wd=' + encodeURIComponent(kw.value.trim()) })
    handlers.onClose?.()
  }
  function openSel() {
    const f = sel.value?.item as SearchFile | undefined
    if (!f) return
    store.open('explorer', { policyId: f.policyId, path: f.path }, { title: f.name, icon: 'explorer', w: 1000, h: 640 })
    handlers.onClose?.()
  }
  // HTTP 环境（非安全上下文）下 navigator.clipboard 不可用，copyText 内部回退 execCommand
  function copyPath(p: string) { copyText(p) }

  function focusInput() { nextTick(() => inputEl?.value?.focus()) }

  onMounted(() => {
    focusInput()
    loadRecent() // 预取浏览源：不输词直接点页签时立即可见内容
  })

  return {
    // 状态
    kw, tab, tabs, q, sel, appHits, settingsHits, shownFiles, fileHits, recentHits,
    searching, recentLoading, isFileTab, canOffline,
    // 动作
    onInput, loadRecent, selFile, openApp, openSettings, openWeb, openSel, copyPath, focusInput
  }
}
