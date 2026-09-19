<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" @click="save" :disabled="!canSave || saving">
        <AppIcon name="check" :size="15" />{{ saving ? '保存中…' : '保存' }}
      </button>
      <button class="tool-btn" @click="reload" title="重新加载当前文件">
        <AppIcon name="refresh" :size="15" />
      </button>
      <div class="tool-sep"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ fileName }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">
        {{ status }}{{ canSave ? (dirty ? ' · 未保存' : ' · 已保存') : ' · 只读' }}
      </span>
    </div>
    <div v-if="!ready" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-3); font-size: 13px">
      <AppIcon name="flowchart" :size="40" />
      <span>正在加载流程图编辑器…</span>
    </div>
    <iframe v-show="ready" ref="frame" style="flex: 1; width: 100%; border: none; background: #fff"
      :src="frameSrc" @load="onFrameLoad"></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fsApi } from '../api/modules'
import { useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

// 流程图（drawio，vendored 到 /vendor/drawio/）：
// 同源 iframe ?embed=1&proto=json 走 drawio embed JSON postMessage 协议
// （不带 proto=json 时应用回发的是 "ready" 字符串与裸 XML，非 JSON 事件）：
//   宿主 → 应用：{action:'load', xml, exportProtocol:1} 载入文档并启用导出协议；
//                {action:'export', format:'xml'} 请求当前内容
//   应用 → 宿主：{event:'init'} 就绪；{event:'load', xml} 载入确认；
//                {event:'save', xml} / {event:'export', xml} 保存（应用内文件菜单或宿主 export 请求）
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
const frameSrc = ref('/vendor/drawio/?embed=1&spin=1&save=1&proto=json&lang=zh&ui=zh')
let initSent = false
let exportPending = false
let currentXml = ''

const DRAWIO_TEMPLATE = `<mxfile host="CloudPan" agent="CloudPan" version="24.7.7" type="device">
  <diagram id="page1" name="第 1 页">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`

onMounted(async () => {
  if (!canSave.value) { status.value = '只读'; return }
  let text = ''
  try {
    const d = await fsApi.readText(policyId.value, path.value)
    text = d.content || ''
  } catch { /* 空文件：模板 */ }
  // .drawio 文件本体即 mxfile XML
  currentXml = text.trim() ? text : DRAWIO_TEMPLATE
})

function win(): Window | null {
  return frame.value?.contentWindow || null
}

// postMessage 请求-响应：发送 action，等待对应 event（10s 超时）
function sendRequest(action: string, payload: Record<string, any> = {}, waitEvent?: string, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = win()
    if (!w) { reject(new Error('编辑器未就绪')); return }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return
      let m: any
      try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
      if (m && m.event === (waitEvent || action)) {
        window.removeEventListener('message', onMsg)
        clearTimeout(t)
        resolve(m)
      }
    }
    const t = setTimeout(() => {
      window.removeEventListener('message', onMsg)
      reject(new Error('编辑器无响应（' + action + '）'))
    }, timeout)
    window.addEventListener('message', onMsg)
    w.postMessage(JSON.stringify({ action, ...payload }), '*')
  })
}

function onFrameLoad() {
  // iframe 首次加载：等 {event:'init'} 再载入文档
  if (initSent) return
  const w = win()
  if (!w) return
  const onMsg = (e: MessageEvent) => {
    if (e.origin !== location.origin) return
    let m: any
    try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
    if (!m || typeof m.event !== 'string') return
    // 应用内「文件>保存」或 export 请求回包都携带 xml，统一走本地保存
    if (m.event === 'save' || (m.event === 'export' && !exportPending)) { if (m.xml) onRemoteSave(m.xml); return }
    if (m.event !== 'init') return
    window.removeEventListener('message', onMsg)
    initSent = true
    ready.value = true
    status.value = '已就绪'
    // exportProtocol:1 开启导出协议，save() 的 {action:'export'} 才能拿到 JSON 回包
    sendRequest('load', { xml: currentXml, autosave: 0, keepopen: 1, exportProtocol: 1 }, 'load')
      .catch(() => { /* load 回包非必须；文档已注入 */ })
  }
  window.addEventListener('message', onMsg)
}

// drawio 工具栏「保存」按钮触发
async function onRemoteSave(xml: string) {
  if (!xml) return
  dirty.value = true
  currentXml = xml
  await doSave()
}

async function doSave() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    await fsApi.writeText(policyId.value, path.value, currentXml)
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

async function save() {
  if (!canSave.value || saving.value) return
  // 主动请求当前文档 XML（format=xml 时回包带 xml 字段）
  exportPending = true
  try {
    const r = await sendRequest('export', { format: 'xml', autosize: 1, border: 10, crop: 1, keepopen: 1 }, 'export')
    if (r && r.xml) currentXml = r.xml
  } catch {
    // 该构建不支持 export 请求：退回用工具栏保存（事件通道）
    toast.error('无法获取当前内容，请使用画布工具栏的「保存」按钮')
    return
  } finally {
    exportPending = false
  }
  await doSave()
}

function reload() {
  ready.value = false
  initSent = false
  frameSrc.value = '/vendor/drawio/?embed=1&spin=1&save=1&proto=json&lang=zh&ui=zh&_r=' + Date.now()
}

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
