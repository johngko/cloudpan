<template>
  <div class="dialog-mask" v-if="cur" @click.self="cancel">
    <div class="dialog fp-dialog">
      <h3>{{ cur?.opts.title || (cur?.opts.folder ? '选择目录' : '选择文件') }}</h3>
      <div class="row">
        <label>云盘</label>
        <select class="input" v-model.number="pid" style="width: 100%" @change="enter('')">
          <option v-for="p in policies" :key="p.id" :value="p.id">{{ p.name }} ({{ p.letter }})</option>
        </select>
      </div>
      <div class="fp-path">
        <span class="fp-cur" @click="enter('')">/</span>
        <template v-for="(seg, i) in segs" :key="i">
          <span class="fp-sep">/</span><span class="fp-cur" @click="enter(segs.slice(0, i + 1).join('/'))">{{ seg }}</span>
        </template>
      </div>
      <div class="fp-list">
        <div v-if="loading" class="fp-empty">加载中…</div>
        <div v-else-if="!shown.length" class="fp-empty">（当前目录无可用条目）</div>
        <template v-else>
          <div v-if="canUp" class="fp-row" @click="enter(dirOnly(curDir))">
            <span class="fp-ico">📂</span><span class="fp-name">..</span>
          </div>
          <div v-for="it in shown" :key="it.path" class="fp-row"
               :class="{ on: sel && sel.path === it.path, dir: it.isDir }"
               @click="pick(it)" @dblclick="it.isDir && enter(it.path)">
            <span class="fp-ico">{{ it.isDir ? '📂' : '📄' }}</span>
            <span class="fp-name">{{ it.name }}</span>
            <span class="fp-size" v-if="!it.isDir">{{ fmtSize(it.size) }}</span>
          </div>
        </template>
      </div>
      <div v-if="filterText" class="fp-note">{{ filterText }}</div>
      <div class="actions">
        <button class="btn" @click="cancel">取消</button>
        <button class="btn primary" :disabled="saving || !canOk" @click="ok">{{ saving ? '保存中…' : '确定' }}</button>
      </div>
      <div v-if="errMsg" class="fp-err">{{ errMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 全局文件选择对话框：被 webapp 桥接层 requestFilePick() 触发（见 webapp/bridge.ts）。
// 供移植的 webapps 的「打开文件 / 选择保存目录」使用：盘选择 + 目录导航 + 文件列表。
import { ref, computed, watch, onMounted } from 'vue'
import { fsApi, rawUrl, type Policy, type FileItem } from '../api/modules'
import { pickQueue, type PickFileResult, type PickOpts } from './bridge'

interface Cur { opts: PickOpts; resolve: (v: PickFileResult | null) => void }
const cur = ref<Cur | null>(null)
const policies = ref<Policy[]>([])
const pid = ref(0)
const curDir = ref('')
const items = ref<FileItem[]>([])
const sel = ref<FileItem | null>(null)
const loading = ref(false)
const saving = ref(false)
const errMsg = ref('')
const inited = ref(false)

const segs = computed(() => curDir.value.split('/').filter(Boolean))
const canUp = computed(() => curDir.value !== '')
const filterList = computed(() => {
  const f = (cur.value?.opts.filter || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return f.length ? f : null
})
const shown = computed(() => {
  // 文件夹模式：只列目录（进入后「确定」= 选当前目录）；
  // 文件模式：目录始终保留（用于导航进子目录），filter 只作用于文件
  if (cur.value?.opts.folder) return items.value.filter(it => it.isDir)
  const f = filterList.value
  return f ? items.value.filter(it => it.isDir || f.includes((it.ext || '').toLowerCase())) : items.value
})
const filterText = computed(() => {
  const f = filterList.value
  return cur.value?.opts.folder ? '请选择保存目录' : (f ? `类型：${f.join(', ')}` : '')
})
const canOk = computed(() => {
  if (!cur.value) return false
  if (cur.value.opts.folder) return true
  return !!sel.value
})

async function loadPolicies() {
  if (inited.value) return
  inited.value = true
  policies.value = await fsApi.policies()
  pid.value = policies.value[0]?.id || 0
}
function dirOnly(p: string): string {
  const i = p.lastIndexOf('/')
  return i > 0 ? p.slice(0, i) : ''
}
function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}
async function enter(dir: string) {
  if (!pid.value) return
  curDir.value = dir
  sel.value = null
  loading.value = true
  errMsg.value = ''
  try {
    const r = await fsApi.list(pid.value, dir)
    items.value = (r.items || [])
      .filter((it: FileItem) => it.name !== '.gitkeep')
      .sort((a: FileItem, b: FileItem) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
  } catch (e: any) {
    errMsg.value = e?.message || '目录加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}
function pick(it: FileItem) {
  if (cur.value?.opts.folder) return
  sel.value = it
}
async function start(p: { opts: PickOpts; resolve: (v: PickFileResult | null) => void }) {
  await loadPolicies()
  cur.value = p
  pid.value = p.opts.initial?.policyId || policies.value[0]?.id || 0
  curDir.value = p.opts.initial?.dir || ''
  items.value = []
  sel.value = null
  errMsg.value = ''
  await enter(curDir.value)
}
function finish(r: PickFileResult | null) {
  const c = cur.value
  if (!c) return
  // 从队列摘除已处理的项（整体替换以触发 watch，驱动排队的下一个请求）
  const rest = pickQueue.value.filter(x => x !== c)
  if (rest.length !== pickQueue.value.length) pickQueue.value = rest
  c.resolve(r)
  cur.value = null
}
function cancel() { finish(null) }
async function ok() {
  if (!cur.value) return
  const o = cur.value.opts
  if (o.folder) {
    // 返回当前目录
    finish({ policyId: pid.value, path: curDir.value, name: curDir.value.split('/').filter(Boolean).pop() || '/', ext: '', size: 0, url: '' })
    return
  }
  if (!sel.value) return
  saving.value = true
  errMsg.value = ''
  try {
    finish({
      policyId: pid.value,
      path: sel.value.path,
      name: sel.value.name,
      ext: (sel.value.ext || '').toLowerCase(),
      size: sel.value.size,
      // /api/fs/raw?policyId=（与「打开方式」同一 raw 端点）；
      // 旧实现误用 /api/shared/:id/raw（那是公开分享链接端点，:id 为 shareId，
      // 传 policyId 会返回 {code:404} JSON，播放器/PDF 拿到 JSON 静默失败）
      url: rawUrl(pid.value, sel.value.path)
    })
  } catch (e: any) {
    errMsg.value = e?.message || '失败'
  } finally {
    saving.value = false
  }
}
watch(pickQueue, async (q) => {
  if (cur.value) return
  const next = q[0]
  if (next) await start(next)
}, { immediate: true })
</script>

<style scoped>
.fp-dialog { width: 540px; max-width: 92vw }
.fp-path {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
  padding: 6px 8px; margin-bottom: 6px; border: 1px solid var(--border, #333);
  border-radius: 8px; background: var(--bg-soft, rgba(128,128,128,.08)); font-size: 12.5px;
}
.fp-cur { cursor: pointer; color: var(--text-1, #ddd) }
.fp-cur:hover { text-decoration: underline }
.fp-sep { opacity: .45; margin: 0 1px }
.fp-list {
  flex: 1; min-height: 180px; max-height: 42vh; overflow-y: auto;
  border: 1px solid var(--border, #333); border-radius: 8px; margin-bottom: 8px;
}
.fp-row {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer;
  font-size: 13px; border-bottom: 1px solid var(--border-soft, rgba(128,128,128,.12));
}
.fp-row:last-child { border-bottom: none }
.fp-row:hover { background: var(--bg-hover, rgba(128,128,128,.12)) }
.fp-row.on { background: var(--acc-soft, rgba(0,120,212,.22)) }
.fp-row.dir .fp-name { font-weight: 600 }
.fp-ico { width: 20px; text-align: center; flex: 0 0 auto }
.fp-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.fp-size { opacity: .5; font-size: 11.5px; flex: 0 0 auto }
.fp-empty { padding: 18px; text-align: center; opacity: .55; font-size: 12.5px }
.fp-note { font-size: 11.5px; opacity: .6; margin-bottom: 8px }
.fp-err { margin-top: 8px; font-size: 12.5px; color: #ff8a80 }
</style>
