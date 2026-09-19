<template>
  <div class="app-root">
    <div class="app-toolbar ie-bar">
      <button class="tool-btn" @click="rotate(-90)" :disabled="!loaded" title="向左旋转 90°"><AppIcon name="rotate" :size="15" /></button>
      <button class="tool-btn" @click="rotate(90)" :disabled="!loaded" title="向右旋转 90°"><AppIcon name="rotateR" :size="15" /></button>
      <button class="tool-btn" @click="flipH = !flipH" :disabled="!loaded" :class="{ on: flipH }" title="水平翻转"><AppIcon name="flipH" :size="15" /></button>
      <button class="tool-btn" @click="flipV = !flipV" :disabled="!loaded" :class="{ on: flipV }" title="垂直翻转"><AppIcon name="flipV" :size="15" /></button>
      <div class="tool-sep"></div>
      <label class="ie-ctl"><span>亮度</span><input type="range" min="0" max="200" v-model.number="brightness" :disabled="!loaded" @input="render" /></label>
      <label class="ie-ctl"><span>对比度</span><input type="range" min="0" max="200" v-model.number="contrast" :disabled="!loaded" @input="render" /></label>
      <label class="ie-ctl"><span>饱和度</span><input type="range" min="0" max="200" v-model.number="saturate" :disabled="!loaded" @input="render" /></label>
      <button class="tool-btn" @click="resetFx" :disabled="!loaded" title="重置调整"><AppIcon name="refresh" :size="15" /></button>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ fileName }}{{ loaded ? ` · ${W}×${H}` : '' }}</span>
      <div class="tool-sep"></div>
      <button class="tool-btn primary" @click="save" :disabled="!canSave || !loaded || saving">
        <AppIcon name="check" :size="15" />{{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
    <div style="flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #20242b; min-height: 0">
      <div v-if="!loaded" style="color: var(--text-3); font-size: 13px">{{ status }}</div>
      <canvas ref="cv" style="max-width: 100%; max-height: 100%; box-shadow: 0 2px 16px rgba(0,0,0,.5)"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fsApi, rawUrl } from '../api/modules'
import { post, put } from '../api/http'
import { useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

// 图片编辑器（canvas 实现）：rawUrl 取原图 → canvas 变换（旋转/翻转/亮度/对比度/饱和度）；
// 保存 = canvas.toBlob（保持原 mime，jpeg q0.92）经分块上传覆盖原文件（OfficeEditor 同款）。
const props = defineProps<{ winId: number; props: any }>()
const toast = useToast()

const policyId = ref(props.props?.policyId || 0)
const path = ref(props.props?.path || '')
const ext = (props.props?.ext || (path.value.split('.').pop() || '')).toLowerCase()
const fileName = computed(() => (path.value || '未命名').split('/').pop() || '未命名')
const canSave = computed(() => !!policyId.value && !!path.value)

const cv = ref<HTMLCanvasElement>()
const loaded = ref(false)
const status = ref('正在加载图片…')
const saving = ref(false)
const W = ref(0), H = ref(0)

// 变换状态
const rot = ref(0)          // 0/90/180/270
const flipH = ref(false)
const flipV = ref(false)
const brightness = ref(100) // 0-200，100=原样
const contrast = ref(100)
const saturate = ref(100)

let src: HTMLImageElement | null = null

onMounted(async () => {
  if (!policyId.value || !path.value) { status.value = '只读'; return }
  try {
    const res = await fetch(rawUrl(policyId.value, path.value))
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    src = bmp instanceof HTMLImageElement ? bmp as any : await toImage(bmp)
    W.value = bmp.width; H.value = bmp.height
    loaded.value = true
    status.value = '就绪'
    render()
  } catch (e: any) {
    status.value = '加载失败：' + (e?.message || e)
  }
})

// createImageBitmap 返回 ImageBitmap，统一转 HTMLImageElement 便于复用
async function toImage(bmp: ImageBitmap): Promise<HTMLImageElement> {
  const c = document.createElement('canvas')
  c.width = bmp.width; c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  const img = new Image()
  img.src = c.toDataURL()
  await new Promise(r => { img.onload = r })
  return img
}

function render() {
  if (!cv.value || !src) return
  const rotate = (rot.value / 90) % 2 !== 0
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height
  cv.value.width = rotate ? h : w
  cv.value.height = rotate ? w : h
  const ctx = cv.value.getContext('2d')!
  ctx.clearRect(0, 0, cv.value.width, cv.value.height)
  ctx.save()
  ctx.filter = `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturate.value}%)`
  ctx.translate(cv.value.width / 2, cv.value.height / 2)
  ctx.rotate(rot.value * Math.PI / 180)
  ctx.scale(flipH.value ? -1 : 1, flipV.value ? -1 : 1)
  ctx.drawImage(src, -w / 2, -h / 2)
  ctx.restore()
}

function rotate(deg: number) { rot.value = ((rot.value + deg) % 360 + 360) % 360; render() }
function resetFx() { rot.value = 0; flipH.value = false; flipV.value = false; brightness.value = 100; contrast.value = 100; saturate.value = 100; render() }

// 与 OfficeEditor 一致的分块上传覆盖
async function save() {
  if (!canSave.value || !cv.value || saving.value) return
  saving.value = true
  try {
    const mime = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
      : 'image/jpeg'
    const blob = await new Promise<Blob | null>(r => cv.value!.toBlob(r, mime === 'image/png' || mime === 'image/gif' ? undefined : 0.92))
    if (!blob) throw new Error('导出图片失败')
    const buf = new Uint8Array(await blob.arrayBuffer())
    const parent = path.value.substring(0, path.value.lastIndexOf('/')) || '/'
    const name = (path.value.split('/').pop() || 'image')
    const initResp: any = await post('/upload/init', {
      policyId: policyId.value, parent, name,
      size: buf.byteLength, chunkSize: 8 * 1024 * 1024, hash: ''
    })
    if (!initResp.instant) {
      const chunkSize = 8 * 1024 * 1024
      const chunks = Math.ceil(buf.byteLength / chunkSize)
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, buf.byteLength)
        await put(`/upload/chunk/${initResp.sessionId}/${i}`, buf.slice(start, end), {
          headers: { 'Content-Type': 'application/octet-stream' }, timeout: 0
        })
      }
      await post('/upload/complete', { sessionId: initResp.sessionId })
    }
    toast.success('保存成功')
    window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId: policyId.value, path: parent } }))
  } catch (e: any) {
    toast.error('保存失败：' + (e?.message || e))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ie-bar { flex-wrap: wrap; gap: 6px 4px; padding: 6px 10px }
.ie-ctl { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-3) }
.ie-ctl input { width: 84px; accent-color: var(--accent, #2f7ce8) }
.ie-ctl span { min-width: 44px }
.tool-btn.on { background: var(--accent, #2f7ce8); color: #fff }
</style>
