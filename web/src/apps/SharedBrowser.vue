<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" :disabled="!canBack" @click="back"><AppIcon name="back" :size="16" /></button>
      <button class="tool-btn" :disabled="!rel" @click="goto('')"><AppIcon name="up" :size="16" /></button>
      <button class="tool-btn" @click="load"><AppIcon name="refresh" :size="16" /></button>
      <div class="crumb" style="flex: 1; margin: 0 8px">
        <span>{{ info.name || '他人共享' }}</span>
        <template v-for="(seg, i) in segs" :key="i">
          <AppIcon name="fwd" :size="11" style="opacity: 0.5" />
          <span @click="goto(segs.slice(0, i + 1).join('/'))">{{ seg }}</span>
        </template>
      </div>
    </div>
    <div class="app-toolbar" style="padding: 4px 10px">
      <span class="ac-tag" :class="{ admin: info.perm === 'rw' }">{{ info.perm === 'rw' ? '可写共享' : '只读共享' }}</span>
      <span style="font-size: 12px; color: var(--text-3)">来自 {{ info.owner }}（{{ info.ownerName }}）</span>
      <div style="flex: 1"></div>
      <template v-if="info.perm === 'rw'">
        <button class="tool-btn" @click="newFolder"><AppIcon name="plus" :size="15" />新建文件夹</button>
        <button class="tool-btn" @click="pickFiles"><AppIcon name="upload" :size="15" />上传</button>
        <button class="tool-btn" :disabled="!sel.length" @click="delSel"><AppIcon name="trash" :size="15" />删除</button>
      </template>
    </div>

    <div class="file-grid">
      <div v-for="f in items" :key="f.relPath" class="file-item" :class="{ selected: sel.includes(f.relPath) }"
        @click="clickItem(f, $event)" @dblclick="openItem(f)" @contextmenu.stop.prevent="onCtx(f, $event)">
        <div class="f-ico"><AppIcon :name="iconOf(f)" :size="46" /></div>
        <div class="f-name">{{ f.name }}</div>
      </div>
    </div>

    <div class="statusbar">
      <span>{{ info.name || '' }}{{ rel ? '/' + rel : '' }}</span>
      <span>{{ items.length }} 个项目</span>
      <span v-if="sel.length">已选 {{ sel.length }} 项</span>
    </div>

    <input ref="fileInput" type="file" multiple style="display: none" @change="onFilePicked" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { userShareApi } from '../api/modules'
import { useUiDialog, useToast } from '../stores/dialog'
import { useContextMenu } from '../stores/ui'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()
const uiDlg = useUiDialog()
const toast = useToast()
const ctx = useContextMenu()

const shareId = props.props?.shareId || 0
const info = ref<any>({})
const items = ref<any[]>([])
const rel = ref('')
const sel = ref<string[]>([])
const history: string[] = []

const fileInput = ref<HTMLInputElement>()
const segs = computed(() => rel.value.split('/').filter(Boolean))
const canBack = computed(() => history.length > 0)

onMounted(async () => {
  try { info.value = await userShareApi.info(shareId) } catch (e: any) { toast.error(e.message) }
  load()
})

async function load() {
  sel.value = []
  try {
    const d = await userShareApi.list(shareId, rel.value)
    items.value = d.items
  } catch (e: any) { toast.error(e.message); items.value = [] }
}
function goto(p: string) {
  history.push(rel.value)
  rel.value = p
  load()
}
function back() {
  if (!history.length) return
  rel.value = history.pop()!
  load()
}
function clickItem(f: any, e: MouseEvent) {
  if (e.ctrlKey) {
    sel.value = sel.value.includes(f.relPath) ? sel.value.filter(x => x !== f.relPath) : [...sel.value, f.relPath]
  } else sel.value = [f.relPath]
}
async function openItem(f: any) {
  if (f.isDir) { goto(f.relPath); return }
  const e = (f.ext || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e) || ['mp4', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e) || e === 'pdf') {
    window.open(userShareApi.rawUrl(shareId, f.relPath))
  } else {
    window.open(userShareApi.dlUrl(shareId, f.relPath))
  }
}
function iconOf(f: any) {
  if (f.isDir) return 'folder'
  const e = (f.ext || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(e)) return 'image'
  if (['mp4', 'webm', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return 'media'
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'].includes(e)) return 'office'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive'
  return 'file'
}
async function newFolder() {
  const name = await uiDlg.prompt('新建文件夹', '新建文件夹', '创建')
  if (!name) return
  try { await userShareApi.mkdir(shareId, rel.value, name); load() } catch (e: any) { toast.error(e.message) }
}
function pickFiles() { fileInput.value?.click() }
async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  try {
    for (const f of Array.from(input.files)) {
      await userShareApi.upload(shareId, rel.value, f)
    }
    toast.success('上传完成')
    load()
  } catch (e: any) { toast.error(e.message) }
  input.value = ''
}
async function delSel() {
  if (!(await uiDlg.confirm('删除', `删除选中的 ${sel.value.length} 项？`, { danger: true, okText: '删除' }))) return
  try { await userShareApi.del(shareId, sel.value); sel.value = []; load() } catch (e: any) { toast.error(e.message) }
}
function onCtx(f: any, e: MouseEvent) {
  if (!sel.value.includes(f.relPath)) sel.value = [f.relPath]
  const menu: any[] = [
    { label: f.isDir ? '打开' : '预览/下载', icon: 'fwd', onClick: () => openItem(f) },
    { label: '下载', icon: 'download', onClick: () => window.open(userShareApi.dlUrl(shareId, f.relPath)) }
  ]
  if (info.value.perm === 'rw') {
    menu.push({ separator: true })
    menu.push({ label: '删除', icon: 'trash', danger: true, onClick: delSel })
  }
  ctx.show(e.clientX, e.clientY, menu)
}
</script>
