<template>
  <!-- 压缩包浏览器（参照可道云 zip 窗口：头部 图标+名称+大小；表格 名称/大小/修改时间 可展开树；行右键 打开/下载/解压） -->
  <div class="app-root av-root">
    <!-- 头部：文件图标 + 名称 + 大小 -->
    <div class="av-head">
      <AppIcon name="archive" :size="36" />
      <div class="av-head-info">
        <div class="av-name" :title="name">{{ name }}</div>
        <div class="av-sub">
          大小 {{ fmtSize(size) }}
          <template v-if="meta.format"> · {{ meta.format }}{{ meta.compress ? '（' + compressLabel() + '压缩）' : '' }}</template>
          <template v-if="entries.length"> · {{ entries.length }} 个条目</template>
        </div>
      </div>
    </div>

    <!-- 工具栏：刷新 / zip 编码 / 密码 / 解压操作 / 下载整包 -->
    <div class="app-toolbar">
      <button class="tool-btn" :disabled="loading" @click="load" title="重新读取归档列表">
        <AppIcon name="refresh" :size="14" />刷新
      </button>
      <select v-if="ext === 'zip'" class="tool-select" v-model="encoding" title="文件名编码（名称乱码时切换）" @change="load">
        <option value="">UTF-8</option>
        <option value="gbk">GBK</option>
        <option value="gb18030">GB18030</option>
        <option value="big5">Big5</option>
        <option value="shiftjis">Shift-JIS</option>
        <option value="euckr">EUC-KR</option>
        <option value="cp936">CP936</option>
        <option value="windows-1252">Windows-1252</option>
        <option value="iso-8859-1">ISO-8859-1</option>
      </select>
      <input v-if="ext === '7z' || ext === 'rar'" class="tool-input av-pwd" type="password" v-model="password"
        placeholder="压缩包密码" @keyup.enter="load" />
      <div style="flex: 1"></div>
      <button class="tool-btn" @click="extractTo(null, '')" :disabled="loading">
        <AppIcon name="download" :size="14" />解压到当前
      </button>
      <button class="tool-btn" @click="openDstDlg(null)" :disabled="loading">
        <AppIcon name="folder" :size="14" />解压到…
      </button>
      <button class="tool-btn" @click="downloadAll" title="下载整个压缩包">
        <AppIcon name="download" :size="14" />下载整包
      </button>
    </div>

    <!-- 主体：名称/大小/修改时间 表格（扁平条目本地推导为可展开目录树） -->
    <div class="av-body">
      <div v-if="loading && !entries.length" class="av-empty">正在读取归档…</div>
      <div v-else-if="loadErr" class="av-empty av-err">{{ loadErr }}</div>
      <template v-else>
        <div class="av-colhead">
          <div class="av-c-name">名称</div>
          <div class="av-c-size">大小</div>
          <div class="av-c-time">修改时间</div>
        </div>
        <div class="av-rows">
          <div v-if="!rows.length" class="av-empty">（空归档）</div>
          <div v-for="r in rows" :key="r.node.path" class="av-row" :class="{ sel: sel === r.node.path }"
            @click="sel = r.node.path"
            @dblclick="onDblClick(r.node)"
            @contextmenu.stop.prevent="showMenu(r.node, $event)">
            <div class="av-c-name">
              <span class="av-indent" :style="{ width: r.depth * 18 + 'px' }"></span>
              <span v-if="r.node.isDir" class="av-caret" :class="{ open: expanded.has(r.node.path) }">▸</span>
              <span v-else class="av-caret"></span>
              <AppIcon :name="r.node.isDir ? 'folder' : 'file'" :size="15" class="av-ico" />
              <span class="av-nm" :title="r.node.path">{{ r.node.name }}</span>
            </div>
            <div class="av-c-size">{{ r.node.isDir ? '' : fmtSize(r.node.size) }}</div>
            <div class="av-c-time">{{ r.node.isDir ? '' : fmtTime(r.node.mtime) }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 预览弹窗：图片 / PDF / 文本（单条目流式直读，不落盘） -->
    <div class="dialog-mask" v-if="preview" @click.self="preview = null">
      <div class="dialog av-preview-dlg">
        <div class="av-pv-head">
          <AppIcon :name="preview.node.isDir ? 'folder' : 'file'" :size="16" />
          <b :title="preview.node.path">{{ preview.node.name }}</b>
          <span class="av-pv-size">{{ fmtSize(preview.node.size) }}</span>
          <div style="flex: 1"></div>
          <button class="tool-btn" title="下载" @click="downloadEntry(preview.node)"><AppIcon name="download" :size="14" /></button>
          <button class="tool-btn" title="关闭" @click="preview = null"><AppIcon name="close" :size="14" /></button>
        </div>
        <div class="av-pv-body">
          <div v-if="preview.loading" class="av-empty">加载预览中…</div>
          <template v-else>
            <img v-if="preview.kind === 'image'" :src="preview.url" :alt="preview.node.name" style="max-width: 100%; max-height: 100%; object-fit: contain; margin: auto; display: block" />
            <iframe v-else-if="preview.kind === 'pdf'" :src="preview.url" style="width: 100%; height: 100%; border: none; background: #525659"></iframe>
            <pre v-else-if="preview.kind === 'text'" class="av-pv-text" :title="preview.node.name">{{ preview.text }}<span v-if="preview.truncated" class="av-pv-more">
（文件超过 2MB，仅显示开头部分）</span></pre>
            <div v-else class="av-empty">该类型暂不支持在线预览</div>
          </template>
        </div>
      </div>
    </div>

    <!-- 解压到… 对话框：选目标目录（与压缩包同盘）+ 密码 + 编码 -->
    <div class="dialog-mask" v-if="dstShow" @click.self="dstShow = false">
      <div class="dialog" style="width: 460px">
        <h3>解压到…（{{ dstNode ? dstNode.path : '整个压缩包' }}）</h3>
        <div class="row">
          <label>目标目录</label>
          <div style="font-size: 12.5px; color: var(--text-2); margin-bottom: 6px">
            <span style="cursor: pointer" @click="pickCrumb(0)">根目录</span>
            <template v-for="(c, i) in dstCrumb" :key="i">
              <span style="opacity: 0.5"> › </span><span style="cursor: pointer" @click="pickCrumb(i + 1)">{{ c.name }}</span>
            </template>
          </div>
          <div style="max-height: 170px; overflow: auto; border: 1px solid var(--stroke); border-radius: 8px">
            <div v-for="d in dstDirs" :key="d.path" class="av-dir-item"
              :style="{ background: d.path === dstDir ? 'var(--hover, rgba(127,127,127,0.12))' : '' }" @click="pickDir(d)">
              <AppIcon name="folder" :size="15" />{{ d.name }}
            </div>
            <div v-if="!dstDirs.length" style="padding: 12px; font-size: 12px; color: var(--text-3)">（无子文件夹，解压到当前目录）</div>
          </div>
        </div>
        <div class="row" v-if="ext === '7z' || ext === 'rar'">
          <label>密码</label>
          <input class="input" type="password" v-model="dstPwd" placeholder="压缩包密码（留空为无密码）" style="width: 100%" />
        </div>
        <div class="row" v-if="ext === 'zip'">
          <label>文件名编码</label>
          <select class="input" v-model="dstEnc" style="width: 100%">
            <option value="">UTF-8</option>
            <option value="gbk">GBK</option>
            <option value="gb18030">GB18030</option>
            <option value="big5">Big5</option>
            <option value="shiftjis">Shift-JIS</option>
            <option value="euckr">EUC-KR</option>
            <option value="cp936">CP936</option>
            <option value="windows-1252">Windows-1252</option>
            <option value="iso-8859-1">ISO-8859-1</option>
          </select>
        </div>
        <div class="row" style="font-size: 12px; color: var(--text-3)">
          解压为后台任务，进度可在「任务中心」查看；目标目录已存在同名文件将被覆盖
        </div>
        <div v-if="dstMsg" style="font-size: 12.5px; color: #ff8a80; margin-bottom: 8px">{{ dstMsg }}</div>
        <div class="actions">
          <button class="btn" @click="dstShow = false">取消</button>
          <button class="btn primary" :disabled="dstBusy" @click="doDstExtract">{{ dstBusy ? '提交中…' : '开始解压' }}</button>
        </div>
      </div>
    </div>

    <!-- 属性对话框 -->
    <div class="dialog-mask" v-if="propNode" @click.self="propNode = null">
      <div class="dialog" style="width: 380px">
        <h3>属性</h3>
        <div class="av-prop-grid">
          <span>名称</span><b>{{ propNode.name }}</b>
          <span>归档内路径</span><b style="word-break: break-all">{{ propNode.path }}</b>
          <span>类型</span><b>{{ propNode.isDir ? '目录' : '文件' }}</b>
          <template v-if="!propNode.isDir">
            <span>大小</span><b>{{ fmtSize(propNode.size) }}</b>
            <span>修改时间</span><b>{{ fmtTime(propNode.mtime) }}</b>
          </template>
        </div>
        <div class="actions">
          <button class="btn primary" @click="propNode = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { fsApi, downloadUrl } from '../api/modules'
import { useContextMenu } from '../stores/ui'
import { useToast } from '../stores/dialog'

const props = defineProps<{ winId: number; props: any }>()
const toast = useToast()
const ctx = useContextMenu()

const policyId = ref(props.props?.policyId || 0)
const path = ref(props.props?.path || '')
const name = ref(props.props?.name || path.value.split('/').pop() || '压缩包')
const size = ref(props.props?.size || 0)
const ext = ref((props.props?.ext || (name.value.split('.').pop() || '')).toLowerCase())

const loading = ref(false)
const loadErr = ref('')
const meta = reactive<{ format: string; compress: string }>({ format: '', compress: '' })
const entries = ref<{ name: string; size: number; mtime: number; isDir: boolean }[]>([])
const encoding = ref('')
const password = ref('')
const sel = ref('')
const expanded = ref<Set<string>>(new Set())

// ---- 扁平条目 → 可展开目录树（本地推导，与可道云 zip 窗口一致）----
interface TreeNode { name: string; path: string; isDir: boolean; size: number; mtime: number; children: TreeNode[] }
const root = ref<TreeNode>({ name: '/', path: '', isDir: true, size: 0, mtime: 0, children: [] })

function buildTree(list: typeof entries.value) {
  const r: TreeNode = { name: '/', path: '', isDir: true, size: 0, mtime: 0, children: [] }
  for (const e of list) {
    const segs = e.name.split('/')
    let cur = r
    for (let i = 0; i < segs.length; i++) {
      const isLast = i === segs.length - 1
      const p = cur.path ? cur.path + '/' + segs[i] : segs[i]
      let next = cur.children.find(c => c.name === segs[i])
      if (!next) {
        next = { name: segs[i], path: p, isDir: false, size: 0, mtime: 0, children: [] }
        cur.children.push(next)
      }
      if (isLast) {
        next.isDir = e.isDir
        next.size = e.size
        next.mtime = e.mtime
        if (e.isDir && !next.children.length) next.children = []
      } else if (!next.isDir) {
        next.isDir = true // 路径段隐含的中间目录
      }
      cur = next
    }
  }
  const sortN = (n: TreeNode) => {
    n.children.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
    n.children.forEach(sortN)
  }
  sortN(r)
  root.value = r
  // 默认展开第一层目录
  expanded.value = new Set(r.children.filter(c => c.isDir).map(c => c.path))
}
const rows = computed(() => {
  const out: { node: TreeNode; depth: number }[] = []
  const walk = (n: TreeNode, depth: number) => {
    for (const c of n.children) {
      out.push({ node: c, depth })
      if (c.isDir && expanded.value.has(c.path)) walk(c, depth + 1)
    }
  }
  walk(root.value, 0)
  return out
})
function toggle(node: TreeNode) {
  if (!node.isDir) return
  const s = new Set(expanded.value)
  if (s.has(node.path)) s.delete(node.path)
  else s.add(node.path)
  expanded.value = s
}
function onDblClick(node: TreeNode) {
  if (node.isDir) toggle(node)
  else openPreview(node)
}

// ---- 列表加载（zip 编码 / 7z 密码可切换后重读）----
async function load() {
  loading.value = true
  loadErr.value = ''
  try {
    const d = await fsApi.archiveList(policyId.value, path.value, encoding.value, password.value)
    meta.format = d.meta?.format || ''
    meta.compress = d.meta?.compress || ''
    entries.value = d.entries || []
    buildTree(entries.value)
  } catch (e: any) {
    loadErr.value = e?.message || '读取失败'
  } finally {
    loading.value = false
  }
}

// ---- 条目 URL（单文件流式直读，带登录态令牌）----
function rawEntryUrl(node: TreeNode) {
  return fsApi.archiveRawUrl(policyId.value, path.value, node.path, encoding.value, password.value)
}
function downloadEntry(node: TreeNode) {
  if (node.isDir) { toast.error('目录请使用「解压」操作'); return }
  window.open(rawEntryUrl(node))
}
function downloadAll() {
  window.open(downloadUrl(policyId.value, [path.value]))
}

// ---- 打开：包内单文件预览（图片 / PDF / 文本）----
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico']
const TEXT_EXTS = ['txt', 'md', 'log', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'css', 'yml', 'yaml', 'ini', 'conf', 'sql', 'sh']
const preview = ref<{ node: TreeNode; kind: string; url: string; text?: string; loading?: boolean; truncated?: boolean } | null>(null)
function openPreview(node: TreeNode) {
  if (node.isDir) { toast.error('目录不能预览'); return }
  const ext = (node.name.split('.').pop() || '').toLowerCase()
  const url = rawEntryUrl(node)
  if (IMG_EXTS.includes(ext)) {
    preview.value = { node, kind: 'image', url }
  } else if (ext === 'pdf') {
    preview.value = { node, kind: 'pdf', url }
  } else if (TEXT_EXTS.includes(ext)) {
    preview.value = { node, kind: 'text', url, loading: true }
    fetch(url).then(async r => {
      if (!r.ok) throw new Error('预览加载失败')
      const len = Number(r.headers.get('content-length') || 0)
      const text = await r.text()
      const truncated = len > 2 * 1024 * 1024 || text.length > 2 * 1024 * 1024
      if (preview.value?.node.path === node.path) {
        preview.value = { ...preview.value, loading: false, text: truncated ? text.slice(0, 2 * 1024 * 1024) : text, truncated }
      }
    }).catch(e => {
      if (preview.value?.node.path === node.path) preview.value = { node, kind: 'text', url, loading: false, text: '加载失败：' + e.message }
    })
  } else {
    toast.error('该类型暂不支持在线预览，请使用「下载」')
  }
}

// ---- 行右键菜单（可道云同款：打开/下载/解压到当前/解压到…/属性）----
function maskOf(node: TreeNode) {
  // 目录 = 子树（保留层级）；文件 = 平铺到目标目录
  return node.isDir ? node.path + '/' : node.path
}
function showMenu(node: TreeNode, e: MouseEvent) {
  sel.value = node.path
  const items: any[] = [
    { label: '打开', icon: 'preview', onClick: () => onDblClick(node) },
    { label: '下载', icon: 'download', disabled: node.isDir, onClick: () => downloadEntry(node) },
    { separator: true },
    { label: '解压到当前', icon: 'archive', onClick: () => extractTo(node) },
    { label: '解压到…', icon: 'folder', onClick: () => openDstDlg(node) },
    { separator: true },
    { label: '属性', icon: 'info', onClick: () => { propNode.value = node } }
  ]
  ctx.show(e.clientX, e.clientY, items)
}
const propNode = ref<TreeNode | null>(null)

// ---- 解压提交（后台任务；进度在任务中心）----
async function extractTo(node: TreeNode | null, opts: { dst?: string; pwd?: string; enc?: string } = {}) {
  const mask = node ? maskOf(node) : ''
  try {
    await fsApi.archive(policyId.value, [path.value], name.value, true, {
      password: opts.pwd !== undefined ? opts.pwd : password.value,
      encoding: opts.enc !== undefined ? opts.enc : encoding.value,
      mask,
      dst: opts.dst || ''
    })
    const parent = path.value.slice(0, path.value.lastIndexOf('/')) || '/'
    window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId: policyId.value, path: opts.dst || parent } }))
    toast.success('解压任务已开始，请在「任务中心」查看进度')
  } catch (e: any) {
    toast.error(e?.message || '解压提交失败')
  }
}

// ---- 解压到… 对话框（目录选择器：与压缩包同盘）----
const dstShow = ref(false)
const dstNode = ref<TreeNode | null>(null)
const dstDir = ref('/')
const dstDirs = ref<{ name: string; path: string }[]>([])
const dstCrumb = ref<{ name: string; path: string }[]>([])
const dstPwd = ref('')
const dstEnc = ref('')
const dstBusy = ref(false)
const dstMsg = ref('')
async function loadDstDir(dir: string) {
  try {
    const d = await fsApi.list(policyId.value, dir)
    dstDir.value = dir
    dstDirs.value = (d.items || []).filter((i: any) => i.isDir).map((i: any) => ({ name: i.name, path: i.path }))
  } catch (e: any) { dstMsg.value = e?.message || '目录读取失败' }
}
async function openDstDlg(node: TreeNode | null) {
  dstNode.value = node
  dstCrumb.value = []
  dstPwd.value = password.value
  dstEnc.value = encoding.value
  dstMsg.value = ''
  dstShow.value = true
  await loadDstDir('/')
}
function pickDir(d: { name: string; path: string }) {
  dstCrumb.value = [...dstCrumb.value, d]
  loadDstDir(d.path)
}
function pickCrumb(i: number) {
  dstCrumb.value = dstCrumb.value.slice(0, i)
  loadDstDir(i === 0 ? '/' : dstCrumb.value[i - 1].path)
}
async function doDstExtract() {
  dstBusy.value = true
  dstMsg.value = ''
  try {
    await extractTo(dstNode.value, { dst: dstDir.value, pwd: dstPwd.value, enc: dstEnc.value })
    dstShow.value = false
  } catch (e: any) {
    dstMsg.value = e?.message || '提交失败'
  } finally {
    dstBusy.value = false
  }
}

// ---- 格式化工具 ----
function fmtSize(n: number) {
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}
function fmtTime(s: number) {
  if (!s) return ''
  const d = new Date(s * 1000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function compressLabel() {
  const map: Record<string, string> = { gzip: 'GZIP', bzip2: 'BZIP2', xz: 'XZ' }
  return map[meta.compress] || meta.compress
}

onMounted(load)
</script>

<style scoped>
.av-root { display: flex; flex-direction: column }
.av-head {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px 10px;
}
.av-head-info { min-width: 0 }
.av-name {
  font-size: 15px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.av-sub { font-size: 12px; color: var(--text-3); margin-top: 2px }
.av-pwd { width: 160px }
.tool-select, .tool-input {
  height: 26px; padding: 0 8px; font-size: 12px;
  background: var(--bg2, rgba(127, 127, 127, 0.08)); color: var(--text);
  border: 1px solid var(--stroke); border-radius: 6px; outline: none;
}
.av-body { flex: 1; overflow: auto; display: flex; flex-direction: column; padding-bottom: 8px }
.av-colhead, .av-row {
  display: grid;
  grid-template-columns: 1fr 90px 140px;
  align-items: center; gap: 8px;
  padding: 0 16px;
}
.av-colhead {
  position: sticky; top: 0; z-index: 1;
  font-size: 12px; color: var(--text-3);
  padding-top: 6px; padding-bottom: 6px;
  border-bottom: 1px solid var(--stroke);
  background: var(--bg1);
}
.av-row {
  font-size: 13px; padding-top: 5px; padding-bottom: 5px;
  cursor: default; user-select: none;
  border-bottom: 1px solid color-mix(in srgb, var(--stroke) 50%, transparent);
}
.av-row:hover { background: var(--hover, rgba(127, 127, 127, 0.08)) }
.av-row.sel { background: var(--sel, rgba(59, 145, 216, 0.18)) }
.av-c-name { display: flex; align-items: center; min-width: 0 }
.av-nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.av-ico { flex: none; margin-right: 7px }
.av-caret {
  width: 14px; flex: none; font-size: 10px; color: var(--text-3);
  display: inline-block; text-align: center; transition: transform 120ms;
}
.av-caret.open { transform: rotate(90deg) }
.av-c-size { font-size: 12px; color: var(--text-3); text-align: right; white-space: nowrap }
.av-c-time { font-size: 12px; color: var(--text-3); text-align: right; white-space: nowrap }
.av-empty { padding: 30px 0; text-align: center; font-size: 12.5px; color: var(--text-3) }
.av-empty.av-err { color: #ff8a80 }
.av-dir-item {
  padding: 7px 12px; cursor: pointer;
  display: flex; align-items: center; gap: 8px; font-size: 13px;
}
.av-dir-item:hover { background: var(--hover, rgba(127, 127, 127, 0.1)) }
.av-prop-grid {
  display: grid; grid-template-columns: 80px 1fr; gap: 8px 10px;
  font-size: 13px; align-items: baseline;
}
.av-prop-grid > span { color: var(--text-3); font-size: 12px }
/* 预览弹窗 */
.av-preview-dlg {
  /* 高度随窗口主体自适应（固定 640px 会高出矮窗口、顶部按钮被标题栏遮挡） */
  width: 780px; max-width: calc(100% - 24px);
  height: calc(100% - 24px); max-height: 640px;
  display: flex; flex-direction: column; padding: 0; overflow: hidden;
}
.av-pv-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-bottom: 1px solid var(--stroke);
}
.av-pv-head b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46vw }
.av-pv-size { font-size: 12px; color: var(--text-3); flex: none }
.av-pv-body {
  flex: 1; overflow: auto; position: relative;
  display: flex; align-items: center; justify-content: center;
  background: rgba(127, 127, 127, 0.08);
}
.av-pv-body .av-empty { position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%) }
.av-pv-text {
  width: 100%; height: 100%; margin: 0; padding: 14px;
  box-sizing: border-box; overflow: auto;
  font-family: Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.6;
  color: var(--text); background: transparent; white-space: pre-wrap; word-break: break-all;
}
.av-pv-more { color: var(--text-3) }
</style>
