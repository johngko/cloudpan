<template>
  <!-- #search-win：600×594 居中，输入 + 页签 + 左列表/右详情（真实全局搜索） -->
  <div class="w12-panel w12-search show-begin" :class="{ show: shown }" @click.stop>
    <div class="w12-inwrap">
      <span class="w12-inico">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </span>
      <input type="text" class="w12-input" id="w12-search-input" placeholder="在这里输入你要搜索的内容"
        v-model="kw" @input="onInput" ref="inputEl" />
    </div>
    <div class="w12-search-tabs">
      <button v-for="t in tabs" :key="t" :class="{ now: tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <div class="w12-search-ans">
      <div class="w12-search-list">
        <!-- 应用（全部/应用） -->
        <template v-if="(tab === '全部' || tab === '应用') && appHits.length">
          <div class="w12-search-sec">应用</div>
          <div v-for="a in appHits" :key="a.id" class="w12-search-item" @click="openApp(a)">
            <AppIcon :name="a.icon" :size="25" /><span class="nm">{{ a.name }}</span>
          </div>
        </template>
        <!-- 文件（全部/文档/文件夹/照片，按当前页签过滤）：
             有关键词=搜索命中；无关键字=各盘顶层首屏（浏览态），小字标注来源盘 -->
        <template v-if="isFileTab && shownFiles.length">
          <div class="w12-search-sec">文件</div>
          <div v-for="(f, i) in shownFiles" :key="f.policyId + '|' + f.path" class="w12-search-item"
            :class="{ on: sel && sel.kind === 'file' && sel.idx === i }" @click="selFile(f, i)">
            <img :src="fileIcon(f)" /><span class="nm">{{ f.name }}</span>
            <small v-if="!kw && f.policyName">{{ f.policyName }}</small><small v-else-if="f.isDir">文件夹</small>
          </div>
        </template>
        <!-- 设置（静态设置页深链） -->
        <template v-if="tab === '设置'">
          <div class="w12-search-sec">设置</div>
          <div v-for="s in settingsHits" :key="s.id" class="w12-search-item" @click="openSettings(s)">
            <AppIcon :name="s.icon" :size="25" /><span class="nm">{{ s.name }}</span>
            <small v-if="kw">设置</small>
          </div>
        </template>
        <!-- 网页（交给内置浏览器搜索） -->
        <template v-if="tab === '网页' && kw">
          <div class="w12-search-sec">网页</div>
          <div class="w12-search-item" @click="openWeb()">
            <AppIcon name="browser" :size="25" />
            <span class="nm">在浏览器中搜索“{{ kw }}”</span>
          </div>
        </template>
        <!-- 空态：区分"加载中 / 无结果"，避免面板空白 -->
        <div v-if="kw && isFileTab && searching" class="w12-search-empty">正在搜索...</div>
        <div v-else-if="!kw && isFileTab && recentLoading" class="w12-search-empty">正在读取文件...</div>
        <div v-else-if="!kw && isFileTab && !recentLoading && !shownFiles.length" class="w12-search-empty">此类型下暂无文件</div>
        <div v-else-if="kw && isFileTab && !searching && !shownFiles.length && !(tab === '全部' && appHits.length)" class="w12-search-empty">未找到相关结果</div>
        <div v-else-if="kw && tab === '应用' && !appHits.length" class="w12-search-empty">未找到相关应用</div>
        <div v-else-if="kw && tab === '设置' && !settingsHits.length" class="w12-search-empty">未找到相关设置</div>
        <div v-else-if="tab === '网页' && !kw" class="w12-search-empty">输入关键词，用内置浏览器搜索网页</div>
      </div>
      <div class="w12-search-view" :class="{ on: !!sel }">
        <template v-if="sel && sel.kind === 'file'">
          <img class="w12-sv-icon" :src="fileIcon(sel.item)" />
          <p class="w12-sv-name">{{ sel.item.name }}</p>
          <p class="w12-sv-type">{{ sel.item.isDir ? '文件夹' : (sel.item.ext ? sel.item.ext.toUpperCase() + ' 文件' : '文件') }}</p>
          <div class="w12-sv-opts">
            <div class="w12-sv-opt" @click="openSel">打开</div>
            <div class="w12-sv-opt" @click="copyPath(sel.item.path)">复制路径</div>
          </div>
        </template>
        <template v-else-if="sel && sel.kind === 'app'">
          <span class="w12-sv-icon"><AppIcon :name="sel.item.icon" :size="70" /></span>
          <p class="w12-sv-name">{{ sel.item.name }}</p>
          <p class="w12-sv-type">应用</p>
          <div class="w12-sv-opts">
            <div class="w12-sv-opt" @click="openApp(sel.item)">打开</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { visibleApps, canUseOffline } from '../../stores/apps'
import { useWindows } from '../../stores/windows'
import { useSession } from '../../stores/session'
import { fsApi } from '../../api/modules'
import { copyText } from '../../utils/clipboard'
import AppIcon from '../../components/AppIcon.vue'

const props = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useWindows()
const session = useSession()

const kw = ref('')
const tab = ref('全部')
const tabs = ['全部', '应用', '文档', '网页', '设置', '文件夹', '照片']
const fileHits = ref<any[]>([])
// 无关键字浏览：各盘顶层首屏（后端 kind=browse），开面板时预取一次，页签切换仅客户端过滤
const recentHits = ref<any[]>([])
const recentLoading = ref(false)
let recentSeq = 0
// 初始即全量应用：watch(q) 只在 q 变化时触发，挂载时不触发——否则无关键字态应用区恒空
const appHits = ref<any[]>(visibleApps())
const searching = ref(false)
const sel = ref<null | { kind: 'file' | 'app'; item: any; idx: number }>(null)
const inputEl = ref<HTMLInputElement>()
let t: any

const q = computed(() => kw.value.trim().toLowerCase())

// ---- 分类过滤 ----
const FILE_TABS = new Set(['全部', '文档', '文件夹', '照片'])
const isFileTab = computed(() => FILE_TABS.has(tab.value))
const DOC_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md', 'csv', 'rtf', 'wps', 'epub', 'mobi', 'log', 'json', 'xml']
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'tif', 'tiff', 'avif']
// 有关键词=搜索命中；无关键字=浏览源（各盘顶层首屏），按当前页签过滤
const shownFiles = computed(() => {
  const src = q.value ? fileHits.value : recentHits.value
  if (!src.length) return []
  if (tab.value === '文档') return src.filter(f => DOC_EXTS.includes((f.ext || '').toLowerCase()))
  if (tab.value === '照片') return src.filter(f => IMG_EXTS.includes((f.ext || '').toLowerCase()))
  if (tab.value === '文件夹') return src.filter(f => f.isDir)
  return src
})

// 设置页深链（与 SettingsApp 侧边栏一致）
const SETTINGS_AREAS = [
  { id: 'person', name: '个性化', icon: 'sun', kws: ['主题', '壁纸', '深色', '外观', '个性化'] },
  { id: 'account', name: '账号', icon: 'user', kws: ['账号', '账户', '密码', '昵称', 'webdav'] },
  { id: 'shares', name: '我的分享', icon: 'share', kws: ['分享', '外链'] },
  { id: 'offline', name: '离线下载', icon: 'download', kws: ['离线', '下载', '磁力', '种子'] },
  { id: 'about', name: '关于', icon: 'info', kws: ['关于', '版本'] }
]
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

function selFile(f: any, i: number) { sel.value = { kind: 'file', item: f, idx: i } }
function openApp(a: any) {
  if (a.id === 'explorer') store.open('explorer', null, { title: '文件资源管理器' })
  else if (a.id === 'settings') store.open('settings')
  else store.open(a.id)
  emit('close')
}
function openSettings(area: any) {
  store.open('settings', { tab: area.id })
  emit('close')
}
function openWeb() {
  store.open('browser', { url: 'https://www.baidu.com/s?wd=' + encodeURIComponent(kw.value.trim()) })
  emit('close')
}
function openSel() {
  const f = sel.value?.item
  if (!f) return
  store.open('explorer', { policyId: f.policyId, path: f.path }, { title: f.name, icon: 'explorer', w: 1000, h: 640 })
  emit('close')
}
// HTTP 环境（非安全上下文）下 navigator.clipboard 不可用，copyText 内部回退 execCommand
function copyPath(p: string) { copyText(p) }

function fileIcon(f: any): string {
  const e = (f.ext || '').toLowerCase()
  if (f.isDir) return '/icons/win12/apps/explorer/folder.svg'
  if (['docx', 'doc'].includes(e)) return '/icons/win12/files/word.png'
  if (['xlsx', 'xls'].includes(e)) return '/icons/win12/files/excel.png'
  if (['pptx', 'ppt'].includes(e)) return '/icons/win12/files/ppt.png'
  if (e === 'pdf') return '/icons/win12/files/pdf.svg'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(e)) return '/icons/win12/files/img.png'
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(e)) return '/icons/win12/files/vidio.png'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return '/icons/win12/files/music.png'
  if (['exe', 'msi', 'bat'].includes(e)) return '/icons/win12/files/exefile.png'
  if (['txt', 'md', 'log', 'json', 'xml', 'js', 'ts', 'go', 'py', 'c', 'css', 'html', 'ini', 'yml', 'yaml', 'sh'].includes(e)) return '/icons/win12/files/txt.png'
  return '/icons/win12/files/txt.png'
}

onMounted(() => {
  nextTick(() => inputEl.value?.focus())
  loadRecent() // 预取浏览源：不输词直接点页签时立即可见内容
})
</script>
