<template>
  <div class="app-root">
    <div class="app-toolbar">
      <AppIcon name="office" :size="16" />
      <span style="font-size: 12.5px; color: var(--text-2)">{{ props.props?.name }}</span>
      <div style="flex: 1"></div>

      <!-- 编辑模式切换 -->
      <span v-if="fallbackMode && sheets.length > 1" style="font-size: 12px; color: var(--text-3); margin-right: 6px">
        工作表 {{ sheetIdx + 1 }}/{{ sheets.length }}
      </span>
        <button v-if="fallbackMode && sheets.length > 1" class="tool-btn" @click="sheetIdx = (sheetIdx + 1) % sheets.length">
        <AppIcon name="fwd" :size="14" />切换
      </button>

      <!-- 编辑模式操作按钮 -->
      <template v-if="isEditable">
        <button v-if="!editing" class="tool-btn primary" @click="startEdit"><AppIcon name="edit" :size="14"/>编辑</button>
        <template v-if="editing">
          <button class="tool-btn primary" @click="saveEdit" :disabled="saving"><AppIcon name="save" :size="14"/>保存</button>
          <button class="tool-btn" @click="cancelEdit"><AppIcon name="cancel" :size="14"/>取消</button>
        </template>
      </template>

      <button class="tool-btn" @click="download"><AppIcon name="download" :size="15"/>下载</button>
    </div>

    <!-- ONLYOFFICE 在线编辑 -->
    <div v-show="mode === 'ds'" style="flex: 1; position: relative">
      <div id="cp-office-placeholder" style="position: absolute; inset: 0"></div>
    </div>

    <!-- PDF 内嵌预览（v-if：非 PDF 模式不得挂载——iframe 加载 docx 等不可渲染类型会触发浏览器下载） -->
    <iframe v-if="mode === 'pdf'" :src="rawSrc" style="flex: 1; border: none; background: #525659"></iframe>

    <!-- 未配置 Document Server 时的提示：说明当前是内置静态预览，如何获得 Cloudreve 式在线编辑 -->
    <div v-if="mode === 'static' && !session.site.officeConfigured" class="ds-hint">
      <AppIcon name="info" :size="14" />
      当前为内置静态预览。在管理控制台 → 站点设置中配置 ONLYOFFICE Document Server 后，
      将启用与 Cloudreve 一致的在线预览与编辑（真实 Office 编辑器界面）
    </div>

    <!-- 静态预览（docx / xlsx / pptx 离线） -->
    <div v-show="mode === 'static' && !editing" ref="staticHost" class="static-preview">
      <div class="docx-host" ref="docxHost"></div>
      <table class="xlsx-host" v-html="sheetHtml"></table>
      <div class="pptx-host" ref="pptxHost"></div>
      <div v-if="ext.value === 'xlsx' || ext.value === 'xls' || ext.value === 'csv'" style="margin-top: 12px; font-size: 12px; color: var(--text-3)">
        静态预览 · 点击「编辑」可在线修改后保存
      </div>
    </div>

    <!-- 可编辑表格模式 -->
    <div v-show="mode === 'static' && editing" class="edit-preview">
      <div class="edit-header">
        <span style="font-size: 13px; color: var(--text); font-weight: 500">正在编辑: {{ props.props?.name }}</span>
        <span style="font-size: 11px; color: var(--text-3)">修改后请点击「保存」覆盖文件</span>
      </div>
      <div class="edit-body" ref="editBody">
        <table class="edit-table">
          <tbody>
            <tr v-for="(row, ri) in editableData" :key="ri">
              <td v-for="(cell, ci) in row" :key="ci" class="edit-cell" :style="{ minWidth: colWidths[ci] + 'px' }">
                <div
                  contenteditable="true"
                  class="edit-input"
                  :data-row="ri"
                  :data-col="ci"
                  :class="{ 'edit-cell-empty': !cell }"
                  @input="onCellInput($event, ri, ci)"
                  @keydown="onCellKeydown"
                >
                  {{ cell || '' }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 无法预览 -->
    <div v-if="mode === 'none'" class="empty-hint" style="pointer-events: auto">
      <AppIcon name="office" :size="52" />
      <div style="max-width: 380px; text-align: center; line-height: 1.8; white-space: pre-line">
        {{ noPreviewHint }}
      </div>
      <button v-if="!noFile" class="btn primary" @click="download">下载文件</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'
import { get, post, put } from '../api/http'
import { rawUrl, downloadUrl, userShareApi } from '../api/modules'
import { useSession } from '../stores/session'
import { useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()
const session = useSession()
const toast = useToast()
const ext = computed(() => (props.props?.ext || '').toLowerCase())

// 文件来源：本地盘（policyId+path）或共享盘（shareId+rel，perm 来自共享）
const isShared = computed(() => !!props.props?.shareId)
const canWriteFile = computed(() => !isShared.value || props.props?.perm === 'rw')

const mode = ref<'ds' | 'pdf' | 'static' | 'none'>('none')
const dsError = ref('')
const staticHost = ref<HTMLDivElement>()
const docxHost = ref<HTMLDivElement>()
const pptxHost = ref<HTMLDivElement>()
const editBody = ref<HTMLDivElement>()
const sheets = ref<string[]>([])
const sheetIdx = ref(0)
const sheetHtml = ref('')
let editor: any = null

const editableData = ref<string[][]>([])
const colWidths = ref<number[]>([])
const editing = ref(false)
const saving = ref(false)

const isEditable = computed(() =>
  (ext.value === 'xlsx' || ext.value === 'xls' || ext.value === 'csv') && !editor && canWriteFile.value
)
const fallbackMode = computed(() => mode.value !== 'ds')
// 缓存穿透计数：保存后递增，强制 iframe/文档重新拉取最新内容
const cacheBust = ref(0)
const rawSrc = computed(() => (isShared.value
  ? userShareApi.rawUrl(props.props.shareId, props.props.rel)
  : rawUrl(props.props.policyId, props.props.path)) + '&b=' + cacheBust.value)
const noFile = computed(() => !props.props?.path && !props.props?.shareId)
const noPreviewHint = computed(() => {
  if (noFile.value) {
    return '未打开任何文档。\n在文件资源管理器中双击 Office 文件即可打开编辑（或右键「打开方式 → Office 编辑器」）。'
  }
  if (ext.value === 'ppt') {
    return '旧版 .ppt 格式暂不支持在线预览，请下载后用本地 PowerPoint 打开。'
  }
  if (ext.value === 'pptx') {
    return 'PPT 解析失败（文件可能已损坏或加密），请下载后查看。'
  }
  if (['odt', 'ods', 'odp', 'rtf'].includes(ext.value)) {
    return 'OpenDocument/RTF 格式需在线 Office 服务（Document Server）才能预览，请在管理控制台配置后重试，或下载后用本地 Office 打开。'
  }
  return '此格式无法在线预览。'
})

// 解析 !ref（如 "A1:F20"）为行列数；支持多字母列（AA、AB...）
function refSize(ref?: string): { rows: number; cols: number } {
  if (!ref) return { rows: 1, cols: 1 }
  const m = ref.match(/:([A-Za-z]+)(\d+)$/)
  if (!m) return { rows: 1, cols: 1 }
  let cols = 0
  for (const ch of m[1].toUpperCase()) cols = cols * 26 + (ch.charCodeAt(0) - 64)
  return { rows: parseInt(m[2]), cols }
}

// 单元格取显示值（w 为格式化文本，日期等可读性更好）
function cellText(cell: any): string {
  if (!cell) return ''
  return String(cell.w ?? cell.v ?? '')
}

// 列序号（1-based）转列地址（A、B...Z、AA...）
function colAddr(c: number): string {
  let s = ''
  while (c > 0) {
    const m = (c - 1) % 26
    s = String.fromCharCode(65 + m) + s
    c = Math.floor((c - 1) / 26)
  }
  return s
}

async function startEdit() {
  try {
    // 重新从服务器获取文件并解析为可编辑格式
    const buf = await fetchBuffer()
    const XLSX: any = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'array' })
    const sname = wb.SheetNames[sheetIdx.value] || wb.SheetNames[0]
    const sheet = wb.Sheets[sname]
    const MAX_EDIT_ROWS = 300
    const MAX_EDIT_COLS = 100
    const { rows: rawRow, cols: rawCol } = refSize(sheet['!ref'])
    // 限制可编辑区域：超大表格逐格渲染 contenteditable 会导致浏览器卡死
    const maxRow = Math.min(rawRow, MAX_EDIT_ROWS)
    const maxCol = Math.min(rawCol, MAX_EDIT_COLS)

    const data: string[][] = []
    for (let r = 1; r <= maxRow; r++) {
      const row: string[] = []
      for (let c = 1; c <= maxCol; c++) {
        const cell = sheet[colAddr(c) + r]
        row.push(cellText(cell))
      }
      data.push(row)
    }

    // 计算列宽（基于内容长度）
    const widths: number[] = []
    for (let c = 0; c < maxCol; c++) {
      let maxLen = 8
      for (let r = 0; r < data.length; r++) {
        const len = String(data[r][c] || '').length
        if (len > maxLen) maxLen = len
      }
      widths.push(Math.min(maxLen * 8 + 24, 200))
    }

    // 超出可编辑范围时提示（仅编辑左上区域，避免超大表格卡死）
    if (rawRow > maxRow || rawCol > maxCol) {
      toast.show(`表格较大（${rawRow} 行 × ${rawCol} 列），仅编辑左上 ${maxRow} 行 × ${maxCol} 列`)
    }

    // 添加 50 行空行作为扩展空间（固定次数，避免死循环；总量限制 300 行防大表卡顿）
    for (let i = 0; i < 50 && data.length < 300; i++) {
      const emptyRow: string[] = []
      for (let c = 0; c < maxCol; c++) emptyRow.push('')
      data.push(emptyRow)
    }

    editableData.value = data
    colWidths.value = widths
    editing.value = true
  } catch (e: any) {
    toast.error('无法编辑：' + (e?.message || '文件解析失败'))
  }
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  if (saving.value || !editing.value) return
  saving.value = true
  try {
    const XLSX: any = await import('xlsx')
    // 读取原文件：既保留其他工作表，也保留当前表超出可编辑范围之外的数据
    let wb: any
    try {
      const orig = await fetchBuffer()
      wb = XLSX.read(orig, { type: 'array' })
    } catch {
      wb = XLSX.utils.book_new()
    }
    const sname = wb.SheetNames?.[sheetIdx.value] || 'Sheet1'
    // 在原表上逐格回写编辑结果（编辑器 0-based 坐标 → Excel 1-based 地址）
    // 只覆盖编辑到的区域，其余单元格（含被截断的大表区域）原样保留，避免保存丢数据
    let ws: any
    if (wb.SheetNames?.includes(sname)) {
      ws = wb.Sheets[sname]
    } else {
      ws = XLSX.utils.aoa_to_sheet([])
      XLSX.utils.book_append_sheet(wb, ws, sname)
    }
    for (let r = 0; r < editableData.value.length; r++) {
      const row = editableData.value[r]
      for (let c = 0; c < row.length; c++) {
        const s = (row[c] ?? '').toString()
        const addr = colAddr(c + 1) + (r + 1)
        if (s === '') {
          delete ws[addr] // 清空单元格
        } else if (s.trim() !== '' && !isNaN(Number(s))) {
          ws[addr] = { t: 'n', v: Number(s) } // 纯数字恢复数值类型
        } else {
          ws[addr] = { t: 's', v: s }
        }
      }
    }

    // 按原扩展名选择导出格式，避免格式错乱
    const e = ext.value
    let bookType: string = 'xlsx'
    if (e === 'xls') bookType = 'biff8'
    else if (e === 'csv') bookType = 'csv'
    let buf: any = XLSX.write(wb, { type: 'array', bookType })
    if (e === 'csv') {
      // 加 UTF-8 BOM，保证 Excel 直接打开不乱码
      buf = new Uint8Array([0xef, 0xbb, 0xbf, ...new Uint8Array(buf)])
    }

    // 上传新文件（覆盖原文件）
    if (isShared.value) {
      // 共享盘：multipart 直传（rel=父目录；服务端 CreateFile 截断覆盖，ro 共享由后端 403）
      const parent = props.props.rel.substring(0, props.props.rel.lastIndexOf('/'))
      const fd = new FormData()
      fd.append('file', new Blob([buf], { type: 'application/octet-stream' }), props.props.name)
      fd.append('rel', parent)
      await post('/shared/' + props.props.shareId + '/upload', fd)
    } else {
      // 本地盘：分块上传会话（秒传直接返回）
      const initResp = await post('/upload/init', {
        policyId: props.props.policyId,
        parent: props.props.path.substring(0, props.props.path.lastIndexOf('/')) || '/',
        name: props.props.name,
        size: buf.byteLength,
        chunkSize: 8 * 1024 * 1024,
        hash: ''
      })

      if (!initResp.instant) {
        const chunkSize = 8 * 1024 * 1024
        const chunks: number = Math.ceil(buf.byteLength / chunkSize)
        for (let i = 0; i < chunks; i++) {
          const start = i * chunkSize
          const end = Math.min(start + chunkSize, buf.byteLength)
          await put(`/upload/chunk/${initResp.sessionId}/${i}`, buf.slice(start, end), {
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: 0
          })
        }
        await post('/upload/complete', { sessionId: initResp.sessionId })
      }
    }

    toast.success('保存成功')
    editing.value = false
    cacheBust.value++
    // 刷新静态预览，展示保存后的最新内容
    if (['xlsx', 'xls', 'csv'].includes(e)) await renderXlsx()
  } catch (e: any) {
    toast.error('保存失败: ' + (e.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

function onCellInput(e: Event, ri: number, ci: number) {
  // contenteditable 的 DOM 编辑回写到数据模型
  const text = (e.currentTarget as HTMLElement).textContent || ''
  editableData.value[ri][ci] = text
}

function onCellKeydown(e: KeyboardEvent) {
  // Tab 向右 / Enter 向下在单元格间导航
  if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault()
    const current = e.currentTarget as HTMLElement
    const ri = parseInt(current.getAttribute('data-row') || '0')
    const ci = parseInt(current.getAttribute('data-col') || '0')
    let nr = ri, nc = ci
    if (e.key === 'Tab') nc = ci + (e.shiftKey ? -1 : 1)
    else nr = ri + (e.shiftKey ? -1 : 1)
    if (nc >= 0 && nr >= 0) {
      const next = document.querySelector(`[data-row="${nr}"][data-col="${nc}"]`)
      if (next) (next as HTMLElement).focus()
    }
  }
}

// 静态预览
async function renderDocx() {
  try {
    const buf = await fetchBuffer()
    const { renderAsync } = await import('docx-preview')
    await renderAsync(buf, docxHost.value!, undefined, {
      className: 'cp-docx',
      inWrapper: true,
      ignoreWidth: false,
      breakPages: true,
      experimental: true
    })
  } catch (e: any) {
    mode.value = 'none'
  }
}

// xlsx 预览 HTML 的 DOM 净化：白名单只放行表格类标签与安全属性，
// 其余标签（script/style/iframe/img 等）整体替换为纯文本，事件属性与
// javascript:/expression()/url() 值一律剔除——恶意构造的表格文件即便携带
// HTML 载荷，渲染在本域也不会执行（XSS 兜底，sheet_to_html 输出同样过一遍）
const SHEET_ALLOWED_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'COL', 'COLGROUP', 'BR', 'SPAN', 'DIV', 'P', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'FONT'])
function sanitizeSheetHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      walk(child)
      if (!SHEET_ALLOWED_TAGS.has(child.tagName)) {
        const span = doc.createElement('span')
        span.textContent = child.textContent ?? ''
        child.replaceWith(span)
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        const n = attr.name.toLowerCase()
        const dangerous = /javascript:|vbscript:|expression\(|url\(/i.test(attr.value)
        if (n === 'style') {
          if (dangerous) child.removeAttribute(attr.name)
        } else if (dangerous || !['colspan', 'rowspan', 'class'].includes(n)) {
          child.removeAttribute(attr.name)
        }
      }
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

async function renderXlsx() {
  try {
    const buf = await fetchBuffer()
    const XLSX: any = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'array' })
    sheets.value = wb.SheetNames
    const MAX_PREVIEW_ROWS = 2000
    const render = (idx: number) => {
      const sh = wb.Sheets[wb.SheetNames[idx]]
      const { rows, cols } = refSize(sh['!ref'])
      if (rows > MAX_PREVIEW_ROWS) {
        // 超大表限制预览行数，避免只读 DOM 过大导致打开卡顿；完整内容请下载
        const oldRef = sh['!ref']
        sh['!ref'] = 'A1:' + colAddr(Math.max(cols, 1)) + MAX_PREVIEW_ROWS
        let html = sanitizeSheetHtml(XLSX.utils.sheet_to_html(sh, { header: '', footer: '' }))
        sh['!ref'] = oldRef
        sheetHtml.value = html + `<tr><td colspan="${Math.max(cols, 1)}" style="text-align:center;color:#98a0a8;padding:10px">… 仅预览前 ${MAX_PREVIEW_ROWS} 行（共 ${rows} 行），完整内容请下载查看 …</td></tr>`
      } else {
        sheetHtml.value = sanitizeSheetHtml(XLSX.utils.sheet_to_html(sh, { header: '', footer: '' }))
      }
    }
    render(0)
    watchSheetIdx(render)
  } catch (e: any) {
    mode.value = 'none'
  }
}

function watchSheetIdx(render: (i: number) => void) {
  watch(sheetIdx, i => render(i))
}

// pptx 离线预览（无需 ONLYOFFICE Document Server）
// API：init(dom, { mode:'list', width }) → previewer.preview(ArrayBuffer)；
// list 模式把所有幻灯片按 width 等比缩放后纵向排列
let pptxPreviewer: any = null
async function renderPptx() {
  const host = pptxHost.value
  if (!host) return
  try {
    const buf = await fetchBuffer()
    const pptx: any = await import('pptx-preview')
    const doInit = pptx.init || pptx.default?.init
    if (typeof doInit !== 'function') throw new Error('pptx-preview 不可用')
    if (pptxPreviewer) { try { pptxPreviewer.destroy() } catch {} pptxPreviewer = null }
    host.innerHTML = ''
    // 视口宽度 = 预览容器可用宽度（左右各 18px padding）
    const w = (staticHost.value ? staticHost.value.clientWidth - 36 : 0) || host.clientWidth || 640
    pptxPreviewer = doInit(host, { mode: 'list', width: Math.max(320, w) })
    await pptxPreviewer.preview(buf)
  } catch (e: any) {
    console.warn('pptx preview failed', e)
    mode.value = 'none'
  }
}

async function fetchBuffer(): Promise<ArrayBuffer> {
  const resp = await axios.get(rawSrc.value, {
    responseType: 'arraybuffer',
    headers: { Authorization: 'Bearer ' + (await import('../api/http')).getToken() }
  })
  return resp.data
}

async function initDs() {
  try {
    const qs = isShared.value
      ? `shareId=${props.props.shareId}&rel=${encodeURIComponent(props.props.rel)}`
      : `policyId=${props.props.policyId}&path=${encodeURIComponent(props.props.path)}`
    // 只读共享后端会强制 view，前端同步传 view 以便编辑器直接进入只读态
    const wantMode = (isShared.value && props.props?.perm !== 'rw') ? 'view' : (props.props.mode || 'edit')
    const d = await get<any>(`/office/config?${qs}&mode=${wantMode}`)
    await loadScript(d.documentServer + '/web-apps/apps/api/documents/api.js')
    editor = new (window as any).DocsAPI.DocEditor('cp-office-placeholder', {
      ...d.config,
      width: '100%',
      height: '100%',
      events: {
        onError: async () => {
          if (mode.value !== 'ds') return
          try { editor?.destroyEditor?.() } catch {}
          editor = null
          if (ext.value === 'docx') { mode.value = 'static'; await renderDocx() }
          else if (ext.value === 'pptx') { mode.value = 'static'; await renderPptx() }
          else if (['xlsx', 'xls', 'csv'].includes(ext.value)) { mode.value = 'static'; await renderXlsx() }
          else if (ext.value === 'pdf') { mode.value = 'pdf' }
          else mode.value = 'none' // 旧格式等无内置渲染器时明确提示，不留空白页
        }
      }
    })
  } catch (e: any) {
    if (ext.value === 'docx') { mode.value = 'static'; await renderDocx() }
    else if (ext.value === 'pptx') { mode.value = 'static'; await renderPptx() }
    else if (['xlsx', 'xls', 'csv'].includes(ext.value)) { mode.value = 'static'; await renderXlsx() }
    else if (ext.value === 'pdf') { mode.value = 'pdf' }
    else mode.value = 'none'
  }
}

onMounted(async () => {
  // 配置了 Document Server 时，所有 Office 文档一律进 ONLYOFFICE 在线编辑器（Cloudreve 模式：
  // 预览与编辑同一套真实编辑器 UI，权限决定 view/edit，保存回调自动归档旧版本）；
  // 未配置时回退内置静态预览，保证开箱可用
  const officeReady = session.site.officeConfigured
  const DS_EXTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp']
  if (officeReady && DS_EXTS.includes(ext.value)) {
    mode.value = 'ds'
    await initDs()
    return
  }
  if (ext.value === 'pdf') { mode.value = 'pdf'; return }
  if (ext.value === 'docx') { mode.value = 'static'; await renderDocx(); return }
  if (ext.value === 'pptx') { mode.value = 'static'; await renderPptx(); return }
  if (['xlsx', 'xls', 'csv'].includes(ext.value)) { mode.value = 'static'; await renderXlsx(); return }
  mode.value = 'none'
})

onBeforeUnmount(() => {
  try { editor?.destroyEditor?.() } catch {}
  try { pptxPreviewer?.destroy?.() } catch {}
  ;(window as any).__cpSheetRender = undefined
})

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).DocsAPI) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('无法加载 ONLYOFFICE api.js'))
    document.head.appendChild(s)
  })
}

function download() {
  if (isShared.value) {
    window.open(userShareApi.dlUrl(props.props.shareId, props.props.rel))
    return
  }
  window.open(downloadUrl(props.props.policyId, [props.props.path]))
}
</script>

<style scoped>
.ds-hint {
  flex: none; display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; font-size: 12px; color: #8a6d1a;
  background: #fdf6e3; border-bottom: 1px solid #f0e2b6; line-height: 1.5;
}
.static-preview {
  flex: 1; overflow: auto; background: #e8eaee; padding: 18px;
  display: flex; flex-direction: column; align-items: center;
}
.docx-host :deep(.cp-docx-wrapper) {
  background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  margin-bottom: 18px;
}
.docx-host :deep(.cp-docx-wrapper > section) { margin-bottom: 0; }
.xlsx-host {
  border-collapse: collapse; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  font-size: 12.5px; color: #222; user-select: text; margin-bottom: 24px;
}
.xlsx-host :deep(td) { border: 1px solid #d5dbe2; padding: 4px 10px; min-width: 60px; }
/* pptx-preview 库内联样式：wrapper 黑底 → 透明；幻灯片自带白底+居中 */
.pptx-host :deep(.pptx-preview-wrapper) {
  background: transparent !important;
}
.pptx-host :deep(.pptx-preview-slide-wrapper) {
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
}

/* 可编辑表格样式 */
.edit-preview {
  flex: 1; overflow: auto; background: #f5f6f7; display: flex; flex-direction: column;
}
.edit-header {
  padding: 8px 16px; border-bottom: 1px solid var(--stroke); background: var(--bg);
  display: flex; align-items: center; gap: 12px;
}
.edit-body {
  flex: 1; overflow: auto; padding: 12px;
}
.edit-table {
  border-collapse: collapse; background: #fff;
}
.edit-cell {
  border: 1px solid #e0e0e0; padding: 0; min-width: 80px;
}
.edit-input {
  padding: 4px 8px; min-height: 28px; outline: none;
  font-size: 13px; color: #222;
}
.edit-input:focus {
  background: #e3f2fd;
}
.edit-cell-empty .edit-input::after {
  content: '';
}
</style>
