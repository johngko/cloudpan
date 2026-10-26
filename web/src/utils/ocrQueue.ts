// C2 图片 OCR 入全文检索：上传完成后在浏览器端排队识别（tesseract.js wasm，
// 资产全部本地 /vendor/tesseract/，零外部请求），结果 POST /fs/ocr 存进 B1 索引。
// 队列存 IndexedDB：刷新/崩溃后继续；已完成集合按 策略|路径|大小 记游标，不重复识别。
// 用户可在 设置→上传 关闭（KV image_ocr=off）。识别是低优先级后台任务：串行、
// 空闲时跑（requestIdleCallback 兜底 setTimeout），单图 ≤8MB。
import { rawUrl, ocrApi, settingsApi } from '../api/modules'

const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp']
const MAX_SIZE = 8 * (1 << 20)

let queueStarted = false
let workerPromise: Promise<any> | null = null
let disabledCache: boolean | null = null
// 刚上传的文件 blob 只在本会话有效：URL 存内存，IDB 只存可重放的作业描述
const sessionBlobUrls = new Map<string, string>()

interface OcrJob {
  k: string // policyId|vp
  policyId: number
  path: string
  name: string
  size: number
}

// ---- IndexedDB：待处理队列 + 已完成游标 ----
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('cp_ocr', 1)
    rq.onupgradeneeded = () => {
      rq.result.createObjectStore('queue', { keyPath: 'k' })
      rq.result.createObjectStore('done', { keyPath: 'k' })
    }
    rq.onsuccess = () => resolve(rq.result)
    rq.onerror = () => reject(rq.error)
  })
}

async function idbGetAll(store: string): Promise<any[]> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const rq = db.transaction(store, 'readonly').objectStore(store).getAll()
    rq.onsuccess = () => resolve(rq.result)
    rq.onerror = () => reject(rq.error)
  })
}
async function idbPut(store: string, val: any): Promise<void> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(val)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbDel(store: string, k: string): Promise<void> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(k)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

async function ocrDisabled(): Promise<boolean> {
  if (disabledCache === null) {
    try { disabledCache = (await settingsApi.get(['image_ocr'])).image_ocr === 'off' }
    catch { disabledCache = false }
  }
  return disabledCache
}

/** 上传完成后调用：图片入队（刚上传的文件 blob 直接带上，省一次下载） */
export async function scheduleOcr(t: { policyId: number; parent: string; name: string; size: number; file?: File | null }): Promise<void> {
  try {
    if (await ocrDisabled()) return
    if (!IMG_EXTS.includes(extOf(t.name)) || t.size <= 0 || t.size > MAX_SIZE) return
    if (!t.file) return // blob 只在刚上传时可用；历史图片暂不补扫（游标也无法证明识别过）
    const vp = (t.parent === '/' ? '' : t.parent) + '/' + t.name
    const doneKey = `${t.policyId}|${vp}|${t.size}`
    const done = await idbGetAll('done')
    if (done.some(d => d.k === doneKey)) return
    const k = `${t.policyId}|${vp}`
    if (sessionBlobUrls.has(k)) return
    sessionBlobUrls.set(k, URL.createObjectURL(t.file))
    const job: OcrJob = { k, policyId: t.policyId, path: vp, name: t.name, size: t.size }
    await idbPut('queue', job)
    startOcrQueue()
  } catch { /* OCR 是锦上添花：任何失败都不影响上传主链路 */ }
}

/** 桌面启动后恢复未清队列（刷新后 blob 失效 → 走 /fs/raw 下载原图再识别） */
export function resumeOcrQueue(): void {
  void (async () => {
    try {
      if (await ocrDisabled()) return
      const list = await idbGetAll('queue')
      if (list.length) startOcrQueue()
    } catch { /* ignore */ }
  })()
}

function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      // 常驻复用（不 terminate）：后续图免去 wasm 重载与语言包重取
      return createWorker('eng+chi_sim', 1, {
        workerPath: '/vendor/tesseract/worker.min.js',
        corePath: '/vendor/tesseract/core',
        langPath: '/vendor/tesseract/lang'
      })
    })().catch(e => { workerPromise = null; throw e })
  }
  return workerPromise
}

function startOcrQueue() {
  if (queueStarted) return
  queueStarted = true
  void (async () => {
    try {
      for (;;) {
        // 空闲调度：用户正在操作时不抢 CPU
        await new Promise<void>(r => ((window as any).requestIdleCallback || ((f: () => void) => setTimeout(f, 2000)))(() => r()))
        const list = await idbGetAll('queue')
        if (!list.length) break
        const job: OcrJob = list[0]
        // 单图失败也出队（防死循环）：下次同名上传若 size 变化会再入队
        await runJob(job).catch(() => { /* ignore */ })
        await idbDel('queue', job.k)
        sessionBlobUrls.delete(job.k)
      }
    } finally {
      queueStarted = false
    }
  })()
}

async function runJob(job: OcrJob) {
  let src = sessionBlobUrls.get(job.k)
  if (!src) {
    // 刷新恢复的场景：blob 已失效，从网盘原图取（rawUrl 自带 ?t= 鉴权）
    const res = await fetch(rawUrl(job.policyId, job.path))
    if (!res.ok) return
    src = URL.createObjectURL(await res.blob())
  }
  const worker = await getWorker()
  const { data } = await worker.recognize(src)
  const text: string = (data.text || '').trim()
  if (text) {
    await ocrApi.save(job.policyId, job.path, text)
    await idbPut('done', { k: `${job.policyId}|${job.path}|${job.size}` })
  }
}
