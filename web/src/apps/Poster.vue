<template>
  <div class="app-root poster-root">
    <!-- 左侧：模板库 + 素材库（内置资源盘 T: 只读） -->
    <div class="poster-side">
      <div class="side-tabs">
        <div class="side-tab" :class="{ on: tab === 'tpl' }" @click="tab = 'tpl'">模板库</div>
        <div class="side-tab" :class="{ on: tab === 'mat' }" @click="tab = 'mat'">素材库</div>
      </div>

      <div v-if="tab === 'tpl'" class="side-body">
        <div class="side-search">
          <input v-model="tplQuery" placeholder="搜索模板（如 618、婚礼、招聘）" />
        </div>
        <div class="tpl-grid">
          <div v-for="t in filteredTpl" :key="t.file" class="tpl-card" :title="t.title + '（' + t.width + '×' + t.height + '）'" @click="openTemplate(t)">
            <img :src="tUrl(t.thumb)" loading="lazy" alt="" @error="onImgErr" />
            <div class="tpl-meta">
              <span class="tpl-name">{{ t.title }}</span>
              <span class="tpl-size">{{ t.width }}×{{ t.height }}</span>
            </div>
          </div>
          <div v-if="!manifest && !loadingManifest" class="side-empty">
            <AppIcon name="poster" :size="34" />
            <span>模板清单加载失败</span>
          </div>
        </div>
      </div>

      <div v-else class="side-body">
        <div class="mat-cats">
          <div v-for="c in matCats" :key="c" class="mat-cat" :class="{ on: matCat === c }" @click="matCat = c">{{ c }}</div>
        </div>
        <div class="mat-grid">
          <div v-for="m in filteredMat" :key="m.file" class="mat-card" :title="m.name" @click="addMaterial(m)">
            <img :src="tUrl(m.file)" loading="lazy" alt="" @error="onImgErr" />
          </div>
        </div>
        <div class="side-tip">点击素材加入画布</div>
      </div>
    </div>

    <!-- 右侧：编辑器（vendored 海报设计，同源 iframe cp 嵌入模式） -->
    <div class="poster-main">
      <div class="poster-toolbar">
        <select class="toolbar-sel" v-model="newSize" title="新建画布尺寸">
          <option value="750*1334">新建 手机海报 750×1334</option>
          <option value="1080*1920">新建 手机海报 1080×1920</option>
          <option value="1000*1000">新建 方形 1000×1000</option>
          <option value="1920*1080">新建 横幅 1920×1080</option>
        </select>
        <button class="tool-btn" @click="newBoard">
          <AppIcon name="plus" :size="14" />新建画布
        </button>
        <div class="tool-sep"></div>
        <button class="tool-btn" :disabled="exporting" @click="exportPng('cloud')">
          <AppIcon name="upload" :size="14" />{{ exporting ? '导出中…' : '导出 PNG 到云盘' }}
        </button>
        <button class="tool-btn" :disabled="exporting" @click="exportPng('local')">
          <AppIcon name="download" :size="14" />下载 PNG
        </button>
        <div style="flex: 1"></div>
        <span class="toolbar-hint">作品保存于「{{ savePolicy?.name || '云盘' }} /poster/」· 模板素材来自内置资源库 T:（只读）</span>
      </div>
      <iframe v-show="frameSrc" ref="frame" class="poster-frame" :src="frameSrc" @load="onFrameLoad" title="海报设计编辑器"></iframe>
      <div v-if="!frameSrc" class="poster-placeholder">
        <AppIcon name="poster" :size="46" />
        <div>正在加载海报设计…</div>
        <div class="ph-sub">从左侧选一个模板开始，或点「新建画布」</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fsApi, rawUrl, Policy } from '../api/modules'
import { getToken } from '../api/http'
import { useToast } from '../stores/dialog'
import { useTransfer } from '../stores/transfer'
import AppIcon from '../components/AppIcon.vue'

// 海报设计（poster-design 前端 vendored 到 /vendor/poster/，同源 iframe 嵌入）：
//  - 模板库/素材库：内置只读资源盘 T:（/templates/、/materials/，manifest = /index.json）
//  - 编辑器：/vendor/poster/index.html#/home?cp=1&pid=&cpath=&tok=&spid=&spath=
//    cp 模式下编辑器经 /api/fs/text 读作品、postMessage 把保存/导出交回本窗口
//  - 保存：.poster.json 写用户盘 /poster/；导出 PNG：分块上传同目录
const props = defineProps<{ winId: number; props: any }>()
const toast = useToast()
const transfer = useTransfer()

// ---- 策略：T: 内置资源盘（只读，模板/素材来源）+ 用户本地盘（保存目标） ----
const policies = ref<Policy[]>([])
const tPolicy = computed(() => policies.value.find(p => p.type === 'builtin' && p.letter === 'T') || null)
const savePolicy = computed(() => policies.value.find(p => p.type === 'local') || null)

// ---- 清单（T:/index.json） ----
interface Tpl { file: string; thumb: string; width: number; height: number; title: string }
interface Mat { file: string; category: string; name: string }
const manifest = ref<any>(null)
const loadingManifest = ref(false)
const tab = ref<'tpl' | 'mat'>('tpl')
const tplQuery = ref('')
const matCat = ref('全部')
const matCats = ['全部', '背景', '装饰', '边框', '图标', '纹理']

const tpls = computed<Tpl[]>(() => {
  const arr: any[] = manifest.value?.templates || []
  return arr.map(t => ({ ...t, title: (t.file.split('/').pop() || t.file).replace(/^t\d+-/, '').replace(/\.json$/i, '').replace(/-/g, ' ') }))
})
const mats = computed<Mat[]>(() => {
  const arr: any[] = manifest.value?.materials || []
  return arr.map(m => ({ ...m, name: (m.file.split('/').pop() || m.file).replace(/\.png$/i, '') }))
})
const filteredTpl = computed(() => {
  const q = tplQuery.value.trim().toLowerCase()
  return q ? tpls.value.filter(t => (t.title + t.file).toLowerCase().includes(q)) : tpls.value
})
const filteredMat = computed(() => matCat.value === '全部' ? mats.value : mats.value.filter(m => m.category === matCat.value))

function tUrl(p: string) {
  return tPolicy.value ? rawUrl(tPolicy.value.id, p) : ''
}
function onImgErr(e: Event) {
  ;(e.target as HTMLImageElement).style.visibility = 'hidden'
}

// ---- 编辑器 iframe ----
const frame = ref<HTMLIFrameElement>()
const frameSrc = ref('')
const currentTitle = ref('')
const exporting = ref(false)
const newSize = ref('750*1334')

// 每次切换作品/模板都换一次文档查询串（#r=n）：hash 路由下仅改 # 后内容不会重载
// 已加载的 iframe 文档，必须改 # 前的文档 URL 才会重新走 onMounted→loadData→cpLoad
let srcNonce = 0
function iframeSrc(cpath: string, wH = '') {
  const tp = tPolicy.value
  if (!tp) return ''
  srcNonce++
  const q = new URLSearchParams()
  q.set('cp', '1')
  q.set('pid', String(tp.id))
  if (cpath) q.set('cpath', cpath)
  if (wH) q.set('w_h', wH)
  q.set('tok', getToken() || '')
  if (savePolicy.value) {
    q.set('spid', String(savePolicy.value.id))
    q.set('spath', '/poster')
  }
  return `/vendor/poster/index.html?r=${srcNonce}#/home?${q.toString()}`
}

function openTemplate(t: Tpl) {
  currentTitle.value = t.title
  frameSrc.value = iframeSrc(t.file)
}
function newBoard() {
  currentTitle.value = ''
  frameSrc.value = iframeSrc('', newSize.value)
}

let frameLoadTick = 0
function onFrameLoad() {
  frameLoadTick++
  // 素材点击早于编辑器就绪时补发
  if (pendingMat.value) {
    const m = pendingMat.value
    pendingMat.value = null
    setTimeout(() => postToFrame({ type: 'cp-poster:add-image', url: tUrl(m.file) }), 2500)
  }
}

function postToFrame(d: any) {
  frame.value?.contentWindow?.postMessage({ target: 'cp-poster-iframe', ...d }, '*')
}

// ---- 素材 → 画布 ----
const pendingMat = ref<Mat | null>(null)
function addMaterial(m: Mat) {
  if (!tPolicy.value) return
  if (!frameSrc.value) {
    // 还没有画布：先开空白板再投递
    newBoard()
    pendingMat.value = m
    return
  }
  postToFrame({ type: 'cp-poster:add-image', url: tUrl(m.file) })
}

// ---- 导出 PNG（iframe 前端出图 → dataURL 回传宿主） ----
let exportState: { mode: 'cloud' | 'local'; timer: ReturnType<typeof setTimeout> } | null = null
function exportPng(mode: 'cloud' | 'local') {
  if (!frameSrc.value) { toast.error('请先打开模板或新建画布'); return }
  if (exporting.value) return
  exporting.value = true
  postToFrame({ type: 'cp-poster:export' })
  exportState = {
    mode,
    timer: setTimeout(() => {
      if (exportState) { exportState = null; exporting.value = false; toast.error('导出超时：编辑器未就绪，请重试') }
    }, 60000)
  }
}

// ---- 宿主 ↔ iframe postMessage 桥 ----
function onMessage(e: MessageEvent) {
  const d = e.data
  if (!d || typeof d !== 'object') return
  // iframe → 宿主：保存作品
  if (d.type === 'cp-poster:save') {
    handleSave(d)
    return
  }
  // iframe → 宿主：导出结果
  if (d.type === 'cp-poster:exported') {
    const st = exportState
    if (st) { clearTimeout(st.timer); exportState = null }
    exporting.value = false
    if (d.error) { toast.error(d.error); return }
    if (!st || !d.dataUrl) return
    handleExported(st.mode, d.dataUrl, d.fileName || '海报.png')
    return
  }
  // iframe → 宿主：素材上画布回执
  if (d.type === 'cp-poster:added') { /* 静默成功 */ return }
  if (d.type === 'cp-poster:add-error') { toast.error('素材添加失败，请重试'); return }
}

async function handleSave(d: any) {
  const reply = (ok: boolean, msg = '') => {
    frame.value?.contentWindow?.postMessage({ target: 'cp-poster-iframe', type: 'cp-poster:saved', ok, msg }, '*')
  }
  try {
    const pid = Number(d.policyId)
    if (!pid || !d.path) { reply(false, '保存目标无效'); return }
    await fsApi.writeText(pid, d.path, d.data)
    reply(true, d.path)
  } catch (err: any) {
    reply(false, err?.message || '保存失败')
  }
}

// dataURL → Blob（不经过 fetch：宿主 CSP connect-src 'self' 会拦 data: 地址）
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

async function handleExported(mode: 'cloud' | 'local', dataUrl: string, fileName: string) {
  try {
    const blob = dataUrlToBlob(dataUrl)
    const file = new File([blob], fileName, { type: blob.type || 'image/png' })
    if (mode === 'cloud') {
      if (!savePolicy.value) { toast.error('未找到可保存的云盘'); return }
      transfer.addFiles(savePolicy.value.id, '/poster', [file])
      toast.success(`PNG 正在上传到 /poster/${fileName}`)
    } else {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = fileName
      a.click()
    }
  } catch (err: any) {
    toast.error('PNG 处理失败：' + (err?.message || ''))
  }
}

onMounted(async () => {
  window.addEventListener('message', onMessage)
  try {
    loadingManifest.value = true
    policies.value = await fsApi.policies()
    if (tPolicy.value) {
      const d = await fsApi.readText(tPolicy.value.id, '/index.json')
      manifest.value = JSON.parse(d.content || '{}')
    }
  } catch (e) {
    toast.error('资源库加载失败')
  } finally {
    loadingManifest.value = false
  }
  // Explorer 双击 .poster.json 进入：直接打开该作品
  const p = props.props
  if (p?.policyId && p?.path) {
    currentTitle.value = (p.name || p.path).replace(/\.poster\.json$/i, '')
    frameSrc.value = `/vendor/poster/index.html#/home?cp=1&pid=${p.policyId}&cpath=${encodeURIComponent(p.path)}&tok=${encodeURIComponent(getToken() || '')}${savePolicy.value ? `&spid=${savePolicy.value.id}&spath=${encodeURIComponent('/poster')}` : ''}`
  } else {
    newBoard()
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
})
</script>

<style scoped>
.poster-root {
  display: flex;
  /* app-root 基类是纵向 flex，本应用需要横向（左资源库 + 右编辑器） */
  flex-direction: row;
  flex: 1;
  min-height: 0;
  background: var(--bg-1, #f3f5f9);
}
.poster-side {
  width: 300px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bd-1, #e3e7ee);
  background: var(--bg-2, #fff);
}
.side-tabs { display: flex; border-bottom: 1px solid var(--bd-1, #e3e7ee) }
.side-tab {
  flex: 1; padding: 9px 0; text-align: center; font-size: 13px; cursor: pointer;
  color: var(--text-2, #667); border-bottom: 2px solid transparent; user-select: none;
}
.side-tab.on { color: var(--text-1, #223); font-weight: 600; border-bottom-color: var(--accent-1, #2f86d6) }
.side-body { flex: 1; overflow: auto; display: flex; flex-direction: column; min-height: 0 }
.side-search { padding: 8px 10px }
.side-search input {
  width: 100%; box-sizing: border-box; padding: 6px 9px; font-size: 12px;
  border: 1px solid var(--bd-1, #dfe3ea); border-radius: 6px; outline: none; background: var(--bg-1, #f6f8fb);
}
.tpl-grid, .mat-grid { display: grid; gap: 8px; padding: 4px 10px 12px }
.tpl-grid { grid-template-columns: repeat(2, 1fr) }
.mat-grid { grid-template-columns: repeat(3, 1fr) }
.tpl-card {
  position: relative; border-radius: 8px; overflow: hidden; cursor: pointer;
  border: 1px solid var(--bd-1, #e3e7ee); background: #fff; transition: box-shadow .15s;
}
.tpl-card:hover { box-shadow: 0 2px 10px rgba(30, 60, 120, .18) }
.tpl-card img { width: 100%; aspect-ratio: 750 / 1100; object-fit: cover; display: block }
.tpl-meta { display: flex; justify-content: space-between; align-items: center; padding: 4px 7px; gap: 6px }
.tpl-name { font-size: 11px; color: var(--text-1, #223); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.tpl-size { font-size: 10px; color: var(--text-3, #98a); flex: none }
.mat-card { border-radius: 6px; overflow: hidden; cursor: pointer; border: 1px solid var(--bd-1, #e3e7ee); background: #fff }
.mat-card:hover { box-shadow: 0 2px 8px rgba(30, 60, 120, .16) }
.mat-card img { width: 100%; aspect-ratio: 1; object-fit: contain; display: block; background: #f2f4f8 }
.mat-cats { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 10px }
.mat-cat {
  font-size: 11px; padding: 3px 9px; border-radius: 999px; cursor: pointer; user-select: none;
  color: var(--text-2, #667); background: var(--bg-1, #eef1f6);
}
.mat-cat.on { color: #fff; background: var(--accent-1, #2f86d6) }
.side-tip { font-size: 11px; color: var(--text-3, #98a); text-align: center; padding: 0 0 8px }
.side-empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 30px 0; color: var(--text-3, #98a); font-size: 12px }
.poster-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0 }
.poster-toolbar {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px;
  border-bottom: 1px solid var(--bd-1, #e3e7ee); background: var(--bg-2, #fff);
}
.toolbar-sel {
  font-size: 12px; padding: 5px 7px; border-radius: 6px;
  border: 1px solid var(--bd-1, #dfe3ea); background: var(--bg-2, #fff); color: var(--text-1, #223);
}
.tool-btn {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;
  padding: 5px 10px; border-radius: 6px; border: 1px solid var(--bd-1, #dfe3ea);
  background: var(--bg-2, #fff); color: var(--text-1, #223); white-space: nowrap;
}
.tool-btn:hover { background: var(--bg-1, #eef2f8) }
.tool-btn:disabled { opacity: .55; cursor: default }
.tool-sep { width: 1px; height: 18px; background: var(--bd-1, #e3e7ee) }
.toolbar-hint { font-size: 11px; color: var(--text-3, #98a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.poster-frame { flex: 1; width: 100%; border: none; background: #2b2f36 }
.poster-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  color: var(--text-2, #667); font-size: 13px;
}
.ph-sub { font-size: 12px; color: var(--text-3, #98a) }
</style>
