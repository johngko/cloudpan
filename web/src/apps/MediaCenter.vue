<template>
  <div class="app-root mc-root">
    <div class="app-toolbar">
      <span class="mc-title">媒体中心</span>
      <div class="tool-sep"></div>
      <div class="mc-tabs">
        <button v-for="t in tabs" :key="t.id" class="mc-tab" :class="{ on: tab === t.id }" @click="switchTab(t.id)">
          {{ t.name }}<span v-if="t.count != null && t.count > 0" class="mc-tab-n">{{ t.count }}</span>
        </button>
      </div>
      <div style="flex: 1"></div>
      <input class="input mc-search" :placeholder="tab === 'recent' || tab === 'playlist' ? '' : '搜索媒体…'" v-model="kw" :disabled="tab === 'recent' || tab === 'playlist'" />
      <button class="tool-btn" @click="rescan" :disabled="scanning" title="重新扫描媒体库"><AppIcon name="refresh" :size="15" /></button>
    </div>

    <div class="mc-body">
      <!-- 继续观看 -->
      <template v-if="tab === 'recent'">
        <div v-if="!recent.length" class="mc-empty">暂无观看记录 —— 播放过的视频会自动出现在这里，可从上次位置继续。</div>
        <div class="mc-grid mc-grid-wide">
          <div v-for="r in recent" :key="r.key" class="mc-card mc-recent" @dblclick="playRecent(r)" @click="toggleSelByKey(r.key)" :class="{ sel: sel.has(r.key) }">
            <input type="checkbox" class="mc-check" :checked="sel.has(r.key)" @click.stop @change="toggleSelByKey(r.key)" />
            <div class="mc-thumb mc-thumb-video">
              <img v-if="posters[r.key]" :src="posters[r.key]" class="mc-poster" />
              <AppIcon v-else name="video" :size="38" />
              <div class="mc-prog"><div class="mc-prog-fill" :style="{ width: pct(r.pos, r.dur) }"></div></div>
            </div>
            <div class="mc-name">{{ r.item ? r.item.name : r.path }}</div>
            <div class="mc-sub">{{ fmtDate(r.at) }} · {{ fmtPos(r.pos) }} / {{ fmtPos(r.dur) }}</div>
          </div>
        </div>
      </template>

      <!-- 视频 / 音乐库 -->
      <template v-else-if="tab === 'video' || tab === 'music'">
        <div class="mc-bar">
          <span class="mc-hint">
            <template v-if="sel.size">{{ sel.size }} 项已选 —— 可加入播放列表</template>
            <template v-else-if="scanning">正在扫描媒体库…（已发现 {{ scanned }} 项）</template>
            <template v-else>共 {{ items.length }} 项 · 双击播放</template>
          </span>
          <div style="flex: 1"></div>
          <select v-if="sel.size" class="input mc-pl-sel" v-model="targetPl">
            <option value="">选择播放列表…</option>
            <option v-for="pl in playlistsOfKind" :key="pl.id" :value="pl.id">{{ pl.name }}</option>
          </select>
          <button v-if="sel.size" class="btn" @click="addSelToPl" :disabled="!targetPl">加入所选列表</button>
          <button class="btn" @click="newPl" :disabled="!items.length || scanning">新建播放列表</button>
        </div>
        <div v-if="!scanning && !shown.length" class="mc-empty">
          未找到媒体文件{{ kw ? '（搜索 "' + kw + '"）' : '' }} —— 把视频/音乐上传到任意目录后点右上角刷新
        </div>
        <div class="mc-grid">
          <div v-for="it in shown" :key="it.policyId + ':' + it.path" class="mc-card" :class="{ sel: sel.has(it.policyId + ':' + it.path) }" @dblclick="playItem(it, items)" @click="toggleSel(it.policyId + ':' + it.path)">
            <input type="checkbox" class="mc-check" :checked="sel.has(it.policyId + ':' + it.path)" @click.stop @change="toggleSel(it.policyId + ':' + it.path)" />
            <div class="mc-thumb" :class="tab === 'video' ? 'mc-thumb-video' : 'mc-thumb-music'">
              <img v-if="tab === 'video' && posters[it.policyId + ':' + it.path]" :src="posters[it.policyId + ':' + it.path]" class="mc-poster" />
              <img v-else-if="tab === 'music' && hasCover(it)" :src="coverUrl(it.policyId, it.path)" class="mc-poster" loading="lazy" @error="markNoCover(it)" />
              <AppIcon v-else :name="tab === 'video' ? 'video' : 'music'" :size="38" />
            </div>
            <div class="mc-name" :title="it.name">{{ it.name }}</div>
            <div class="mc-sub" :title="it.path">{{ fmt(it.size) }} · {{ it.path }}</div>
          </div>
        </div>
      </template>

      <!-- 播放列表 -->
      <template v-else>
        <div class="mc-bar">
          <span class="mc-hint">双击播放列表整体播放 · 列表按用户保存在云端</span>
          <div style="flex: 1"></div>
          <button class="btn primary" @click="newPl" :disabled="scanning">新建播放列表</button>
        </div>
        <div v-if="!playlists.length" class="mc-empty">还没有播放列表 —— 在视频/音乐库勾选文件后「新建播放列表」即可创建。</div>
        <div v-for="pl in playlists" :key="pl.id" class="mc-pl">
          <div class="mc-pl-head" @dblclick="playPl(pl)">
            <AppIcon :name="pl.kind === 'video' ? 'video' : 'music'" :size="20" />
            <span class="mc-pl-name">{{ pl.name }}</span>
            <span class="mc-sub">{{ pl.items.length }} 项 · 双击整体播放</span>
            <button class="tool-btn" @click.stop="toggleOpenPl(pl.id)" :title="openPl === pl.id ? '收起' : '展开'"><AppIcon :name="openPl === pl.id ? 'up' : 'down'" :size="13" /></button>
            <button class="tool-btn" @click.stop="delPl(pl)" title="删除列表"><AppIcon name="trash" :size="14" /></button>
          </div>
          <div v-if="openPl === pl.id" class="mc-pl-items">
            <div v-for="(it, i) in pl.items" :key="it.policyId + ':' + it.path" class="mc-pl-item" @dblclick="playItem(it, pl.items)">
              <span class="mc-pl-i">{{ i + 1 }}</span>
              <span class="mc-pl-n" :title="it.name">{{ it.name }}</span>
              <span class="mc-sub">{{ it.path }}</span>
              <div style="flex: 1"></div>
              <button class="tool-btn" @click.stop="plRemoveItem(pl, it)" title="从列表移除"><AppIcon name="close" :size="12" /></button>
            </div>
            <div v-if="!pl.items.length" class="mc-sub" style="padding: 10px 14px">列表为空</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWindows } from '../stores/windows'
import { useUiDialog, useToast } from '../stores/dialog'
import { fsApi, settingsApi, coverUrl } from '../api/modules'
import AppIcon from '../components/AppIcon.vue'

const store = useWindows()
const dlg = useUiDialog()
const toast = useToast()

const VIDEO_EXTS = ['mp4', 'webm', 'mkv', 'mov', 'm4v']
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
// 服务端 ?cover=1 能提取内嵌封面的格式（ID3v2 / FLAC PICTURE / OGG 注释块）
const COVER_EXTS = ['mp3', 'flac', 'ogg', 'oga', 'opus']

interface MediaItem { policyId: number; policyName: string; path: string; name: string; size: number; ext: string; kind: 'video' | 'music' }
interface Playlist { id: string; name: string; kind: 'video' | 'music'; items: MediaItem[] }

const tab = ref<'recent' | 'video' | 'music' | 'playlist'>('video')
const kw = ref('')
const scanning = ref(false)
const scanned = ref(0)
const files = ref<MediaItem[]>([])
const playlists = ref<Playlist[]>([])
const openPl = ref('')
const sel = ref<Set<string>>(new Set())
const targetPl = ref('')
// 必须用 ref：recent 计算属性依赖它——普通 let 在首次求值（空对象、循环体未执行）时
// 不会建立任何响应式依赖，之后 loadMeta 赋值也不会触发重算，「继续观看」永远为空
const progress = ref<Record<string, { pos: number; dur: number; at: number }>>({})
// 视频海报（dataURL，播放时由 MediaViewer 抓取写入；键 = "policyId:path"）
const posters = ref<Record<string, string>>({})
// 本次会话确认无内嵌封面的音乐（404 后不再重试请求）
const noCover = ref<Set<string>>(new Set())
const hasCover = (it: MediaItem) => COVER_EXTS.includes(it.ext) && !noCover.value.has(it.policyId + ':' + it.path)
function markNoCover(it: MediaItem) {
  const s = new Set(noCover.value)
  s.add(it.policyId + ':' + it.path)
  noCover.value = s
}

const tabs = computed(() => [
  { id: 'recent' as const, name: '继续观看', count: recent.value.length },
  { id: 'video' as const, name: '视频', count: files.value.filter(f => f.kind === 'video').length },
  { id: 'music' as const, name: '音乐', count: files.value.filter(f => f.kind === 'music').length },
  { id: 'playlist' as const, name: '播放列表', count: playlists.value.length }
])

function switchTab(t: 'recent' | 'video' | 'music' | 'playlist') {
  tab.value = t
  sel.value = new Set()
}

const items = computed(() => (tab.value === 'video' ? 'video' : 'music') === 'video'
  ? files.value.filter(f => f.kind === 'video')
  : files.value.filter(f => f.kind === 'music'))
const shown = computed(() => {
  const k = kw.value.trim()
  const base = items.value
  if (!k) return base
  return base.filter(f => f.name.toLowerCase().includes(k.toLowerCase()) || f.path.toLowerCase().includes(k.toLowerCase()))
})

// 继续观看：与保存门槛一致（>5s 且未接近结尾 95%）
const recent = computed(() => {
  const out: { key: string; pos: number; dur: number; at: number; item?: MediaItem; path: string }[] = []
  for (const [key, v] of Object.entries(progress.value)) {
    if (!(v.pos > 5 && v.dur > 0 && v.pos < v.dur * 0.95)) continue
    const i = key.indexOf(':')
    const pid = key.slice(0, i)
    const path = key.slice(i + 1)
    const item = files.value.find(f => String(f.policyId) === pid && f.path === path)
    out.push({ key, pos: v.pos, dur: v.dur, at: v.at, item, path })
  }
  out.sort((a, b) => b.at - a.at)
  return out.slice(0, 24)
})

const playlistsOfKind = computed(() => playlists.value.filter(p => p.kind === (tab.value === 'music' ? 'music' : 'video')))

// ---- 库扫描（BFS，深度/目录数/文件数有上限，防止大库卡死）----
async function rescan() {
  if (scanning.value) return
  scanning.value = true
  scanned.value = 0
  const found: MediaItem[] = []
  try {
    const pols = await fsApi.policies()
    for (const p of pols) {
      const queue: { path: string; depth: number }[] = [{ path: '/', depth: 0 }]
      let dirsVisited = 0
      while (queue.length && dirsVisited < 400 && found.length < 3000) {
        const { path, depth } = queue.shift()!
        let d: any
        try { d = await fsApi.list(p.id, path) } catch { continue }
        dirsVisited++
        for (const it of d.items || []) {
          if (it.isDir) {
            if (depth < 5) queue.push({ path: it.path, depth: depth + 1 })
          } else {
            const ext = (it.ext || '').toLowerCase()
            if (VIDEO_EXTS.includes(ext) || AUDIO_EXTS.includes(ext)) {
              found.push({ policyId: p.id, policyName: p.name, path: it.path, name: it.name, size: it.size, ext, kind: VIDEO_EXTS.includes(ext) ? 'video' : 'music' })
              scanned.value = found.length
            }
          }
        }
      }
    }
  } catch { /* 忽略 */ }
  files.value = found
  scanning.value = false
}

// ---- 元数据（进度/播放列表）----
function parse<T>(v?: string): T | null {
  if (!v) return null
  try { return JSON.parse(v) as T } catch { return null }
}
async function loadMeta() {
  try {
    const m = await settingsApi.get(['media_progress', 'media_playlists', 'media_posters'])
    progress.value = parse<Record<string, { pos: number; dur: number; at: number }>>(m['media_progress']) || {}
    const pls = parse<Playlist[]>(m['media_playlists'])
    if (Array.isArray(pls)) playlists.value = pls.filter(p => p && typeof p.name === 'string' && Array.isArray(p.items))
    const ps = parse<Record<string, string>>(m['media_posters'])
    if (ps && typeof ps === 'object') posters.value = ps
  } catch { progress.value = {}; playlists.value = []; posters.value = {} }
}
function savePlaylists() {
  settingsApi.set('media_playlists', JSON.stringify(playlists.value)).catch(() => {})
}

// ---- 播放 ----
function openPlayer(it: MediaItem, list?: MediaItem[], startAt = 0) {
  const p: any = { policyId: it.policyId, path: it.path, name: it.name, ext: it.ext, startAt }
  if (list && list.length) p.list = list
  store.open('mediaviewer', p, { title: it.name + ' - 媒体播放器', icon: 'media', w: 980, h: 620 })
}
function playItem(it: MediaItem, list?: MediaItem[]) {
  openPlayer(it, list)
}
function playRecent(r: { key: string; pos: number; item?: MediaItem }) {
  // 列表必须按条目自身的 kind 取，不能用 items.value——「继续观看」tab 下它解析成音乐列表，
  // 会导致播放器 findIndex 落空、从第 0 项开始播错文件
  if (r.item) openPlayer(r.item, files.value.filter(f => f.kind === r.item.kind), r.pos)
  else {
    // 文件已不在库中：仍按进度键尝试单文件播放
    const i = r.key.indexOf(':')
    const pid = Number(r.key.slice(0, i))
    const path = r.key.slice(i + 1)
    openPlayer({ policyId: pid, policyName: '', path, name: path.split('/').pop() || path, size: 0, ext: (path.split('.').pop() || '').toLowerCase(), kind: 'video' }, undefined, r.pos)
  }
}
function playPl(pl: Playlist) {
  if (!pl.items.length) { toast.show('列表为空', 'error'); return }
  openPlayer(pl.items[0], pl.items)
}

// ---- 播放列表管理 ----
async function newPl() {
  const name = await dlg.prompt('新建播放列表', '', '创建')
  if (!name) return
  const kind: 'video' | 'music' = tab.value === 'music' ? 'music' : 'video'
  const pl: Playlist = { id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim().slice(0, 40), kind, items: [] }
  playlists.value.push(pl)
  savePlaylists()
  sel.value = new Set()
  toast.show(`已创建播放列表「${pl.name}」`, 'success')
  if (tab.value === 'video' || tab.value === 'music') { tab.value = 'playlist'; openPl.value = pl.id }
}
function addSelToPl() {
  const pl = playlists.value.find(p => p.id === targetPl.value)
  if (!pl || !sel.value.size) return
  let added = 0
  for (const key of sel.value) {
    const i = key.indexOf(':')
    const it = files.value.find(f => String(f.policyId) === key.slice(0, i) && f.path === key.slice(i + 1))
    if (!it) continue
    if (!pl.items.some(x => x.policyId === it.policyId && x.path === it.path)) { pl.items.push(it); added++ }
  }
  savePlaylists()
  sel.value = new Set()
  targetPl.value = ''
  toast.show(added ? `已加入 ${added} 项` : '所选文件已在列表中', added ? 'success' : 'info')
}
async function delPl(pl: Playlist) {
  const ok = await dlg.confirm('删除播放列表', `删除「${pl.name}」（${pl.items.length} 项）？文件本身不会被删除。`, { danger: true, okText: '删除' })
  if (!ok) return
  playlists.value = playlists.value.filter(p => p.id !== pl.id)
  if (openPl.value === pl.id) openPl.value = ''
  savePlaylists()
  toast.show('已删除播放列表', 'info')
}
function plRemoveItem(pl: Playlist, it: MediaItem) {
  pl.items = pl.items.filter(x => !(x.policyId === it.policyId && x.path === it.path))
  savePlaylists()
}
function toggleOpenPl(id: string) { openPl.value = openPl.value === id ? '' : id }
function toggleSel(key: string) {
  const s = new Set(sel.value)
  if (s.has(key)) s.delete(key); else s.add(key)
  sel.value = s
}
function toggleSelByKey(key: string) { toggleSel(key) }

// ---- 格式化工具 ----
function fmt(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}
function fmtPos(sec: number): string {
  sec = Math.max(0, Math.floor(sec))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}
function fmtDate(t: number): string {
  const d = new Date(t)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function pct(a: number, b: number): string {
  if (!b) return '0%'
  return Math.min(100, Math.round((a / b) * 100)) + '%'
}

// 播放器抓到新海报时即时刷新（无需重开媒体中心）
function onPosterEv(e: Event) {
  const d = (e as CustomEvent).detail as { key: string; url: string } | undefined
  if (d && d.key && d.url) posters.value = { ...posters.value, [d.key]: d.url }
}
onMounted(async () => {
  window.addEventListener('cp-media-poster', onPosterEv)
  await loadMeta()
  await rescan()
})
onBeforeUnmount(() => { window.removeEventListener('cp-media-poster', onPosterEv) })
</script>

<style scoped>
.mc-root { background: var(--bg); }
.mc-title { font-size: 14px; font-weight: 600; }
.mc-search { width: 170px; }
.mc-tabs { display: flex; gap: 2px; padding: 2px; background: var(--hover-b); border-radius: 8px; }
.mc-tab {
  border: none; background: transparent; color: var(--text-2); font-size: 12.5px;
  padding: 5px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px;
}
.mc-tab:hover { color: var(--text); }
.mc-tab.on { background: var(--card); color: var(--text); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.mc-tab-n { font-size: 10.5px; color: var(--text-3); background: var(--hover-b); border-radius: 8px; padding: 0 6px; }
.mc-body { flex: 1; overflow: auto; padding: 14px 20px 20px; }
.mc-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.mc-hint { font-size: 12px; color: var(--text-3); }
.mc-pl-sel { width: 180px; }
.mc-empty { color: var(--text-3); font-size: 12.5px; text-align: center; padding: 56px 0; line-height: 1.8; }
.mc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 12px; }
.mc-grid-wide { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
.mc-card {
  position: relative; border-radius: var(--radius); border: 1px solid var(--stroke-b);
  background: var(--card); overflow: hidden; cursor: pointer; transition: border-color 0.12s, transform 0.12s;
}
.mc-card:hover { border-color: var(--stroke); transform: translateY(-1px); }
.mc-card.sel { border-color: var(--theme-2); box-shadow: 0 0 0 1px var(--theme-2); }
.mc-check { position: absolute; top: 8px; left: 8px; z-index: 2; width: 15px; height: 15px; cursor: pointer; accent-color: var(--theme-2); }
.mc-thumb {
  position: relative; height: 86px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.16));
  overflow: hidden;
}
.mc-thumb-video { background: linear-gradient(135deg, #3a2f22, #23283a); }
.mc-thumb-music { background: linear-gradient(135deg, #22303f, #2b2440); }
.mc-recent .mc-thumb { position: relative; }
.mc-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,0.14); }
.mc-prog-fill { height: 100%; background: var(--theme-2); }
.mc-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.mc-name {
  font-size: 12.5px; font-weight: 500; color: var(--text); padding: 8px 10px 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mc-sub { font-size: 10.5px; color: var(--text-3); padding: 2px 10px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 播放列表 */
.mc-pl { border: 1px solid var(--stroke-b); background: var(--card); border-radius: var(--radius); margin-bottom: 10px; overflow: hidden; }
.mc-pl-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; }
.mc-pl-head:hover { background: var(--hover-b); }
.mc-pl-name { font-size: 13px; font-weight: 600; color: var(--text); }
.mc-pl-items { border-top: 1px solid var(--stroke-b); }
.mc-pl-item { display: flex; align-items: center; gap: 10px; padding: 7px 14px; cursor: pointer; font-size: 12.5px; }
.mc-pl-item:hover { background: var(--hover-b); }
.mc-pl-i { width: 20px; text-align: center; color: var(--text-3); font-size: 11px; flex: none; }
.mc-pl-n { color: var(--text); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
