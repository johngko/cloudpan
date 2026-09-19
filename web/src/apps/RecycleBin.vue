<template>
  <div class="app-root recycle">
    <div class="app-toolbar">
      <button class="tool-btn" @click="load"><AppIcon name="refresh" :size="15" />刷新</button>
      <button class="tool-btn" :disabled="!selIds.length" @click="restoreSel"><AppIcon name="recycle" :size="15" />还原选中</button>
      <button class="tool-btn" :disabled="!selIds.length" @click="purgeSel"><AppIcon name="trash" :size="15" />彻底删除</button>
      <div class="tool-sep"></div>
      <button class="tool-btn" :disabled="!items.length" @click="emptyAll"><AppIcon name="close" :size="15" />清空回收站</button>
      <div style="flex: 1"></div>
      <span style="font-size: 12.5px; color: var(--text-3)">{{ items.length }} 个项目 · 已选 {{ selIds.length }}</span>
    </div>

    <div class="rb-list">
      <table>
        <thead>
          <tr>
            <th style="width: 34px; text-align: center"><input type="checkbox" :checked="allSel" @mousedown.stop.prevent @click.stop="toggleAll" title="全选" /></th>
            <th>名称</th>
            <th style="width: 86px">类型</th>
            <th>原位置</th>
            <th style="width: 165px">删除时间</th>
            <th style="width: 110px; text-align: right">大小</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id" :class="{ selected: selSet.has(it.id) }" @mousedown="onRowDown(it, $event)" @dblclick="restoreOne(it)">
            <td style="text-align: center"><input type="checkbox" :checked="selSet.has(it.id)" @mousedown.stop.prevent @click.stop="toggle(it.id)" /></td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px">
                <AppIcon :name="it.isDir ? 'folder' : iconOf(it)" :size="18" />
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ it.name }}</span>
              </div>
            </td>
            <td style="color: var(--text-3)">{{ it.isDir ? '文件夹' : '文件' }}</td>
            <td style="color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis" :title="it.origPath || '/'">{{ it.origPath || '/' }}</td>
            <td style="color: var(--text-3)">{{ fmtTime(it.deletedAt) }}</td>
            <td style="text-align: right; color: var(--text-3)">{{ it.isDir ? '' : fmt(it.size) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!items.length" class="empty-hint">
        <AppIcon name="recycle" :size="52" />
        <div>回收站是空的</div>
      </div>
    </div>

    <div class="statusbar" style="border-top: 1px solid var(--stroke)">
      <span>回收站</span>
      <span v-if="items.length">共 {{ items.length }} 个项目</span>
      <span style="flex: 1"></span>
      <span v-if="selIds.length">已选中 {{ selIds.length }} 项</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWindows } from '../stores/windows'
import { fsApi } from '../api/modules'
import { useToast, useUiDialog } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()
const store = useWindows()
const toast = useToast()
const uiDlg = useUiDialog()

const items = ref<any[]>([])
const selSet = ref(new Set<number>())
const selIds = computed(() => Array.from(selSet.value))
const allSel = computed(() => items.value.length > 0 && items.value.every(i => selSet.value.has(i.id)))

async function load() {
  try {
    items.value = await fsApi.recycleList()
    store.setTitle(props.winId, '回收站')
  } catch (e: any) { toast.error(e.message) }
}
function iconOf(it: any) {
  const e = ((it.name.split('.').pop()) || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(e)) return 'image'
  if (['mp4', 'webm', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return 'media'
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'].includes(e)) return 'office'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive'
  return 'file'
}
function toggle(id: number) {
  const s = new Set(selSet.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selSet.value = s
}
function toggleAll() {
  selSet.value = allSel.value ? new Set() : new Set(items.value.map(i => i.id))
}
function onRowDown(it: any, e: MouseEvent) {
  if (e.button === 2) {
    if (!selSet.value.has(it.id)) selSet.value = new Set([it.id])
    return
  }
  if (!e.ctrlKey && !e.shiftKey) selSet.value = new Set([it.id])
}

async function restoreSel() {
  if (!selIds.value.length) return
  try {
    await fsApi.recycleRestore(selIds.value)
    toast.success(`已还原 ${selIds.value.length} 项`)
    selSet.value = new Set()
    await load()
  } catch (e: any) { toast.error(e.message) }
}
async function restoreOne(it: any) {
  try { await fsApi.recycleRestore([it.id]); toast.success(`已还原「${it.name}」`); await load() }
  catch (e: any) { toast.error(e.message) }
}
async function purgeSel() {
  if (!selIds.value.length) return
  const ok = await uiDlg.confirm('彻底删除', `将永久删除选中的 ${selIds.value.length} 项，不可恢复。`, { danger: true, okText: '彻底删除' })
  if (!ok) return
  try {
    await fsApi.recyclePurge(selIds.value, false)
    toast.success('已彻底删除')
    selSet.value = new Set()
    await load()
  } catch (e: any) { toast.error(e.message) }
}
async function emptyAll() {
  if (!items.value.length) return
  const ok = await uiDlg.confirm('清空回收站', '将永久删除回收站内全部文件，不可恢复。', { danger: true, okText: '清空' })
  if (!ok) return
  try {
    await fsApi.recyclePurge([], true)
    toast.success('回收站已清空')
    selSet.value = new Set()
    await load()
  } catch (e: any) { toast.error(e.message) }
}

function fmt(n: number) {
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}
function fmtTime(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${d.toTimeString().slice(0, 5)}`
}

// 桌面回收站图标右键「清空回收站」成功后派发 cp-refresh-recycle，打开着的窗口同步刷新
function onRefresh() { load() }
onMounted(() => {
  window.addEventListener('cp-refresh-recycle', onRefresh)
  load()
})
onBeforeUnmount(() => window.removeEventListener('cp-refresh-recycle', onRefresh))
</script>

<style scoped>
.recycle { display: flex; flex-direction: column; height: 100%; }
.rb-list { flex: 1; overflow: auto; padding: 6px 8px; }
.rb-list table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rb-list thead th {
  position: sticky; top: 0; background: var(--card); z-index: 1;
  text-align: left; font-weight: 500; color: var(--text-3);
  padding: 8px 10px; border-bottom: 1px solid var(--stroke); user-select: none;
}
.rb-list tbody td { padding: 7px 10px; border-bottom: 1px solid var(--bg50); color: var(--text); }
.rb-list tbody tr { cursor: default; }
.rb-list tbody tr:hover { background: var(--hover-b); }
.rb-list tbody tr.selected { background: #3b91d822; }
.rb-list td input[type="checkbox"], .rb-list th input[type="checkbox"] { width: 15px; height: 15px; margin: 0; accent-color: var(--theme-2); cursor: pointer; }
.empty-hint {
  position: absolute; left: 0; right: 0; top: 46%; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: var(--text-3); pointer-events: none;
}
</style>
