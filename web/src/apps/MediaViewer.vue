<template>
  <div class="app-root mv-root">
    <!-- 视频：ArtPlayer -->
    <div v-if="isVideo" class="mv-stage">
      <div ref="artEl" class="mv-art"></div>
    </div>
    <!-- 音乐：APlayer -->
    <div v-else class="mv-stage mv-audio">
      <div class="mv-head">
        <div class="mv-cover">
          <img v-if="coverSrc" :src="coverSrc" class="mv-cover-img" />
          <AppIcon v-else name="media" :size="42" />
        </div>
        <div style="min-width: 0">
          <div class="mv-title">{{ current?.name }}</div>
          <div class="mv-sub">CloudPan 音乐 · {{ list.length > 1 ? `第 ${idx + 1}/${list.length} 首` : '单曲播放' }}</div>
        </div>
      </div>
      <div ref="apEl"></div>
      <div v-if="!hasLrc" class="mv-nolrc">暂无歌词（可将同名 .lrc 文件放在同一目录）</div>
    </div>
    <!-- 底部导航（多文件时） -->
    <div class="app-toolbar" style="justify-content: center; border-top: 1px solid var(--stroke)" v-if="list.length > 1">
      <button class="tool-btn" :disabled="idx <= 0" @click="go(idx - 1)" title="上一个"><AppIcon name="back" :size="15" /></button>
      <span class="mv-name">{{ current?.name }}</span>
      <button class="tool-btn" :disabled="idx >= list.length - 1" @click="go(idx + 1)" title="下一个"><AppIcon name="fwd" :size="15" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Artplayer from 'artplayer'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import { fsApi, rawUrl, settingsApi, coverUrl } from '../api/modules'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()

const VIDEO_EXTS = ['mp4', 'webm', 'mkv', 'mov', 'm4v']
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']

// 列表若不含当前条目（调用方传错 kind 等），退化为单曲播放，绝不能从第 0 项开始播错文件
const list0: any[] = props.props?.list?.length ? props.props.list : [props.props]
const list = ref<any[]>(list0.some((x: any) => x.path === props.props?.path) ? list0 : [props.props])
const idx = ref(list.value.findIndex((x: any) => x.path === props.props?.path))
const current = computed(() => list.value[idx.value])
const isVideo = computed(() => VIDEO_EXTS.includes((current.value?.ext || '').toLowerCase()))

const artEl = ref<HTMLElement>()
const apEl = ref<HTMLElement>()
const hasLrc = ref(false)
let art: Artplayer | null = null
let ap: APlayer | null = null
let building = 0

// ---- 音乐封面：服务端 ?cover=1 提取内嵌封面（mp3 ID3v2 / flac PICTURE / ogg 注释块）----
// 先 fetch 验证存在再给 <img> 和 APlayer pic，避免 404 破图；服务端带 max-age=86400，浏览器自行缓存
const COVER_EXTS = ['mp3', 'flac', 'ogg', 'oga', 'opus']
const coverSrc = ref('')
let coverObj = ''
function setCover(u: string) {
  if (coverObj && coverObj !== u) {
    const old = coverObj
    setTimeout(() => URL.revokeObjectURL(old), 2000) // 延迟释放，等 <img> 换上新 src 再回收
  }
  coverObj = u
  coverSrc.value = u
}
async function fetchCover(it: any): Promise<string> {
  if (!COVER_EXTS.includes((it.ext || '').toLowerCase())) return ''
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(coverUrl(it.policyId, it.path), { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return ''
    const blob = await res.blob()
    if (blob.size > 4 * 1024 * 1024) return '' // 异常大图丢弃
    return URL.createObjectURL(blob)
  } catch { return '' }
}

// ---- 观看进度（用户设置 KV：media_progress）----
type Prog = { pos: number; dur: number; at: number }
let progress: Record<string, Prog> = {}
let progressLoaded = false
let lastSaved = 0
function progKey(it: any) { return it.policyId + ':' + it.path }
async function ensureProgress() {
  if (progressLoaded) return
  progressLoaded = true
  try {
    const m = await settingsApi.get(['media_progress'])
    const v = m['media_progress']
    if (v) {
      const o = JSON.parse(v)
      if (o && typeof o === 'object') progress = o
    }
  } catch { progress = {} }
}
function curPosDur(): [number, number] {
  if (isVideo.value && art) return [art.currentTime, art.duration]
  if (ap) return [ap.audioTime, ap.duration]
  return [0, 0]
}
function saveProgress() {
  const it = current.value
  if (!it) return
  const [pos, dur] = curPosDur()
  if (!Number.isFinite(pos) || !Number.isFinite(dur) || !dur || pos < 5 || pos > dur - 5) return
  progress[progKey(it)] = { pos: Math.floor(pos), dur: Math.floor(dur), at: Date.now() }
  settingsApi.set('media_progress', JSON.stringify(progress)).catch(() => {})
}
function clearProgress() {
  const it = current.value
  if (!it) return
  if (progress[progKey(it)]) {
    delete progress[progKey(it)]
    settingsApi.set('media_progress', JSON.stringify(progress)).catch(() => {})
  }
}

// ---- 视频海报（用户设置 KV：media_posters，dataURL，LRU 48 张）----
// 播放时抓取 ~1s 处的帧画到 canvas（同源 raw 流，canvas 不会被污染），
// 存进 KV 供媒体中心网格/继续观看显示真实缩略图；超过上限按插入顺序淘汰最旧
const POSTER_MAX = 48
let posters: Record<string, string> = {}
let postersLoaded = false
async function ensurePosters() {
  if (postersLoaded) return
  postersLoaded = true
  try {
    const m = await settingsApi.get(['media_posters'])
    const v = m['media_posters']
    if (v) {
      const o = JSON.parse(v)
      if (o && typeof o === 'object') posters = o
    }
  } catch { posters = {} }
}
function savePoster(key: string, dataUrl: string) {
  posters[key] = dataUrl
  const keys = Object.keys(posters)
  if (keys.length > POSTER_MAX) {
    for (const k of keys.slice(0, keys.length - POSTER_MAX)) delete posters[k]
  }
  settingsApi.set('media_posters', JSON.stringify(posters)).catch(() => {})
  // 通知开着的媒体中心即时刷新（无媒体中心时事件被忽略）
  window.dispatchEvent(new CustomEvent('cp-media-poster', { detail: { key, url: dataUrl } }))
}
async function capturePoster() {
  const it = current.value
  if (!it || !isVideo.value || !art) return
  const key = it.policyId + ':' + it.path
  await ensurePosters()
  if (posters[key]) return
  const v = artEl.value?.querySelector('video')
  if (!v) return
  const dur = v.duration
  if (!Number.isFinite(dur) || dur <= 2) return // 过短的视频不值得存海报
  v.addEventListener('seeked', () => {
    try {
      const w = v.videoWidth, h = v.videoHeight
      if (!w || !h) return
      const scale = Math.min(1, 320 / w)
      const cv = document.createElement('canvas')
      cv.width = Math.round(w * scale)
      cv.height = Math.round(h * scale)
      const ctx = cv.getContext('2d')
      if (!ctx) return
      ctx.drawImage(v, 0, 0, cv.width, cv.height)
      const url = cv.toDataURL('image/jpeg', 0.6)
      if (url.length > 120 * 1024) return // 异常大图丢弃
      savePoster(key, url)
    } catch { /* 解码/画布失败：静默放弃 */ }
  }, { once: true })
  v.currentTime = Math.min(1, dur * 0.1)
}

function go(i: number) {
  if (i < 0 || i >= list.value.length) return
  idx.value = i
}

async function loadLrc(item: any): Promise<string> {
  try {
    const dir = item.path.slice(0, item.path.lastIndexOf('/')) || '/'
    const dot = item.name.lastIndexOf('.')
    const base = dot > 0 ? item.name.slice(0, dot) : item.name
    const d = await fsApi.list(item.policyId, dir)
    const lrc = d.items.find((i: any) => !i.isDir && i.ext === 'lrc' && i.name.startsWith(base))
    if (lrc) {
      const t = await fsApi.readText(item.policyId, lrc.path)
      return t.content
    }
  } catch {}
  return ''
}

async function loadSubtitle(): Promise<any> {
  try {
    const dir = current.value.path.slice(0, current.value.path.lastIndexOf('/')) || '/'
    const dot = current.value.name.lastIndexOf('.')
    const base = dot > 0 ? current.value.name.slice(0, dot) : current.value.name
    const d = await fsApi.list(current.value.policyId, dir)
    const sub = d.items.find((i: any) => !i.isDir && ['vtt', 'srt'].includes(i.ext) && i.name.startsWith(base))
    if (sub) {
      return { url: rawUrl(current.value.policyId, sub.path), type: sub.ext as 'vtt' | 'srt',
        style: { color: '#fff', fontSize: '16px', textShadow: '0 1px 3px rgba(0,0,0,.9)' } }
    }
  } catch {}
  return undefined
}

async function build() {
  const token = ++building
  await nextTick()
  if (token !== building) return
  destroy()
  if (!current.value) return
  // 续播点：显式 startAt（媒体中心「继续观看」）优先，其次已保存进度
  await ensureProgress()
  const saved = progress[progKey(current.value)]
  const startAt = Number(props.props?.startAt) > 0
    ? Number(props.props.startAt)
    : (saved && saved.pos > 5 && saved.dur > 0 && saved.pos < saved.dur * 0.9 ? saved.pos : 0)
  if (isVideo.value) {
    if (!artEl.value) return
    const subtitle = await loadSubtitle()
    if (token !== building) return
    const opts: any = {
      container: artEl.value,
      url: rawUrl(current.value.policyId, current.value.path),
      autoplay: true,
      volume: 0.8,
      theme: '#4cc2ff',
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      flip: true,
      miniProgressBar: true,
      screenshot: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      moreVideoAttr: { playsInline: true, preload: 'metadata' },
    }
    if (subtitle) opts.subtitle = subtitle
    art = new Artplayer(opts)
    // Artplayer 5.x：原生 video 事件统一以 video: 前缀重新 emit（video:pause/video:timeupdate/video:ended），
    // 且 on() 第三参是 ctx 而非 options——一次性监听要用 art.once()
    if (startAt > 0) {
      art.once('ready', () => {
        setTimeout(() => { if (art && Number.isFinite(art.duration) && startAt < art.duration - 3) art.currentTime = startAt }, 400)
      })
    }
    // 视频海报：ready 后抓 ~1s 帧存 KV（与 startAt seek 互不干扰——先抓帧再跳续播点）
    art.on('ready', () => { setTimeout(capturePoster, 300) })
    art.on('video:timeupdate', () => {
      const now = Date.now()
      if (now - lastSaved > 10000) { lastSaved = now; saveProgress() }
    })
    art.on('video:pause', () => saveProgress())
    art.on('video:ended', () => { clearProgress(); if (idx.value < list.value.length - 1) go(idx.value + 1) })
  } else {
    if (!apEl.value) return
    const lrc = await loadLrc(current.value)
    const pic = await fetchCover(current.value)
    if (token !== building) return
    hasLrc.value = !!lrc
    setCover(pic)
    const audio: any = { name: current.value.name, artist: 'CloudPan', url: rawUrl(current.value.policyId, current.value.path), theme: '#4cc2ff' }
    if (pic) audio.pic = pic
    const apOpts: any = { container: apEl.value, theme: '#4cc2ff', autoplay: true, volume: 0.8, audio: [audio] }
    if (lrc) { audio.lrc = lrc; apOpts.lrcType = 2 }
    ap = new APlayer(apOpts)
    if (startAt > 0) {
      ap.on('ready', () => {
        setTimeout(() => { if (ap && Number.isFinite(ap.duration) && startAt < ap.duration - 3) ap.seekTo(startAt) }, 400)
      })
    }
    ap.on('timeupdate', () => {
      const now = Date.now()
      if (now - lastSaved > 10000) { lastSaved = now; saveProgress() }
    })
    ap.on('pause', () => saveProgress())
    ap.on('ended', () => clearProgress())
  }
}

function destroy() {
  art?.destroy(false); art = null
  ap?.destroy(); ap = null
  setCover('')
}

watch([idx, isVideo], build)
onMounted(build)
onBeforeUnmount(() => { saveProgress(); destroy() })
</script>

<style scoped>
.mv-root { background: radial-gradient(1200px 600px at 50% -10%, #1c2430, #0b0e13); }
.mv-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px 18px; }
.mv-art { flex: 1; min-height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.55); }
.mv-audio { align-items: center; justify-content: center; gap: 22px; }
.mv-head { display: flex; align-items: center; gap: 16px; width: min(560px, 92%); }
.mv-cover { width: 76px; height: 76px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #ff7eb3, #8a6ef0); box-shadow: 0 10px 30px rgba(138,110,240,.35); flex: none; overflow: hidden; }
.mv-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mv-title { font-size: 16px; font-weight: 600; color: #eef3fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mv-sub { font-size: 12px; color: #8fa5bd; margin-top: 4px; }
.mv-nolrc { font-size: 12px; color: #5c6b7e; }
.mv-name { font-size: 12px; color: var(--text-3); max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* APlayer 深色融合 */
.mv-audio :deep(.aplayer) { width: min(560px, 92%); background: rgba(255,255,255,.05); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
.mv-audio :deep(.aplayer .aplayer-lrc) { text-shadow: none; }
.mv-audio :deep(.aplayer .aplayer-lrc p) { color: #c8d4e2; }
.mv-audio :deep(.aplayer .aplayer-lrc .aplayer-lrc-current) { color: #4cc2ff; }
.mv-audio :deep(.aplayer .aplayer-info .aplayer-music .aplayer-title) { color: #eef3fa; }
</style>
