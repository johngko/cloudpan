<template>
  <!-- B2 全局命令面板：聚合「动作注册表 + 应用 + 设置区 + 最近/搜索文件」。
       原生 <dialog>（A8 一致）：顶层堆叠、Esc 原生关闭、焦点锁在面板内。
       「>」前缀 = 只搜动作（Raycast 语义）。三套主题桌面共用。 -->
  <dialog v-if="open" class="cpal-dlg" ref="dlgEl" @close="open = false" @click="onBackdrop">
    <div class="cpal">
      <input ref="inputEl" class="cpal-input" v-model="raw" placeholder="搜索动作、应用、文件…（&gt; 仅动作）" spellcheck="false" @keydown="onKey" />
      <div class="cpal-list" ref="listEl">
        <template v-for="(r, i) in rows" :key="r.key">
          <div v-if="r.header" class="cpal-group">{{ r.header }}</div>
          <div v-else class="cpal-row" :class="{ sel: selIdx === i }" @mouseenter="selIdx = i" @click="runRow(r)">
            <span class="cpal-ico"><AppIcon :name="r.icon || 'file'" :size="16" /></span>
            <span class="cpal-label">{{ r.label }}</span>
            <span class="cpal-sub">{{ r.sub }}</span>
          </div>
        </template>
        <div v-if="!rows.length" class="cpal-empty">{{ searching ? '搜索中…' : '无匹配结果' }}</div>
      </div>
      <div class="cpal-foot">
        <span>↑↓ 选择 · ⏎ 执行 · Esc 关闭</span>
        <span>{{ actionOnly ? '仅动作模式' : '输入文件关键词即搜盘' }}</span>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { paletteTick } from './hotkeys'
import { SETTINGS_AREAS, type SearchFile } from './useGlobalSearch'
import { visibleApps, canUseOffline } from '../stores/apps'
import { useWindows } from '../stores/windows'
import { useSession } from '../stores/session'
import { useTransfer } from '../stores/transfer'
import { useNotify } from '../stores/notify'
import { fsApi, type RecentItem } from '../api/modules'
import type { ThemeId } from '../themes/types'

interface Row {
  key: string
  header?: string
  icon?: string
  label?: string
  sub?: string
  run?: () => void
}

const windows = useWindows()
const session = useSession()
const transfer = useTransfer()
const notify = useNotify()

const open = ref(false)
const raw = ref('')
const dlgEl = ref<HTMLDialogElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const selIdx = ref(0)
const searching = ref(false)
const fileHits = ref<SearchFile[]>([])
const recents = ref<RecentItem[]>([])

watch(paletteTick, () => { open.value = true })
watch(open, async v => {
  if (v) {
    raw.value = ''
    selIdx.value = 0
    fileHits.value = []
    await nextTick()
    try { dlgEl.value?.showModal() } catch { /* already open */ }
    inputEl.value?.focus()
    fsApi.recentList().then(r => { recents.value = r.slice(0, 8) }).catch(() => { recents.value = [] })
  }
})

const q = computed(() => raw.value.trim().toLowerCase())
const actionOnly = computed(() => raw.value.startsWith('>'))
const effQ = computed(() => (actionOnly.value ? raw.value.slice(1).trim().toLowerCase() : q.value))

// ---- 动作注册表（打开面板时按需构建；标签随当前状态动态）----
function buildActions(): Row[] {
  const acts: Row[] = []
  acts.push({ key: 'a-dark', icon: 'sun', label: session.dark ? '切换到浅色模式' : '切换到深色模式', sub: '外观', run: () => session.setDark(!session.dark) })
  const themes: [ThemeId, string][] = [['win12', 'Win11 风格'], ['macos', 'macOS 风格'], ['deepin', 'Deepin 风格']]
  for (const [id, name] of themes) {
    if (session.osTheme !== id) acts.push({ key: 'a-th-' + id, icon: 'grid', label: '切换主题：' + name, sub: '外观（本地预览）', run: () => session.applyOsTheme(id) })
  }
  acts.push({ key: 'a-minall', icon: 'taskview', label: '最小化所有窗口（显示桌面）', sub: '窗口', run: () => windows.minimizeAll() })
  acts.push({ key: 'a-dsk-next', icon: 'taskview', label: '下一个虚拟桌面', sub: '窗口', run: () => windows.cycleDesktop(1) })
  acts.push({ key: 'a-dsk-prev', icon: 'taskview', label: '上一个虚拟桌面', sub: '窗口', run: () => windows.cycleDesktop(-1) })
  acts.push({ key: 'a-dsk-add', icon: 'plus', label: '新建虚拟桌面', sub: '窗口', run: () => windows.addDesktop() })
  acts.push({ key: 'a-lock', icon: 'lock', label: '锁定屏幕', sub: '安全', run: () => { session.locked = true } })
  acts.push({ key: 'a-logout', icon: 'logout', label: '退出登录', sub: '安全', run: () => session.logout() })
  acts.push({ key: 'a-transfer', icon: 'download', label: '传输面板', sub: '面板', run: () => transfer.panel() })
  acts.push({ key: 'a-notify', icon: 'bell', label: '通知中心', sub: '面板', run: () => notify.openPanel() })
  acts.push({ key: 'a-trash', icon: 'trash', label: '打开回收站', sub: '打开', run: () => windows.open('recycle') })
  let areas = session.user?.role === 'admin' ? SETTINGS_AREAS : SETTINGS_AREAS.filter(a => a.id !== 'person')
  if (!canUseOffline()) areas = areas.filter(a => a.id !== 'offline')
  for (const a of areas) acts.push({ key: 'a-set-' + a.id, icon: a.icon, label: '设置：' + a.name, sub: '设置', run: () => { windows.open('settings', { tab: a.id }); } })
  for (const a of visibleApps()) acts.push({ key: 'a-app-' + a.id, icon: a.icon, label: '打开应用：' + a.name, sub: '应用', run: () => windows.open(a.id) })
  return acts
}

function matchActs(v: string): Row[] {
  if (!v) return buildActions()
  return buildActions().filter(a => (a.label || '').toLowerCase().includes(v))
}

// ---- 文件：无词 = 最近打开；有词 = 全局搜索（防抖）----
let t: any
watch(q, v => {
  clearTimeout(t)
  selIdx.value = 0
  if (actionOnly.value || !v) { fileHits.value = []; searching.value = false; return }
  searching.value = true
  t = setTimeout(async () => {
    try { fileHits.value = ((await fsApi.globalSearch(raw.value.trim())) || []).slice(0, 6) }
    catch { fileHits.value = [] }
    searching.value = false
  }, 320)
})

function fileRow(f: SearchFile, key: string): Row {
  return {
    key, icon: f.isDir ? 'folderPlain' : 'file', label: f.name,
    sub: f.path,
    run: () => windows.open('explorer', { policyId: f.policyId, path: f.path }, { title: f.name, icon: 'explorer', w: 1000, h: 640 })
  }
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const acts = matchActs(effQ.value)
  const webKw = raw.value.trim()
  if (webKw && !actionOnly.value) {
    acts.push({ key: 'a-web', icon: 'search', label: `网页搜索：${webKw}`, sub: '浏览器', run: () => windows.open('browser', { url: 'https://www.baidu.com/s?wd=' + encodeURIComponent(webKw) }) })
  }
  if (acts.length) {
    out.push({ key: 'g-act', header: actionOnly.value ? '动作' : '动作 / 应用' })
    for (const a of acts.slice(0, actionOnly.value ? 40 : 9)) out.push(a)
  }
  if (!actionOnly.value) {
    const files = q.value ? fileHits.value : recents.value
    if (files.length) {
      out.push({ key: 'g-file', header: q.value ? '文件' : '最近打开' })
      files.forEach((f, i) => out.push(fileRow(f as SearchFile, 'f-' + i)))
    }
  }
  return out
})

// 扁平列表里 selIdx 只数可执行行；用序号映射
function runnableIndexes(): number[] {
  return rows.value.map((r, i) => (r.header ? -1 : i)).filter(i => i >= 0)
}

watch(rows, () => {
  // 组标题会占用下标：确保选中项永远落在第一条可执行行上
  const idxs = runnableIndexes()
  if (idxs.length && !idxs.includes(selIdx.value)) selIdx.value = idxs[0]
  if (!idxs.length) selIdx.value = -1
})

function onKey(e: KeyboardEvent) {
  const idxs = runnableIndexes()
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (idxs.length) selIdx.value = idxs[(idxs.indexOf(selIdx.value) + 1 + idxs.length) % idxs.length]
    scrollSel()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (idxs.length) selIdx.value = idxs[(idxs.indexOf(selIdx.value) - 1 + idxs.length) % idxs.length]
    scrollSel()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const r = rows.value[selIdx.value]
    if (r && !r.header) runRow(r)
  }
}
function scrollSel() {
  nextTick(() => listEl.value?.querySelector('.cpal-row.sel')?.scrollIntoView({ block: 'nearest' }))
}

function runRow(r: Row) {
  open.value = false // close 事件也会触发；r.run 里可能开窗口/面板
  r.run?.()
}
function onBackdrop(e: MouseEvent) {
  if (e.target === dlgEl.value) open.value = false
}

onBeforeUnmount(() => clearTimeout(t))
</script>

<style scoped>
.cpal-dlg {
  position: fixed; inset: 0; margin: 0; width: 100vw; height: 100vh;
  max-width: 100vw; max-height: 100vh; padding: 0; border: 0; background: transparent;
  display: grid; place-items: start center;
}
.cpal-dlg::backdrop {
  background: rgba(6, 8, 16, 0.45); backdrop-filter: blur(3px);
  transition: opacity 0.14s ease, overlay 0.14s allow-discrete;
}
@starting-style { .cpal-dlg::backdrop { opacity: 0; } }
.cpal {
  margin-top: 12vh; width: min(660px, 92vw); display: flex; flex-direction: column;
  background: var(--bg60, var(--bg50)); backdrop-filter: blur(40px) saturate(2);
  border: 1px solid var(--stroke); border-radius: var(--radius-2xl, 14px);
  box-shadow: var(--shadow); color: var(--text);
  opacity: 0; transform: translateY(-10px) scale(0.98);
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.cpal-dlg[open] .cpal { opacity: 1; transform: none; }
@starting-style { .cpal-dlg[open] .cpal { opacity: 0; transform: translateY(-10px) scale(0.98); } }
.cpal-input {
  width: 100%; padding: 16px 20px; font-size: 16px; border: 0; background: transparent;
  color: var(--text); outline: none; border-bottom: 1px solid var(--stroke-b, var(--stroke));
}
.cpal-list { max-height: 52vh; overflow-y: auto; padding: 8px; }
.cpal-group { padding: 8px 12px 4px; font-size: 11px; color: var(--text-3); letter-spacing: 0.06em; }
.cpal-row {
  display: flex; align-items: center; gap: 12px; padding: 9px 12px;
  border-radius: var(--radius, 8px); cursor: pointer; font-size: 13.5px;
}
.cpal-row.sel { background: var(--hover-b); }
.cpal-ico { flex: none; display: flex; opacity: 0.8; }
.cpal-label { flex: none; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpal-sub { flex: 1; text-align: right; color: var(--text-3); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpal-empty { padding: 26px 0; text-align: center; color: var(--text-3); font-size: 13px; }
.cpal-foot {
  display: flex; justify-content: space-between; padding: 8px 16px;
  font-size: 11.5px; color: var(--text-3); border-top: 1px solid var(--stroke-b, var(--stroke));
}
</style>
