import { defineStore } from 'pinia'
import { uploadApi, settingsApi, userShareApi, type UploadStatus } from '../api/modules'
import { sha256, Sha256, EMPTY_SHA256 } from '../utils/sha256'
import { scheduleMediaSidecar } from '../utils/mediaPrep'
import { useWindows } from './windows'
import { useToast } from './dialog'

export interface TransferTask {
  id: string
  name: string
  policyId: number
  parent: string
  size: number
  uploaded: number
  progress: number
  status: 'queued' | 'hashing' | 'uploading' | 'merging' | 'paused' | 'done' | 'error' | 'instant'
  /** 实时速度（B/s，滑动平均）：仅上传阶段有效，合并/排队/暂停为 0 */
  speed: number
  /** 速度采样锚点（≤1s 内的字节增量先累计，满 1s 折算成瞬时速度做 EMA） */
  speedMark?: { at: number; bytes: number }
  errMsg?: string
  sessionId?: string
  chunkSize?: number
  totalChunks?: number
  received: number[]
  file?: File
  /** 小文件（≤16MB）整块 buffer；大文件不驻留，逐片读取 */
  buffer?: ArrayBuffer
  hash?: string
  pausedFlag?: boolean
  /** pump 已认领（防止 await 间隙被重复调度导致并发重复上传） */
  claimed?: boolean
  /** 共享盘上传：目标共享 ID（落盘进共享创建者的目录）。缺省 = 上传到自己的盘 */
  shareId?: number
}

// 上传端点集合：共享盘任务只替换 init（分片/完成/状态/取消是同一套 /upload/*，
// 服务端按「会话归属 = 上传者」鉴权、并按会话里记下的落盘属主落盘），故泵逻辑完全复用。
/** init 返回：普通上传与共享盘分片上传同构（instant 命中时无 sessionId） */
interface UploadInitResult {
  instant: boolean
  path?: string
  sessionId?: string
  chunkSize?: number
  totalChunks?: number
  received?: number[]
}
interface UploadEndpoints {
  init: (d: { policyId: number; parent: string; name: string; size: number; chunkSize: number; hash: string }) => Promise<UploadInitResult>
  chunk: typeof uploadApi.chunk
  complete: typeof uploadApi.complete
  status: typeof uploadApi.status
  abort: typeof uploadApi.abort
}

/** 上传端点选择（导出供单测断言：共享任务只换 init，其余复用 /upload/*） */
export function uploadEndpoints(t: TransferTask): UploadEndpoints {
  if (!t.shareId) return uploadApi
  const shareId = t.shareId
  return {
    init: (d) => userShareApi.uploadInit(shareId, { rel: d.parent, name: d.name, size: d.size, chunkSize: d.chunkSize, hash: d.hash }),
    chunk: uploadApi.chunk,
    complete: uploadApi.complete,
    status: uploadApi.status,
    abort: uploadApi.abort
  }
}

/** 拖拽目录遍历会给 File 挂上相对路径（见 Explorer/SftpPanel 的 drop 处理） */
type FileWithRel = File & { __cpRel?: string }

/** 统一从 unknown 异常里取可读信息（替代到处 catch 后取 e.message 的写法） */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// 小文件快速路径阈值：以下整块读入内存（含 buffer 驻留）无压力
const SMALL_FILE = 16 << 20
// 大文件流式哈希/上传的读取块
const READ_CHUNK = 4 << 20
// 可选分片大小（上报 init；后端允许 1KB-64MB）
export const CHUNK_MB_OPTIONS = [4, 8, 16, 32] as const
export const CONCURRENCY_MIN = 1
export const CONCURRENCY_MAX = 8

export interface UploadPrefs { concurrency: number; chunkMB: number }
const DEFAULT_PREFS: UploadPrefs = { concurrency: 3, chunkMB: 8 }

// ---- B14 断点续传：文件指纹 → SHA-256 缓存（localStorage）----
// 会话续传本身由服务端兜底：InitUpload 按（用户,属主,策略,目录,名,大小,哈希）
// 命中活跃 uploading 会话并返回已收分片列表——刷新页面后重新选同一个文件，
// init 就拿到断点。客户端唯一多付的成本是整文件重算哈希（大文件可达数分钟）。
// 按指纹（策略|目录|名|大小|lastModified）缓存哈希：重选时直接复用，
// 秒传判定同样命中。只存指纹与哈希摘要，不存任何文件内容；200 条封顶，
// 超限砍最旧一半（插入序近似时间序）。
const HASH_CACHE_KEY = 'cp_uphash1'
function hashFingerprint(t: Pick<TransferTask, 'shareId' | 'policyId' | 'parent' | 'name' | 'size'>, file?: File): string {
  return `${t.shareId || 0}|${t.policyId}|${t.parent}|${t.name}|${t.size}|${file?.lastModified ?? 0}`
}
function loadHashCache(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(HASH_CACHE_KEY) || '{}')
    return v && typeof v === 'object' ? v as Record<string, string> : {}
  } catch { return {} }
}
function saveHashCache(t: TransferTask): void {
  if (!t.hash) return
  try {
    const m = loadHashCache()
    m[hashFingerprint(t, t.file)] = t.hash
    const ks = Object.keys(m)
    if (ks.length > 200) for (const k of ks.slice(0, ks.length - 100)) delete m[k]
    localStorage.setItem(HASH_CACHE_KEY, JSON.stringify(m))
  } catch { /* 配额满：放弃本次缓存，不影响上传 */ }
}

// B14：哈希全部移出主线程（worker 内 subtle 或纯 JS 增量），大文件哈希期间
// UI 不再卡顿。创建失败（旧内核/沙箱 webview）标记降级，回退原主线程路径。
let hashWorkerBroken = false
function hashInWorker(file: File, size: number): Promise<{ hash: string; buf?: ArrayBuffer }> {
  return new Promise((resolve, reject) => {
    let w: Worker
    try {
      w = new Worker(new URL('../workers/hash.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) { reject(e); return }
    w.onmessage = (e: MessageEvent<{ hash?: string; buf?: ArrayBuffer; error?: string }>) => {
      w.terminate()
      const d = e.data
      if (d.hash) resolve({ hash: d.hash, buf: d.buf })
      else reject(new Error(d.error || '哈希计算失败'))
    }
    w.onerror = () => { w.terminate(); reject(new Error('哈希 Worker 异常')) }
    w.postMessage({ file, size })
  })
}

// 虚拟路径拼接（slash 风格，parent 恒以 / 开头）
function joinVP(parent: string, sub: string): string {
  if (!sub) return parent
  if (parent === '/' || parent === '') return '/' + sub
  return parent + '/' + sub
}

export const useTransfer = defineStore('transfer', {
  state: () => ({
    tasks: [] as TransferTask[],
    visible: false,
    running: 0,
    progressTimers: new Map<string, number>(),
    speedTimer: 0,
    prefs: { ...DEFAULT_PREFS } as UploadPrefs,
    prefsLoaded: false
  }),
  getters: {
    activeCount: s => s.tasks.filter(t => t.status === 'uploading' || t.status === 'hashing' || t.status === 'merging').length,
    /** 全部活动任务的合计实时速度（B/s），面板标题展示 */
    totalSpeed: s => s.tasks.reduce((a, t) => a + (t.speed || 0), 0)
  },
  actions: {
    panel(v?: boolean) {
      this.visible = v === undefined ? !this.visible : v
    },
    /** 用户级上传设置（并发/分片），存服务端跟随账号；失败保持默认值 */
    async loadPrefs() {
      if (this.prefsLoaded) return
      try {
        const d = await settingsApi.get(['upload_concurrency', 'upload_chunk_size_mb'])
        const conc = parseInt(d?.upload_concurrency || '', 10)
        if (conc >= CONCURRENCY_MIN && conc <= CONCURRENCY_MAX) this.prefs.concurrency = conc
        const mb = parseInt(d?.upload_chunk_size_mb || '', 10)
        if ((CHUNK_MB_OPTIONS as readonly number[]).includes(mb)) this.prefs.chunkMB = mb
      } catch { /* 保持默认 */ }
      this.prefsLoaded = true
      this.pump() // 用户设置的并发可能高于默认值，设置到位后再补开槽位
    },
    async savePrefs(next: UploadPrefs) {
      this.prefs = { ...next }
      this.prefsLoaded = true
      await settingsApi.set('upload_concurrency', String(next.concurrency))
      await settingsApi.set('upload_chunk_size_mb', String(next.chunkMB))
    },
    async addFiles(policyId: number, parent: string, files: FileList | File[], shareId?: number) {
      const arr = Array.from(files)
      this.ensureSpeedTimer()
      // 先取回用户设置再开泵：否则首批发起时并发还是默认值 3，
      // 用户设了 2 也会先跑 3 路（竞态）
      await this.loadPrefs()
      for (const f of arr) {
        // 文件夹上传/拖拽：按相对路径还原目录结构，落到对应子目录
        // （拖拽目录遍历写入 __cpRel；webkitdirectory/已展开拖拽用 webkitRelativePath）
        // 后端上传完成时自动创建父目录
        let p = parent
        let name = f.name
        const rel = (f as FileWithRel).__cpRel || f.webkitRelativePath || undefined
        if (rel) {
          const parts = rel.split('/')
          name = parts[parts.length - 1]
          if (parts.length > 1) p = joinVP(parent, parts.slice(0, -1).join('/'))
        }
        const t: TransferTask = {
          id: Math.random().toString(36).slice(2), name, policyId, parent: p,
          size: f.size, uploaded: 0, progress: 0, status: 'queued', speed: 0, received: [], file: f, shareId
        }
        this.tasks.push(t)
        this.pump()
      }
    },
    // 并发泵（百度网盘式流水线）：至多 concurrency 个文件同时在跑，每个槽位
    // 端到端占满"校验→上传→等待合并"整条链路；其余文件保持 queued 排队，
    // 不提前计算哈希——避免一次选 17 个文件时浏览器同时跑 17 路 SHA-256。
    pump() {
      while (this.running < this.prefs.concurrency) {
        const next = this.tasks.find(t => (t.status === 'queued' || t.status === 'hashing') && !t.pausedFlag && !t.claimed)
        if (!next) break
        next.claimed = true
        if (next.status === 'queued') next.status = 'hashing'
        this.running++
        // 先补泵再查收尾：若泵起了新任务则队列未清空，allSettled 不会误报
        this.run(next).finally(() => { this.running--; this.pump(); this.allSettled() })
      }
    },
    pause(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      if (t.status === 'queued' || t.status === 'hashing' || t.status === 'uploading' || t.status === 'merging') {
        t.pausedFlag = true
        t.speed = 0
        if (t.status !== 'merging') t.status = 'paused'
        // merging 保持原状态：waitMerge 循环检测到 pausedFlag 后挂起，恢复时重入
      }
    },
    resume(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t || !t.pausedFlag) return
      t.pausedFlag = false
      t.speed = 0
      t.speedMark = undefined
      if (t.status === 'paused') {
        if (t.sessionId) { t.status = 'uploading'; this.cont(t) }
        else if (!t.claimed) { t.status = 'queued'; this.pump() }
        // claimed（校验进行中）：run 链路仍在跑，pausedFlag 清除后自动继续
      } else if (t.status === 'merging' && t.sessionId) {
        this.waitMerge(t) // 暂停期间 waitMerge 已退出，重新轮询合并状态
      }
    },
    /** 失败任务重试：复用已算好的 hash 与会话断点（init 会命中同文件活跃会话续传） */
    retry(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t || t.status !== 'error') return
      t.errMsg = undefined
      t.pausedFlag = false
      t.claimed = false
      t.speed = 0
      t.speedMark = undefined
      t.status = t.hash ? 'hashing' : 'queued'
      this.ensureSpeedTimer()
      this.pump()
    },
    cancel(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      if (t.sessionId) uploadEndpoints(t).abort(t.sessionId).catch(() => {})
      if (t.sessionId) { clearInterval(this.progressTimers.get(t.sessionId)!); this.progressTimers.delete(t.sessionId) }
      t.pausedFlag = true
      this.tasks = this.tasks.filter(x => x.id !== id)
    },
    // 任务中心「清除已完成」：移除成功项（done/instant），保留失败项供排查
    clearFinished() {
      this.tasks = this.tasks.filter(t => t.status !== 'done' && t.status !== 'instant')
    },
    async hashFile(t: TransferTask) {
      if (t.hash) return // 重试路径：复用首遍哈希，避免 6GB 文件重算
      // B14：刷新后重选同一文件 → 指纹命中缓存，跳过整文件重算直接续传/秒传
      const hit = loadHashCache()[hashFingerprint(t, t.file)]
      if (hit) { t.hash = hit; return }
      if (t.size === 0) {
        // 0 字节不读文件本体：部分浏览器内核里来自文件夹拖拽的 File 占位项
        // （空文件夹退化成的 0 字节项）不可读，arrayBuffer() 会直接抛错
        t.hash = EMPTY_SHA256
        saveHashCache(t)
        return
      }
      // B14：优先走 Worker（小文件整块 subtle / 大文件增量纯 JS，全离主线程；
      // ≤16MB 时整块 buffer transfer 回来，分片循环直接复用）
      if (!hashWorkerBroken) {
        try {
          const r = await hashInWorker(t.file!, t.size)
          t.hash = r.hash
          if (r.buf && t.size <= SMALL_FILE) t.buffer = r.buf
          saveHashCache(t)
          return
        } catch (e: unknown) {
          // Worker 不可用才降级；文件读取出错在下面的主线程路径会抛同样的错，
          // 错误信息以主线程路径为准（更贴近任务展示）
          if (String(errMsg(e)).includes('Worker')) {
            hashWorkerBroken = true
            console.warn('[CloudPan 哈希 Worker 不可用，降级主线程]', errMsg(e))
          }
        }
      }
      if (t.size <= SMALL_FILE) {
        let buf: ArrayBuffer
        try {
          buf = await t.file!.arrayBuffer()
        } catch (e: unknown) {
          throw new Error(`无法读取文件内容（${t.name}）：${errMsg(e)}`)
        }
        t.buffer = buf
        // 注意：crypto.subtle 仅在安全上下文（HTTPS/localhost）存在，
        // 内网通过 http://IP 访问时需回退到纯 JS 实现（sha256 内部已处理）
        t.hash = await sha256(buf)
        saveHashCache(t)
        return
      }
      // 大文件：逐块读取 + 增量哈希。峰值内存 = 一个读取块（4MB）。
      // 旧实现把整个文件读进 ArrayBuffer 且全程持有（http 下哈希还会整份拷贝），
      // 并发传几个 GB 级文件时浏览器进程被内核 OOM-killer 直接杀掉
      const h = new Sha256()
      for (let off = 0; off < t.size; off += READ_CHUNK) {
        const end = Math.min(off + READ_CHUNK, t.size)
        const buf = await t.file!.slice(off, end).arrayBuffer()
        h.update(new Uint8Array(buf))
      }
      t.hash = h.digest()
      saveHashCache(t)
    },
    async pollProgress(t: TransferTask) {
      if (!t.sessionId) return
      if (t.status !== 'uploading') return
      try {
        // api() 已解包为 data 本体，这里拿到的直接是 {status,progress,...}
        // 进度以服务端为准（断点恢复后服务端可能领先本地计数）；速度只由本地分片循环
        // speedTick 提供真实字节数，避免与轮询重复计数造成抖动
        const d = await uploadEndpoints(t).status(t.sessionId)
        if (d && d.status === 'uploading') {
          if (d.uploaded != null) t.uploaded = Math.max(t.uploaded, d.uploaded)
          if (d.progress != null) t.progress = Math.max(t.progress, d.progress)
        }
      } catch { /* ignore */ }
    },
    // 速度采样：1s 窗口内的字节增量累计，满 1s 折算瞬时速度与旧值 EMA（0.5/0.5）
    speedTick(t: TransferTask, delta: number) {
      const now = Date.now()
      const m = t.speedMark
      if (!m || now - m.at >= 1000) {
        const dt = m ? now - m.at : 1000
        const bytes = m ? m.bytes + delta : delta
        const inst = (bytes / dt) * 1000
        t.speed = Math.round(t.speed ? t.speed * 0.5 + inst * 0.5 : inst)
        t.speedMark = { at: now, bytes: 0 }
      } else {
        m.bytes += delta
      }
    },
    ensureSpeedTimer() {
      if (this.speedTimer) return
      // 全局 1s 衰减器：某任务 1.5s 内没有任何分片字节入账（网络停顿/重试等待），
      // 最近 1s 窗口的实际速度就是 0——直接归零。半衰渐降会无限趋近 0 但不等于 0，
      // 面板头部 ↑速度 因此永远停不掉（全部传完后仍显示 ↑x B/s）
      this.speedTimer = window.setInterval(() => {
        const now = Date.now()
        for (const t of this.tasks) {
          if (t.status === 'uploading' && t.speed && t.speedMark && now - t.speedMark.at >= 1500) {
            t.speed = 0
          }
        }
        // 没有任何在途任务（校验/上传/合并）时停表：原先定时器永不清理，
        // 任务全部结束后仍每秒空转（CPU/电量浪费），重传/重试时会重新 ensure
        if (this.activeCount === 0) this.stopSpeedTimer()
      }, 1000)
    },
    stopSpeedTimer() {
      if (this.speedTimer) { clearInterval(this.speedTimer); this.speedTimer = 0 }
    },
    startPolling(t: TransferTask) {
      if (!t.sessionId || t.status !== 'uploading') return
      if (this.progressTimers.has(t.sessionId)) return
      const timer = window.setInterval(() => this.pollProgress(t), 1000)
      this.progressTimers.set(t.sessionId, timer)
    },
    stopPolling(t: TransferTask) {
      if (t.sessionId) {
        const timer = this.progressTimers.get(t.sessionId)
        if (timer) { clearInterval(timer); this.progressTimers.delete(t.sessionId) }
      }
    },
    async run(t: TransferTask) {
      try {
        await this.upload(t)
      } catch (e: unknown) {
        t.status = 'error'
        t.errMsg = errMsg(e) || '上传失败'
        // 失败即停：清零速度，否则该任务残留的 speed 会被 totalSpeed 累加，
        // 全部传完后面板头部仍显示 ↑速度（"这不是实时的吗"）
        t.speed = 0
        t.speedMark = undefined
        this.stopPolling(t)
        // 控制台留全量诊断（黄色 warn）：目标路径 + 原始错误，便于定位 Windows 文件系统类问题
        console.warn('[CloudPan 上传失败]', {
          parent: t.parent, name: t.name, policyId: t.policyId,
          size: t.size, hash: t.hash, error: errMsg(e)
        })
        const toast = useToast()
        toast.error('上传失败: ' + (errMsg(e) || '未知错误'))
      }
    },
    // 队列清空检查（pump 的 finally 里调用）：不再有任何排队/校验/上传/合并/暂停中的任务时，
    // 发一次"全部完成"通知，带成功/失败计数（批量上传收尾提示）
    allSettled() {
      if (this.tasks.some(t => t.status === 'queued' || t.status === 'hashing' || t.status === 'uploading' || t.status === 'merging' || t.status === 'paused')) return
      if (!this.tasks.length) return
      const ok = this.tasks.filter(t => t.status === 'done' || t.status === 'instant').length
      const fail = this.tasks.filter(t => t.status === 'error').length
      if (!ok && !fail) return
      const toast = useToast()
      if (!fail) toast.success(`全部上传完成：${ok} 个文件成功`)
      else toast.error(`上传结束：${ok} 个成功，${fail} 个失败（失败项可点重试）`)
    },
    async upload(t: TransferTask) {
      await this.hashFile(t)
      const ep = uploadEndpoints(t)
      const init = await ep.init({
        policyId: t.policyId, parent: t.parent, name: t.name,
        size: t.size, chunkSize: this.prefs.chunkMB << 20, hash: t.hash || ''
      })
      if (init.instant) {
        t.status = 'instant'
        t.uploaded = t.size
        t.progress = 100
        this.refreshExplorer(t)
        // 秒传副本同样没有媒体边车（键含 mtime），同样回填
        scheduleMediaSidecar({ policyId: t.policyId, parent: t.parent, name: t.name, size: t.size, file: t.file })
        return
      }
      t.sessionId = init.sessionId
      t.chunkSize = init.chunkSize || (this.prefs.chunkMB << 20)
      t.totalChunks = init.totalChunks || 1
      t.received = init.received || []
      t.uploaded = t.received.length * t.chunkSize!
      t.progress = Math.round((t.received.length / Math.max(t.totalChunks, 1)) * 100)
      t.status = 'uploading'
      if (t.pausedFlag) { t.status = 'paused'; return }
      this.startPolling(t)
      await this.cont(t)
    },
    async cont(t: TransferTask) {
      const cs = t.chunkSize!
      while (t.status === 'uploading') {
        if (t.pausedFlag) return
        const pending: number[] = []
        for (let i = 0; i < t.totalChunks!; i++) if (!t.received.includes(i)) pending.push(i)
        if (!pending.length) break
        for (const i of pending) {
          if (t.status !== 'uploading' || t.pausedFlag) return
          const start = i * cs
          const end = Math.min(start + cs, t.size)
          // 逐片读取（小文件已有整块 buffer 时直接切片，不重复读盘）；发完即释放，
          // 不再像旧实现那样整文件 ArrayBuffer 驻留到上传结束
          const chunk = t.buffer ? t.buffer.slice(start, end) : await t.file!.slice(start, end).arrayBuffer()
          await this.putChunk(t, i, chunk)
          this.speedTick(t, chunk.byteLength)
          t.received.push(i)
          t.uploaded = Math.min(t.size, t.received.length * cs)
          t.progress = Math.round((t.received.length / Math.max(t.totalChunks!, 1)) * 100)
        }
      }
      if (t.status !== 'uploading') return
      // 服务端异步合并：complete 立即返回（大文件合并+哈希需数分钟），
      // 轮询状态直到 completed/失败；关页面/断网不影响服务端合并
      await uploadEndpoints(t).complete(t.sessionId!)
      await this.waitMerge(t)
    },
    // 单分片重试（远端 DB 抖动/瞬时断流），全部失败才把错误抛给任务层
    async putChunk(t: TransferTask, idx: number, chunk: ArrayBuffer) {
      let lastErr: unknown
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await uploadEndpoints(t).chunk(t.sessionId!, idx, chunk)
          return
        } catch (e) {
          lastErr = e
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt === 1 ? 1000 : 3000))
        }
      }
      throw lastErr
    },
    // 等待服务端合并结束（complete 之后）。状态机：merging → completed / (失败回 uploading + error)
    async waitMerge(t: TransferTask) {
      this.stopPolling(t)
      t.status = 'merging'
      t.progress = 100
      t.speed = 0
      t.speedMark = undefined
      for (let i = 0; i < 1800; i++) { // 最长 ~60min，大文件在慢盘上合并+哈希可能很久
        if (t.pausedFlag) return
        await new Promise(r => setTimeout(r, 2000))
        if (t.pausedFlag) return
        let d: UploadStatus | undefined
        try { d = await uploadEndpoints(t).status(t.sessionId!) } catch { continue }
        if (!d) continue
        if (d.status === 'completed') {
          t.status = 'done'
          t.uploaded = t.size
          t.progress = 100
          this.refreshExplorer(t)
          // B7：上传完成后台异步生成媒体预览边车（视频 sprite / 音频波形），
          // 失败静默，不影响上传结果
          scheduleMediaSidecar({ policyId: t.policyId, parent: t.parent, name: t.name, size: t.size, file: t.file })
          return
        }
        if (d.status === 'aborted') {
          t.status = 'error'
          t.errMsg = '已取消'
          return
        }
        if (d.status === 'uploading' && d.error) {
          // 合并失败，服务端已回滚为可续传状态：展示失败原因，用户可点重试
          t.status = 'error'
          t.errMsg = d.error
          return
        }
        // d.status === 'merging'：继续等
      }
      t.status = 'error'
      t.errMsg = '合并超时，请在任务中心查看'
    },
    refreshExplorer(t: TransferTask) {
      // 共享盘上传：通知「来自他人的共享」视图刷新（文件不在自己的盘里，
      // 派发 explorer 事件会让自己的文件浏览器刷一个不相干的目录）
      if (t.shareId) {
        window.dispatchEvent(new CustomEvent('cp-refresh-shared', { detail: { shareId: t.shareId } }))
        return
      }
      window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId: t.policyId, path: t.parent } }))
    }
  }
})

export function openFileByType(app: string, props: Record<string, unknown> | null, title: string, w = 900, h = 600) {
  useWindows().open(app, props, { title, w, h })
}
