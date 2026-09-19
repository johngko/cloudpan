<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" @click="save" :disabled="!canSave || !parseOk || saving">
        <AppIcon name="check" :size="15" />{{ saving ? '保存中…' : '保存' }}
      </button>
      <div class="tool-sep"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ fileName }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">
        {{ status }}{{ !parseOk ? ' · 只读' : (canSave ? (dirty ? ' · 未保存' : ' · 已保存') : ' · 只读') }}
      </span>
    </div>
    <div v-if="!ready" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-3); font-size: 13px">
      <AppIcon name="mindmap" :size="40" />
      <span>正在加载思维导图编辑器…</span>
    </div>
    <iframe v-show="ready" ref="frame" style="flex: 1; width: 100%; border: none; background: #f7f8fa"
      src="/vendor/mindmap/host.html" @load="onFrameLoad"></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fsApi } from '../api/modules'
import { useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

// 思维导图（kalcaddle/mind-map，vendored 到 /vendor/mindmap/）：
// 同源 iframe 走其 takeOverApp 宿主桥——host.html 已内置 6 个同步回调
// （getMindMapData/saveMindMapData/…），takeOver 模式下应用不自启动，
// 由本组件注入数据后调用 iframe.contentWindow.initApp() 启动。
const props = defineProps<{ winId: number; props: any }>()
const toast = useToast()

const policyId = ref(props.props?.policyId || 0)
const path = ref(props.props?.path || '')
const fileName = computed(() => (path.value || '未命名').split('/').pop() || '未命名')
const canSave = computed(() => !!policyId.value && !!path.value)

const frame = ref<HTMLIFrameElement>()
const ready = ref(false)
const status = ref('加载中')
const dirty = ref(false)
const saving = ref(false)
const parseOk = ref(true) // 文件内容可解析为 .smm JSON（.xmind 为 zip 容器，不可编辑）
const dataReady = ref(false) // 文件内容加载完成（避免 iframe 先于数据就绪而初始化空文档）
let latest: any = null // 最近一次编辑数据（saveMindMapData 每次变更都会回调）

const MINDMAP_TEMPLATE = JSON.stringify({
  root: { data: { text: '中心主题' }, children: [] },
  theme: { template: 'avocado', config: {} },
  layout: 'logicalStructure',
  config: {},
  view: null
}, null, 2)

function win(): Window | null {
  return frame.value?.contentWindow || null
}

onMounted(async () => {
  if (!canSave.value) {
    // 无文件启动（开始菜单/启动台）：用模板初始化一张新导图。
    // 不注入数据（latest=null）会让应用初始化崩溃（destructure 'root' of null）卡在加载态
    latest = JSON.parse(MINDMAP_TEMPLATE)
    status.value = '新导图'
    dataReady.value = true
    return
  }
  let text = ''
  try {
    const d = await fsApi.readText(policyId.value, path.value)
    text = d.content || ''
  } catch { /* 空文件/新建未写：用模板 */ }
  if (!text.trim()) {
    latest = JSON.parse(MINDMAP_TEMPLATE)
    dataReady.value = true
    return
  }
  try {
    latest = JSON.parse(text)
  } catch {
    // 非 .smm JSON（如 .xmind 的 zip 容器）：只读展示提示，绝不用模板覆盖原文件
    parseOk.value = false
    status.value = '无法识别的格式（仅 .smm JSON 可编辑）'
  }
  dataReady.value = true
})

function onFrameLoad() {
  // 格式不可编辑：不启动应用，停留在提示层
  if (!parseOk.value) return
  // 文件内容尚未读取完成：稍后重试，避免用空数据初始化
  if (!dataReady.value) { setTimeout(onFrameLoad, 100); return }
  const w = win()
  if (!w) return
  // host.html 的 app.js 加载完成后才暴露 initApp；load 事件保证已执行
  if (typeof w.initApp !== 'function') {
    // 兜底：脚本尚未就绪（理论上不会发生），稍后重试
    setTimeout(onFrameLoad, 100)
    return
  }
  // 注入数据 + 保存回调（必须在 initApp 之前：应用启动时读取 getMindMapData）
  w.__mmData = latest
  w.__mmOnSave = (d: any) => { latest = d; dirty.value = true; status.value = '已就绪' }
  try {
    w.initApp()
    ready.value = true
  } catch (e: any) {
    status.value = '加载失败'
    toast.error('思维导图编辑器初始化失败：' + (e?.message || e))
  }
}

async function save() {
  if (!canSave.value || !parseOk.value || saving.value) return
  saving.value = true
  try {
    await fsApi.writeText(policyId.value, path.value, JSON.stringify(latest, null, 2))
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

// Ctrl+S 保存（与记事本一致）
function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
