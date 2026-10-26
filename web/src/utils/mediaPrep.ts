// B7 媒体预览边车（浏览器端生成）：上传完成后异步回填
//   视频 → 逐时刻 seek 取帧 + Worker 拼 sprite PNG + 均匀时间映射（Artplayer thumbnails 格式）
//   音频 → decodeAudioData 降采样波形峰值
// 服务端零 ffmpeg；边车按 属主+kind+路径+size+mtime 键缓存，文件改写后自动失效。
// 只对浏览器端新上传生效（WebDAV/旧文件无），全部失败静默降级，不影响上传结果。
import { previewUpload, pvUrl } from '../api/modules'

export const VIDEO_EXT = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4v', 'avi', 'ts', 'flv', 'wmv'])
export const AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'aiff', 'aif', 'amr', 'wma'])

// 规模闸门：视频 seek 取帧不吃内存但耗 CPU；音频 decodeAudioData 需要整文件解码
// 注意：JS 移位是 32 位——4<<30 会溢出成 0，视频上限用乘法
const VIDEO_MAX = 4 * (1 << 30)
const AUDIO_MAX = 150 * (1 << 20)

// 串行队列：批量上传后边车生成排队进行，避免十几个视频同时抢解码线程
const queue: (() => Promise<void>)[] = []
let busy = false
async function drain() {
  if (busy) return
  busy = true
  while (queue.length) {
    const job = queue.shift()!
    try { await job() } catch (e) { console.warn('[CloudPan 预览边车]', e) }
  }
  busy = false
}

/** 上传完成后的边车调度入口（transfer 泵调用；一切失败静默） */
export function scheduleMediaSidecar(t: { policyId: number; parent: string; name: string; size: number; file?: File }) {
  if (!t.file || t.size <= 0) return
  const ext = (t.name.includes('.') ? t.name.slice(t.name.lastIndexOf('.') + 1) : '').toLowerCase()
  const isVideo = VIDEO_EXT.has(ext) && t.size <= VIDEO_MAX
  const isAudio = AUDIO_EXT.has(ext) && t.size <= AUDIO_MAX
  if (!isVideo && !isAudio) return
  const vp = (t.parent === '/' || !t.parent ? '' : t.parent) + '/' + t.name
  queue.push(async () => {
    if (isVideo) {
      const built = await makeVideoSprite(t.file!)
      if (built) await previewUpload(t.policyId, vp, built.meta, built.blob)
    } else {
      const meta = await makeWavePeaks(t.file!)
      if (meta) await previewUpload(t.policyId, vp, meta)
    }
  })
  drain()
}

// ---- 视频 sprite ----

export interface VideoSpriteMeta {
  kind: 'video'; n: number; cols: number; w: number; h: number; length: number
}

const SPRITE_COLS = 10
const SPRITE_CELL_W = 160
const SPRITE_CELL_H = 90

function seekTo(v: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(to)
      v.removeEventListener('seeked', on)
      v.removeEventListener('error', onErr)
    }
    const on = () => { cleanup(); requestAnimationFrame(() => resolve()) }
    const onErr = () => { cleanup(); reject(new Error('seek 失败')) }
    const to = setTimeout(() => { cleanup(); reject(new Error('seek 超时')) }, 6000)
    v.addEventListener('seeked', on)
    v.addEventListener('error', onErr)
    v.currentTime = time
  })
}

/** 抽帧（主线程只做 seek + createImageBitmap）→ Worker 拼图编码 */
export async function makeVideoSprite(file: File): Promise<{ meta: VideoSpriteMeta; blob: Blob } | null> {
  const url = URL.createObjectURL(file)
  try {
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'auto'
    v.src = url
    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('metadata 超时')), 15000)
      v.addEventListener('loadedmetadata', () => { clearTimeout(to); resolve() }, { once: true })
      v.addEventListener('error', () => { clearTimeout(to); reject(new Error('浏览器无法解码该视频')) }, { once: true })
    })
    const dur = v.duration
    if (!isFinite(dur) || dur < 2) return null
    // 帧数：约每 4s 一帧，10~60 帧；浏览器解不了编码/坏帧导致中段失败时截断保留前缀，
    // 保持「均匀间隔」假设（Artplayer 按 dur/n 映射帧位）
    const target = Math.min(60, Math.max(10, Math.round(dur / 4)))
    const frames: ImageBitmap[] = []
    for (let i = 0; i < target; i++) {
      const t = dur * (i + 0.5) / target
      try {
        await seekTo(v, Math.min(t, dur - 0.05))
        frames.push(await createImageBitmap(v))
      } catch { break }
    }
    v.removeAttribute('src')
    v.load()
    if (frames.length < 6) return null
    const blob = await composeSprite(frames)
    return {
      blob,
      meta: { kind: 'video', n: frames.length, cols: SPRITE_COLS, w: SPRITE_CELL_W, h: SPRITE_CELL_H, length: Math.round(dur) }
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function composeSprite(frames: ImageBitmap[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let w: Worker
    try {
      w = new Worker(new URL('../workers/sprite.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) { reject(e); return }
    w.onmessage = (e: MessageEvent<{ blob?: Blob; error?: string }>) => {
      w.terminate()
      if (e.data.blob) resolve(e.data.blob)
      else reject(new Error(e.data.error || 'sprite 拼图失败'))
    }
    w.onerror = () => { w.terminate(); reject(new Error('sprite Worker 失败')) }
    w.postMessage({ frames, cols: SPRITE_COLS, cellW: SPRITE_CELL_W, cellH: SPRITE_CELL_H }, frames)
  })
}

// ---- 音频波形 ----

export interface WaveMeta {
  kind: 'audio'; duration: number; peaks: number[]
}

/** decodeAudioData（原生解码在浏览器内部线程）后按桶取绝对值峰值；纯 JS 只有降采样循环 */
export async function makeWavePeaks(file: File): Promise<WaveMeta | null> {
  const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  let ab: ArrayBuffer
  try { ab = await file.arrayBuffer() } catch { return null }
  const ctx = new AC()
  let buf: AudioBuffer
  try {
    buf = await ctx.decodeAudioData(ab)
  } catch {
    return null // 浏览器解不了（wma/ape 等）：无波形
  } finally {
    ctx.close()
  }
  const data = buf.getChannelData(0)
  const buckets = Math.min(2000, Math.max(200, Math.floor(buf.duration * 2)))
  const block = Math.max(1, Math.floor(data.length / buckets))
  const peaks: number[] = []
  for (let i = 0; i < buckets; i++) {
    let mx = 0
    const end = Math.min(data.length, i * block + block)
    for (let j = i * block; j < end; j++) {
      const s = Math.abs(data[j])
      if (s > mx) mx = s
    }
    peaks.push(Math.round(Math.min(1, mx) * 1000) / 1000)
  }
  return { kind: 'audio', duration: Math.round(buf.duration * 100) / 100, peaks }
}

/** 播放器侧读取：无边车（404/异常）返回 null */
export async function fetchWave(policyId: number, path: string): Promise<WaveMeta | null> {
  try {
    const res = await fetch(pvUrl(policyId, path, 'json'))
    if (!res.ok) return null
    const meta = await res.json()
    if (meta?.kind === 'audio' && Array.isArray(meta.peaks)) return meta as WaveMeta
    return null
  } catch { return null }
}

export interface SpriteInfo {
  meta: VideoSpriteMeta
  pngUrl: string
}

/** 播放器侧读取视频 sprite 元数据；无则 null（png URL 拼好交给播放器） */
export async function fetchSprite(policyId: number, path: string): Promise<SpriteInfo | null> {
  try {
    const res = await fetch(pvUrl(policyId, path, 'json'))
    if (!res.ok) return null
    const meta = await res.json()
    if (meta?.kind !== 'video' || !meta.n) return null
    return { meta: meta as VideoSpriteMeta, pngUrl: pvUrl(policyId, path, 'png') }
  } catch { return null }
}
