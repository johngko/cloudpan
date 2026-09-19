<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" @click="save" :disabled="!canSave || saving">
        <AppIcon name="check" :size="15" />{{ saving ? '保存中…' : '保存' }}
      </button>
      <div class="tool-sep"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ fileName }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">
        {{ status }}{{ canSave ? (dirty ? ' · 未保存' : ' · 已保存') : ' · 只读' }}
      </span>
    </div>
    <div v-if="!ready" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-3); font-size: 13px">
      <AppIcon name="whiteboard" :size="40" />
      <span>正在加载白板…</span>
    </div>
    <div ref="host" style="flex: 1; position: relative; min-height: 0"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fsApi } from '../api/modules'
import { useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

// 白板（Excalidraw，npm 懒加载 chunk 不进主包）：
// 字体/静态资源本地化：Excalidraw 默认从 esm.sh CDN 拉字体（离线环境报错且手写字体降级），
// 指向 public/excalidraw-assets/（构建时随 dist 嵌入二进制）
// ⚠️ 依赖 dist/prod/chunk-*.js 的两处手工补丁（重装 node_modules 后必须重打，npm run build 生效）：
// ① ASSETS_FALLBACK_URL 常量 → '/excalidraw-assets/'（原值 esm.sh CDN 绝对路径）；
// ② 字体候选列表末项 new URL(n, ASSETS_FALLBACK_URL) → new URL(n, jn.normalizeBaseUrl(…))
//    ——相对路径做 URL base 会抛 Invalid base URL，导致整个字体加载失败（主路径再对也没用）
;(window as any).EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'

// onMounted 时动态 import react/react-dom/@excalidraw/excalidraw 并 createRoot 挂载；
// 打开 = 解析 .excalidraw JSON 作 initialData；
// 保存 = {type:'excalidraw',version:2,elements,appState,files} 经 writeText 覆盖原文件。
const props = defineProps<{ winId: number; props: any }>()
const toast = useToast()

const policyId = ref(props.props?.policyId || 0)
const path = ref(props.props?.path || '')
const fileName = computed(() => (path.value || '未命名').split('/').pop() || '未命名')
const canSave = computed(() => !!policyId.value && !!path.value)

const host = ref<HTMLElement>()
const ready = ref(false)
const status = ref('加载中')
const dirty = ref(false)
const saving = ref(false)
let latest: { elements: any[]; appState: any; files: any } | null = null
let root: any = null
let unmount = false

async function mount() {
  if (!host.value) return
  // 懒加载 React 全家桶（主 bundle 不增重）
  const ReactModule = await import('react')
  const React = ReactModule.default
  const { createRoot } = await import('react-dom/client')
  const ExcalidrawModule = await import('@excalidraw/excalidraw')
  const Excalidraw = ExcalidrawModule.Excalidraw
  await import('@excalidraw/excalidraw/index.css')

  // 初始数据：已读文件内容（onMounted 里加载），空/解析失败 = 空白板
  const initialData = lastLoaded
  const el = React.createElement(Excalidraw, {
    initialData: initialData,
    onChange: (p: any) => {
      latest = { elements: p.elements, appState: p.appState, files: p.files }
      dirty.value = true
      status.value = '已就绪'
    },
    UIOptions: { canvasActions: { loadToClipboard: true } },
    theme: 'light'
  })
  root = createRoot(host.value)
  root.render(el)
  ready.value = true
}

let lastLoaded: any = null
onMounted(async () => {
  if (canSave.value) {
    try {
      const d = await fsApi.readText(policyId.value, path.value)
      if (d.content && d.content.trim()) {
        const j = JSON.parse(d.content)
        // .excalidraw 文件本体即 {type,version,elements,appState,files}
        if (Array.isArray(j.elements)) lastLoaded = { elements: j.elements, appState: j.appState || {}, files: j.files || {} }
      }
    } catch { /* 空文件：空白板 */ }
  }
  try {
    await mount()
  } catch (e: any) {
    status.value = '加载失败'
    toast.error('白板加载失败：' + (e?.message || e))
  }
})

async function save() {
  if (!canSave.value || saving.value) return
  if (!latest) latest = { elements: [], appState: {}, files: {} }
  saving.value = true
  try {
    const doc = { type: 'excalidraw', version: 2, source: 'cloudpan', ...latest }
    await fsApi.writeText(policyId.value, path.value, JSON.stringify(doc))
    dirty.value = false
    window.dispatchEvent(new CustomEvent('cp-refresh-explorer', {
      detail: { policyId: policyId.value, path: path.value.slice(0, path.value.lastIndexOf('/')) || '/' }
    }))
    toast.success('保存成功')
  } catch (e: any) {
    toast.error('保存失败：' + (e?.message || e))
  } finally {
    saving.value = false
  }
}

function onKey(e: KeyboardEvent) {
  // Ctrl+S：Excalidraw 内部不处理，这里接管
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  unmount = true
  window.removeEventListener('keydown', onKey)
  try { root?.unmount() } catch { /* 忽略 */ }
  root = null
})
</script>
