<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { termApi, type SftpEntry } from '../../api/modules'
import { collectDropFiles } from '../../utils/drop'
import { copyText } from '../../utils/clipboard'

/**
 * SFTP 文件管理面板：浏览 / 新建 / 重命名 / 删除 / 上传（拖拽+进度）/ 下载
 */
const props = defineProps<{ connId: number }>()
const emit = defineEmits<{ (e: 'toast', msg: string, type?: 'ok' | 'err'): void }>()

const path = ref('/')
const entries = ref<SftpEntry[]>([])
const parent = ref('/')
const loading = ref(false)
const selected = ref('')
const dragOver = ref(false)

// 右键菜单
const ctx = reactive({ show: false, x: 0, y: 0, name: '' })
// 内联重命名
const renaming = ref('')
const renameVal = ref('')
// 对话框
const dialog = ref<null | { kind: 'mkdir' | 'delete'; name?: string; val: string }>(null)
// 上传队列
interface UploadItem { name: string; pct: number; state: 'uploading' | 'done' | 'error' }
const uploads = ref<UploadItem[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const crumbs = computed(() => {
  const parts = path.value.split('/').filter(Boolean)
  const out: { label: string; to: string }[] = [{ label: '/', to: '/' }]
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    out.push({ label: p, to: acc })
  }
  return out
})

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function iconOf(e: SftpEntry): { g: string; c: string } {
  if (e.type === 'dir') return { g: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z', c: '#f0b429' }
  const ext = e.name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    png: '#4cc2ff', jpg: '#4cc2ff', jpeg: '#4cc2ff', gif: '#4cc2ff', webp: '#4cc2ff', svg: '#4cc2ff', bmp: '#4cc2ff',
    mp4: '#bb9af7', mkv: '#bb9af7', mov: '#bb9af7', avi: '#bb9af7', webm: '#bb9af7',
    mp3: '#97d077', flac: '#97d077', wav: '#97d077', ogg: '#97d077',
    zip: '#ffcb6b', rar: '#ffcb6b', '7z': '#ffcb6b', tar: '#ffcb6b', gz: '#ffcb6b',
    sh: '#89ddff', py: '#89ddff', go: '#89ddff', js: '#89ddff', ts: '#89ddff', java: '#89ddff', c: '#89ddff', cpp: '#89ddff', rs: '#89ddff'
  }
  const docExt = ['txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'json', 'yml', 'yaml', 'xml', 'log', 'csv']
  const c = map[ext] || (docExt.includes(ext) ? '#d8dae3' : '#9aa0b0')
  return { g: 'M6 2h8l4 4v16H6V2zm8 0v4h4', c }
}

async function load(p?: string) {
  if (p !== undefined) path.value = p
  loading.value = true
  selected.value = ''
  renaming.value = ''
  try {
    const d = await termApi.fsList(props.connId, path.value)
    entries.value = d.entries
    parent.value = d.parent
    path.value = d.path
  } catch (e: any) {
    emit('toast', e.message || '加载失败', 'err')
  } finally {
    loading.value = false
  }
}

function open(e: SftpEntry) {
  if (e.type === 'dir') {
    const to = path.value === '/' ? '/' + e.name : path.value + '/' + e.name
    load(to)
  } else {
    download(e)
  }
}

function download(e: SftpEntry) {
  const p = path.value === '/' ? '/' + e.name : path.value + '/' + e.name
  const a = document.createElement('a')
  a.href = termApi.fsDownloadUrl(props.connId, p)
  a.download = e.name
  a.click()
  emit('toast', '开始下载 ' + e.name)
}

function pickUpload() { fileInput.value?.click() }
async function onPick(ev: Event) {
  const files = (ev.target as HTMLInputElement).files
  if (files && files.length) await uploadFiles(Array.from(files))
  ;(ev.target as HTMLInputElement).value = ''
}
async function uploadFiles(files: File[], overwrite = false) {
  for (const f of files) {
    // 文件夹上传/拖拽：按相对路径落到对应子目录（服务端自动建父目录）
    let dir = path.value
    let name = f.name
    const rel = ((f as any).__cpRel || (f as any).webkitRelativePath) as string | undefined
    if (rel) {
      const parts = rel.split('/')
      name = parts[parts.length - 1]
      if (parts.length > 1) dir = (path.value === '/' ? '/' : path.value + '/') + parts.slice(0, -1).join('/')
    }
    const item: UploadItem = { name: rel || f.name, pct: 0, state: 'uploading' }
    uploads.value.push(item)
    try {
      await termApi.fsUpload(props.connId, dir, name, f, overwrite, pct => { item.pct = pct })
      item.state = 'done'
      item.pct = 100
    } catch {
      item.state = 'error'
      emit('toast', '上传失败：' + name, 'err')
    }
  }
  load()
  setTimeout(() => { uploads.value = uploads.value.filter(u => u.state === 'uploading') }, 4000)
}
async function onDrop(ev: DragEvent) {
  ev.preventDefault()
  dragOver.value = false
  const dt = ev.dataTransfer
  if (!dt) return
  const r = await collectDropFiles(dt)
  if (r.problems.length) {
    console.warn('[CloudPan 拖拽读取失败]', r.problems)
    emit('toast', `部分拖入内容读取失败：${r.problems[0]}`, 'err')
  }
  // 空目录：没有文件上传就不会被自动建出来，这里显式创建（已存在不报错）
  if (r.emptyDirs.length) {
    for (const dir of r.emptyDirs) {
      const full = path.value === '/' ? '/' + dir : path.value + '/' + dir
      termApi.fsOp({ connId: props.connId, op: 'mkdir', path: full }).catch(() => {})
    }
  }
  if (!r.files.length) return
  for (const d of r.files) (d.file as any).__cpRel = d.rel
  uploadFiles(r.files.map(d => d.file))
}
function onExistingDrop(ev: DragEvent) {
  ev.preventDefault()
  const names = Array.from(ev.dataTransfer?.files || []).map(f => f.name)
  if (names.length && ctx.show) {
    // 拖到已选条目：目录 → 上传进该目录；文件 → 覆盖
    const e = entries.value.find(x => x.name === ctx.name)
    if (e?.type === 'dir') {
      const to = path.value === '/' ? '/' + e.name : path.value + '/' + e.name
      load(to)
      setTimeout(() => uploadFiles(Array.from(ev.dataTransfer!.files)), 0)
    } else if (e) {
      uploadFiles(Array.from(ev.dataTransfer!.files), true)
    }
  }
}

function startRename(e: SftpEntry) { renaming.value = e.name; renameVal.value = e.name }
async function commitRename() {
  const old = renaming.value
  renaming.value = ''
  const nv = renameVal.value.trim()
  if (!nv || nv === old || nv.includes('/')) return
  const base = path.value === '/' ? '' : path.value
  try {
    await termApi.fsOp({ connId: props.connId, op: 'rename', path: base + '/' + old, target: base + '/' + nv })
    emit('toast', '已重命名为 ' + nv)
    load()
  } catch (e: any) { emit('toast', e.message, 'err') }
}

function showCtx(ev: MouseEvent, e: SftpEntry) {
  ctx.show = true
  ctx.name = e.name
  const hostEl = (ev.currentTarget as HTMLElement).closest('.sf-panel') as HTMLElement
  const r = hostEl?.getBoundingClientRect()
  ctx.x = Math.min(ev.clientX - (r?.left || 0), (r?.width || 300) - 150)
  ctx.y = Math.min(ev.clientY - (r?.top || 0), (r?.height || 400) - 150)
}
function ctxAction(a: string) {
  ctx.show = false
  const e = entries.value.find(x => x.name === ctx.name)
  if (!e) return
  if (a === 'open') open(e)
  if (a === 'download') download(e)
  if (a === 'rename') startRename(e)
  if (a === 'delete') dialog.value = { kind: 'delete', name: e.name, val: '' }
  // HTTP 环境（非安全上下文）下 navigator.clipboard 不可用，copyText 内部回退 execCommand
  if (a === 'copy') copyText(fullPath(e.name)).then(ok => emit('toast', ok ? '路径已复制' : '复制失败，请手动复制'))
}
function fullPath(name: string) {
  return path.value === '/' ? '/' + name : path.value + '/' + name
}

function openMkdir() { dialog.value = { kind: 'mkdir', val: '' } }
async function commitDialog() {
  const d = dialog.value
  if (!d) return
  const v = d.val.trim()
  if (!v) return
  if (d.kind === 'mkdir') {
    try {
      await termApi.fsOp({ connId: props.connId, op: 'mkdir', path: fullPath(v) })
      emit('toast', '目录已创建')
      dialog.value = null
      load()
    } catch (e: any) { emit('toast', e.message, 'err') }
  } else {
    try {
      await termApi.fsOp({ connId: props.connId, op: 'delete', path: fullPath(d.name || '') })
      emit('toast', '已删除 ' + d.name)
      dialog.value = null
      load()
    } catch (e: any) { emit('toast', e.message, 'err') }
  }
}

onMounted(() => load())
onBeforeUnmount(() => { document.removeEventListener('click', closeCtx) })
function closeCtx() { ctx.show = false }
onMounted(() => document.addEventListener('click', closeCtx))

defineExpose({ refresh: () => load() })
</script>

<template>
  <div class="sf-panel"
       :class="{ 'sf-drag': dragOver }"
       @dragover.prevent="dragOver = true"
       @dragleave="dragOver = false"
       @drop.prevent="onDrop">
    <!-- 路径面包屑 -->
    <div class="sf-pathbar">
      <button class="sf-ico-btn" title="上级目录" :disabled="path === '/'" @click="load(parent)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="sf-crumbs">
        <template v-for="(c, i) in crumbs" :key="c.to">
          <span v-if="i > 0" class="sf-sep">/</span>
          <a class="sf-crumb" :class="{ cur: i === crumbs.length - 1 }" @click="load(c.to)">{{ c.label === '/' ? '根目录' : c.label }}</a>
        </template>
      </div>
      <button class="sf-ico-btn" title="刷新" :class="{ spin: loading }" @click="load()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
      </button>
    </div>

    <!-- 工具行 -->
    <div class="sf-toolbar">
      <button class="sf-btn" @click="openMkdir">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 11v4M10 13h4" /></svg>
        新建
      </button>
      <button class="sf-btn" @click="pickUpload">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" /></svg>
        上传
      </button>
      <button class="sf-btn" :disabled="!selected" @click="() => { const e = entries.find(x => x.name === selected); if (e) download(e) }">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" /></svg>
        下载
      </button>
      <input ref="fileInput" type="file" multiple hidden @change="onPick">
    </div>

    <!-- 文件列表 -->
    <div class="sf-list">
      <div v-if="loading && !entries.length" class="sf-empty">加载中…</div>
      <div v-else-if="!entries.length" class="sf-empty">
        <div class="sf-empty-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
        </div>
        空目录 —— 可拖拽文件到此处上传
      </div>
      <template v-else>
        <div v-for="e in entries" :key="e.name"
             class="sf-row" :class="{ sel: selected === e.name, ren: renaming === e.name }"
             draggable="false"
             @click="selected = e.name"
             @dblclick="open(e)"
             @contextmenu.prevent="showCtx($event, e)"
             @dragover.prevent
             @drop.prevent.stop="onExistingDrop($event)">
          <svg v-if="renaming !== e.name" class="sf-fico" :style="{ color: iconOf(e).c }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path :d="iconOf(e).g" /></svg>
          <input v-else class="sf-rename" v-model="renameVal"
                 @click.stop @keyup.enter="commitRename" @keyup.esc="renaming = ''" @blur="commitRename" autofocus>
          <span v-if="renaming !== e.name" class="sf-name" :title="e.name">{{ e.name }}</span>
          <span class="sf-meta"><span>{{ e.type === 'dir' ? '—' : fmtSize(e.size) }}</span><span>{{ e.modTime }}</span></span>
        </div>
      </template>
    </div>

    <!-- 上传队列 -->
    <div v-if="uploads.length" class="sf-uploads">
      <div v-for="u in uploads" :key="u.name" class="sf-up-item">
        <div class="sf-up-name">{{ u.name }}
          <span class="sf-up-pct">{{ u.state === 'error' ? '失败' : u.pct + '%' }}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" :class="{ bad: u.state === 'error' }" :style="{ width: u.pct + '%' }"></div></div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="ctx.show" class="ctx-menu sf-ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
        <a @click="ctxAction('open')"><span>打开</span></a>
        <a v-if="entries.find(x => x.name === ctx.name)?.type === 'file'" @click="ctxAction('download')"><span>下载</span></a>
        <a @click="ctxAction('rename')"><span>重命名</span></a>
        <a @click="ctxAction('copy')"><span>复制路径</span></a>
        <a class="danger" @click="ctxAction('delete')"><span>删除</span></a>
      </div>
    </Teleport>

    <!-- 对话框：新建 / 删除 -->
    <Teleport to="body">
      <div v-if="dialog" class="dialog-mask" @click.self="dialog = null">
        <div class="dialog sf-dialog">
          <h4>{{ dialog.kind === 'mkdir' ? '新建文件夹' : '删除确认' }}</h4>
          <p v-if="dialog.kind === 'delete'" class="sf-del-text">确定删除 <b>{{ dialog.name }}</b> 吗？目录将递归删除，此操作不可恢复。</p>
          <input v-else class="input" v-model="dialog.val" placeholder="文件夹名称"
                 @keyup.enter="commitDialog" @keyup.esc="dialog = null" autofocus>
          <div class="sf-dialog-btns">
            <button class="btn" @click="dialog = null">取消</button>
            <button class="btn primary" :class="{ danger: dialog.kind === 'delete' }" @click="commitDialog">
              {{ dialog.kind === 'mkdir' ? '创建' : '删除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 拖拽高亮提示 -->
    <div v-if="dragOver" class="sf-drop-hint">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" /></svg>
      松开上传到当前目录
    </div>
  </div>
</template>

<style scoped>
.sf-panel {
  position: relative;
  width: 340px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--bg50);
  border-left: 1px solid var(--stroke);
  overflow: hidden;
  transition: background .15s;
}
.sf-panel.sf-drag { background: color-mix(in srgb, var(--theme-1) 7%, var(--bg50)); }

.sf-pathbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--stroke);
  background: var(--card);
}
.sf-ico-btn {
  width: 26px; height: 26px;
  display: grid; place-items: center;
  border: none; background: transparent; color: var(--text-2);
  border-radius: var(--radius-sm);
  cursor: pointer; flex: none;
  transition: background .12s, color .12s;
}
.sf-ico-btn:hover:not(:disabled) { background: var(--hover); color: var(--text); }
.sf-ico-btn:disabled { opacity: .35; cursor: default; }
.sf-ico-btn.spin svg { animation: sfs 0.8s linear infinite; }
@keyframes sfs { to { transform: rotate(360deg) } }

.sf-crumbs {
  flex: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  font-size: 12px;
  overflow: hidden;
}
.sf-crumb {
  color: var(--theme-1);
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 4px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-crumb:hover { background: var(--hover); }
.sf-crumb.cur { color: var(--text); font-weight: 600; cursor: default; }
.sf-sep { color: var(--text-3); }

.sf-toolbar {
  display: flex;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--stroke);
}
.sf-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--stroke-b);
  background: var(--card);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all .12s;
}
.sf-btn:hover:not(:disabled) { border-color: var(--theme-1); color: var(--theme-1); }
.sf-btn:disabled { opacity: .4; cursor: default; }

.sf-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.sf-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background .1s;
  user-select: none;
}
.sf-row:hover { background: var(--hover); }
.sf-row.sel { background: color-mix(in srgb, var(--theme-1) 10%, transparent); border-left-color: var(--theme-1); }
.sf-fico { flex: none; }
.sf-name {
  flex: 1;
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-rename {
  flex: 1;
  font-size: 12.5px;
  padding: 2px 6px;
  border: 1px solid var(--theme-1);
  border-radius: 5px;
  background: var(--card);
  color: var(--text);
  outline: none;
  min-width: 0;
}
.sf-meta {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 10.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}
.sf-empty {
  padding: 42px 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.sf-empty-icon { opacity: .4; }

.sf-uploads {
  border-top: 1px solid var(--stroke);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 130px;
  overflow-y: auto;
  background: var(--card);
}
.sf-up-name {
  font-size: 11px;
  color: var(--text-2);
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-up-pct { color: var(--theme-1); flex: none; margin-left: 8px; }
.progress-track { height: 4px; border-radius: 2px; background: var(--hover); overflow: hidden; }
.progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
  transition: width .2s;
}
.progress-fill.bad { background: var(--danger); }

.sf-ctx {
  min-width: 130px;
  z-index: 300;
  position: fixed;
}

.sf-dialog { width: 320px; }
.sf-del-text { font-size: 13px; color: var(--text-2); line-height: 1.6; }
.sf-dialog-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.sf-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--theme-1);
  font-size: 13px;
  font-weight: 600;
  background: color-mix(in srgb, var(--theme-1) 10%, var(--bg50));
  border: 2px dashed var(--theme-1);
  border-radius: var(--radius);
  pointer-events: none;
  z-index: 5;
}
</style>
