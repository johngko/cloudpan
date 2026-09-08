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
        <!-- 文件（全部/文档/文件夹/照片，按当前页签过滤） -->
        <template v-if="isFileTab && shownFiles.length">
          <div class="w12-search-sec">文件</div>
          <div v-for="(f, i) in shownFiles" :key="f.path" class="w12-search-item"
            :class="{ on: sel && sel.kind === 'file' && sel.idx === i }" @click="selFile(f, i)">
            <img :src="fileIcon(f)" /><span class="nm">{{ f.name }}</span><small v-if="f.isDir">文件夹</small>
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
        <!-- 推荐（仅无关键词的全部页签，与 1:1 演示一致） -->
        <template v-if="!kw && tab === '全部'">
          <div class="w12-search-sec" style="line-height: 24px">推荐</div>
          <div class="w12-search-item" @click="openApp({ id: 'settings', name: '设置', icon: 'settings' })">
            <AppIcon name="settings" :size="25" /><span class="nm">设置</span>
          </div>
          <div class="w12-search-item" @click="openApp({ id: 'explorer', name: '文件资源管理器', icon: 'explorer' })">
            <AppIcon name="explorer" :size="25" /><span class="nm">文件资源管理器</span>
          </div>
          <div class="w12-search-item" @click="openApp({ id: 'browser', name: '浏览器', icon: 'browser' })">
            <AppIcon name="browser" :size="25" /><span class="nm">浏览器</span>
          </div>
        </template>
        <div v-if="kw && isFileTab && searching" class="w12-search-empty">正在搜索...</div>
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
import { visibleApps } from '../../stores/apps'
import { useWindows } from '../../stores/windows'
import { fsApi } from '../../api/modules'
import AppIcon from '../../components/AppIcon.vue'

const props = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useWindows()

const kw = ref('')
const tab = ref('全部')
const tabs = ['全部', '应用', '文档', '网页', '设置', '文件夹', '照片']
const fileHits = ref<any[]>([])
const appHits = ref<any[]>([])
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
const shownFiles = computed(() => {
  if (!fileHits.value.length) return []
  if (tab.value === '文档') return fileHits.value.filter(f => DOC_EXTS.includes((f.ext || '').toLowerCase()))
  if (tab.value === '照片') return fileHits.value.filter(f => IMG_EXTS.includes((f.ext || '').toLowerCase()))
  if (tab.value === '文件夹') return fileHits.value.filter(f => f.isDir)
  return fileHits.value
})

// 设置页深链（与 SettingsApp 侧边栏一致）
const SETTINGS_AREAS = [
  { id: 'person', name: '个性化', icon: 'sun', kws: ['主题', '壁纸', '深色', '外观', '个性化'] },
  { id: 'account', name: '账号', icon: 'user', kws: ['账号', '账户', '密码', '昵称', 'webdav'] },
  { id: 'shares', name: '我的分享', icon: 'share', kws: ['分享', '外链'] },
  { id: 'offline', name: '离线下载', icon: 'download', kws: ['离线', '下载', '磁力', '种子'] },
  { id: 'about', name: '关于', icon: 'info', kws: ['关于', '版本'] }
]
const settingsHits = computed(() => {
  const v = q.value
  if (!v) return SETTINGS_AREAS
  return SETTINGS_AREAS.filter(s => s.name.toLowerCase().includes(v) || s.kws.some(k => k.includes(v)))
})

function searchApps(v: string) {
  appHits.value = v ? visibleApps().filter(a => a.name.toLowerCase().includes(v) || a.id.includes(v)) : []
}

watch(q, v => {
  searchApps(v)
  if (v && isFileTab.value && !searching.value && !fileHits.value.length) onInput()
})

// 切换页签：需要文件结果但还没搜过（如先在「应用」页签输入）则补搜
watch(tab, () => {
  const v = kw.value.trim()
  if (!v) return
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
function copyPath(p: string) { try { navigator.clipboard.writeText(p) } catch {} }

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

onMounted(() => nextTick(() => inputEl.value?.focus()))
</script>
