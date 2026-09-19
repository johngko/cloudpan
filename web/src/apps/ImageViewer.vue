<template>
  <div class="app-root iv-root" ref="rootEl">
    <div class="app-toolbar iv-toolbar">
      <button class="tool-btn" :disabled="idx <= 0" @click="go(idx - 1)" title="上一张（←）"><AppIcon name="back" :size="15" /></button>
      <button class="tool-btn" :disabled="idx >= list.length - 1" @click="go(idx + 1)" title="下一张（→）"><AppIcon name="fwd" :size="15" /></button>
      <div class="tool-sep"></div>
      <button class="tool-btn" @click="zoomBy(-0.2)" title="缩小（-）"><AppIcon name="min" :size="15" /></button>
      <span class="iv-zoom" @click="fitToggle" title="点击适应窗口">{{ Math.round(zoom * 100) }}%</span>
      <button class="tool-btn" @click="zoomBy(0.2)" title="放大（+）"><AppIcon name="plus" :size="15" /></button>
      <div class="tool-sep"></div>
      <button class="tool-btn" @click="rot = (rot + 270) % 360" title="向左旋转"><AppIcon name="rotate2" :size="15" /></button>
      <button class="tool-btn" @click="rot = (rot + 90) % 360" title="向右旋转（R）"><AppIcon name="refresh" :size="15" /></button>
      <button class="tool-btn" @click="flipH = !flipH" title="水平翻转"><AppIcon name="flip" :size="15" /></button>
      <div class="tool-sep"></div>
      <button class="tool-btn" :class="{ active: exifOpen }" @click="toggleExif" title="EXIF 信息（I）"><AppIcon name="info" :size="15" /></button>
      <button class="tool-btn" @click="toggleFs" title="全屏（F）"><AppIcon name="expand" :size="15" /></button>
      <button class="tool-btn" @click="download" title="下载原图"><AppIcon name="download" :size="15" /></button>
      <div style="flex: 1"></div>
      <span class="iv-name">{{ current?.name }}<template v-if="list.length > 1"> · {{ idx + 1 }} / {{ list.length }}</template></span>
    </div>
    <div class="iv-main">
    <div class="iv-stage" ref="stageEl"
      @wheel.prevent="onWheel" @dblclick="fitToggle"
      @mousedown="startDrag" @mousemove="onDrag" @mouseup="endDrag" @mouseleave="endDrag">
      <img v-if="current" :src="rawUrl(current.policyId, current.path)" referrerpolicy="no-referrer" draggable="false"
        :class="{ dragging }" :style="imgStyle" />
      <div v-else class="empty-hint" style="color: #5c6b7e">没有可显示的图片</div>
      <button v-if="idx > 0" class="iv-nav left" @click.stop="go(idx - 1)"><AppIcon name="back" :size="18" /></button>
      <button v-if="idx < list.length - 1" class="iv-nav right" @click.stop="go(idx + 1)"><AppIcon name="fwd" :size="18" /></button>
    </div>
    <!-- EXIF 信息面板 -->
    <div v-if="exifOpen" class="iv-exif">
      <div class="iv-exif-title">EXIF 信息</div>
      <div v-if="exifLoading" class="iv-exif-empty">解析中…</div>
      <div v-else-if="!exifRows.length" class="iv-exif-empty">此图片没有 EXIF 信息</div>
      <template v-else>
        <div v-for="(r, i) in exifRows" :key="i" class="iv-exif-row">
          <span class="iv-exif-k">{{ r.k }}</span>
          <span class="iv-exif-v">{{ r.v }}</span>
        </div>
        <a v-if="gpsLink" class="iv-exif-gps" :href="gpsLink" target="_blank" rel="noopener">在地图中查看拍摄位置 ↗</a>
      </template>
    </div>
    </div>
    <div v-if="list.length > 1" class="iv-film">
      <div v-for="(it, i) in list" :key="it.path" class="iv-thumb" :class="{ active: i === idx }" @click="go(i)" :title="it.name">
        <img :src="rawUrl(it.policyId, it.path)" loading="lazy" draggable="false" referrerpolicy="no-referrer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { rawUrl, downloadUrl } from '../api/modules'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()

const list = ref<any[]>(props.props?.list?.length ? props.props.list : [props.props])
const idx = ref(Math.max(0, list.value.findIndex((x: any) => x.path === props.props?.path)))
const current = computed(() => list.value[idx.value])

const zoom = ref(1)
const rot = ref(0)
const flipH = ref(false)
const ox = ref(0)
const oy = ref(0)
const dragging = ref(false)
const rootEl = ref<HTMLElement>()
const stageEl = ref<HTMLElement>()

// EXIF 信息面板
const exifOpen = ref(false)
const exifLoading = ref(false)
const exifRows = ref<{ k: string; v: string }[]>([])
const gpsLink = ref('')
let exifSeq = 0
function toggleExif() {
  exifOpen.value = !exifOpen.value
  if (exifOpen.value) loadExif()
}
async function loadExif() {
  const it = current.value
  if (!it) return
  const seq = ++exifSeq
  exifLoading.value = true
  exifRows.value = []
  gpsLink.value = ''
  try {
    const resp = await fetch(rawUrl(it.policyId, it.path))
    if (!resp.ok) throw new Error('raw fetch ' + resp.status)
    const buf = await resp.arrayBuffer()
    const exifr: any = await import('exifr')
    // exifr 7.x：单次 parse 读取全部段（含 GPS，自动算出 latitude/longitude）
    const data: any = await exifr.parse(buf)
    if (seq !== exifSeq) return // 已切到其他图片
    const rows: { k: string; v: string }[] = []
    const push = (k: string, v: any) => {
      if (v === undefined || v === null || v === '') return
      rows.push({ k, v: typeof v === 'number' ? String(+v.toFixed(2)) : String(v) })
    }
    const when = data.DateTimeOriginal || data.CreateDate
    if (when instanceof Date) push('拍摄时间', when.toLocaleString())
    if (data.Make || data.Model) push('相机', [data.Make, data.Model].filter(Boolean).join(' '))
    if (data.LensModel) push('镜头', data.LensModel)
    if (data.FocalLength) push('焦距', data.FocalLength + ' mm')
    if (data.FNumber) push('光圈', 'f/' + data.FNumber)
    if (data.ExposureTime) push('快门', data.ExposureTime < 1 ? '1/' + Math.round(1 / data.ExposureTime) + ' s' : data.ExposureTime + ' s')
    if (data.ISO) push('ISO', data.ISO)
    if (data.WhiteBalance) push('白平衡', data.WhiteBalance)
    if (data.MeteringMode) push('测光模式', data.MeteringMode)
    if (data.ExposureProgram) push('曝光程序', data.ExposureProgram)
    if (data.Width && data.Height) push('尺寸', data.Width + ' × ' + data.Height)
    if (data.Artist) push('作者', data.Artist)
    if (data.Software) push('软件', data.Software)
    if (data.Copyright) push('版权', data.Copyright)
    exifRows.value = rows
    if (data.latitude != null && data.longitude != null) {
      const lat = +Number(data.latitude).toFixed(6), lon = +Number(data.longitude).toFixed(6)
      push('GPS', lat + ', ' + lon)
      gpsLink.value = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
      exifRows.value = rows
    }
  } catch {
    if (seq === exifSeq) exifRows.value = []
  } finally {
    if (seq === exifSeq) exifLoading.value = false
  }
}
let sx = 0, sy = 0, boxX = 0, boxY = 0

const imgStyle = computed(() => ({
  transform: `translate(${ox.value}px, ${oy.value}px) scale(${zoom.value}) rotate(${rot.value}deg) scaleX(${flipH.value ? -1 : 1})`,
  maxWidth: '92%', maxHeight: '92%', userSelect: 'none',
}))

function go(i: number) {
  if (i < 0 || i >= list.value.length) return
  idx.value = i
}
watch(idx, () => {
  zoom.value = 1; rot.value = 0; flipH.value = false; ox.value = 0; oy.value = 0
  if (exifOpen.value) loadExif()
})

function zoomBy(d: number) {
  zoom.value = Math.min(8, Math.max(0.1, +(zoom.value + d).toFixed(2)))
  if (zoom.value <= 1.001 && rot.value % 360 === 0) { ox.value = 0; oy.value = 0 }
}
function fitToggle() {
  if (zoom.value === 1) zoom.value = Math.max(1.4, Math.min(4, +(zoom.value * 2).toFixed(2)))
  else { zoom.value = 1; ox.value = 0; oy.value = 0 }
}
function onWheel(e: WheelEvent) { zoomBy(e.deltaY < 0 ? 0.15 : -0.15) }

function startDrag(e: MouseEvent) {
  if (zoom.value <= 1) return
  dragging.value = true
  sx = e.clientX; sy = e.clientY; boxX = ox.value; boxY = oy.value
}
function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  ox.value = boxX + e.clientX - sx
  oy.value = boxY + e.clientY - sy
}
function endDrag() { dragging.value = false }

function toggleFs() {
  if (document.fullscreenElement) document.exitFullscreen()
  else rootEl.value?.requestFullscreen?.()
}
function download() {
  if (current.value) window.open(downloadUrl(current.value.policyId, [current.value.path]))
}

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return
  if (e.key === 'ArrowLeft') go(idx.value - 1)
  else if (e.key === 'ArrowRight') go(idx.value + 1)
  else if (e.key === '+' || e.key === '=') zoomBy(0.2)
  else if (e.key === '-') zoomBy(-0.2)
  else if (e.key.toLowerCase() === 'r') rot.value = (rot.value + 90) % 360
  else if (e.key.toLowerCase() === 'f') toggleFs()
  else if (e.key.toLowerCase() === 'i') toggleExif()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.iv-root { background: radial-gradient(1100px 560px at 50% -8%, #1a222d, #0a0d12); }
.iv-toolbar { background: rgba(255,255,255,.04); }
.iv-zoom { font-size: 12px; color: #8fa5bd; min-width: 44px; text-align: center; cursor: pointer; }
.iv-name { font-size: 12px; color: #8fa5bd; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iv-main { flex: 1; min-height: 0; display: flex; }
.iv-exif {
  width: 252px; flex: none; overflow-y: auto; padding: 12px 14px;
  background: rgba(13,17,23,.92); border-left: 1px solid rgba(255,255,255,.07);
  backdrop-filter: blur(8px); font-size: 12px;
}
.iv-exif-title { font-size: 12px; font-weight: 600; color: #c8d4e2; letter-spacing: 1px; margin-bottom: 10px; }
.iv-exif-row { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px dashed rgba(255,255,255,.06); }
.iv-exif-k { color: #7d92a8; flex: none; }
.iv-exif-v { color: #dbe6f2; text-align: right; word-break: break-all; }
.iv-exif-empty { color: #5c6b7e; padding: 12px 0; }
.iv-exif-gps { display: inline-block; margin-top: 10px; color: #4cc2ff; text-decoration: none; font-size: 12px; }
.iv-exif-gps:hover { text-decoration: underline; }
.iv-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; position: relative;
  background:
    linear-gradient(45deg, #10151c 25%, transparent 25%, transparent 75%, #10151c 75%) 0 0 / 22px 22px,
    linear-gradient(45deg, #10151c 25%, transparent 25%, transparent 75%, #10151c 75%) 11px 11px / 22px 22px,
    #141a22; }
.iv-stage img { border-radius: 4px; box-shadow: 0 14px 50px rgba(0,0,0,.6); cursor: zoom-in; transition: box-shadow .2s; }
.iv-stage img.dragging { cursor: grabbing; }
.iv-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 42px; height: 42px; border-radius: 50%;
  border: none; background: rgba(20,26,34,.72); color: #c8d4e2; display: flex; align-items: center; justify-content: center;
  cursor: pointer; backdrop-filter: blur(6px); transition: background .15s; }
.iv-nav:hover { background: rgba(60,140,220,.85); color: #fff; }
.iv-nav.left { left: 14px; }
.iv-nav.right { right: 14px; }
.iv-film { flex: none; display: flex; gap: 8px; padding: 10px 14px; overflow-x: auto; background: rgba(255,255,255,.03); border-top: 1px solid rgba(255,255,255,.06); }
.iv-film::-webkit-scrollbar { height: 6px; }
.iv-film::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 3px; }
.iv-thumb { flex: none; width: 64px; height: 48px; border-radius: 6px; overflow: hidden; cursor: pointer; opacity: .55;
  outline: 2px solid transparent; outline-offset: 1px; transition: all .15s; display: flex; align-items: center; justify-content: center; background: #0d1117; }
.iv-thumb:hover { opacity: .9; }
.iv-thumb.active { opacity: 1; outline-color: #4cc2ff; }
.iv-thumb img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
</style>
