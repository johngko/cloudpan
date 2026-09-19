import { defineStore } from 'pinia'
import { uploadApi, settingsApi } from '../api/modules'
import { sha256, Sha256, EMPTY_SHA256 } from '../utils/sha256'
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
    async addFiles(policyId: number, parent: string, files: FileList | File[]) {
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
        const rel = ((f as any).__cpRel || (f as any).webkitRelativePath) as string | undefined
        if (rel) {
          const parts = rel.split('/')
          name = parts[parts.length - 1]
          if (parts.length > 1) p = joinVP(parent, parts.slice(0, -1).join('/'))
        }
        const t: TransferTask = {
          id: Math.random().toString(36).slice(2), name, policyId, parent: p,
          size: f.size, uploaded: 0, progress: 0, status: 'queued', speed: 0, received: [], file: f
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
      if (t.sessionId) uploadApi.abort(t.sessionId).catch(() => {})
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
      if (t.size === 0) {
        // 0 字节不读文件本体：部分浏览器内核里来自文件夹拖拽的 File 占位项
        // （空文件夹退化成的 0 字节项）不可读，arrayBuffer() 会直接抛错
        t.hash = EMPTY_SHA256
        return
      }
      if (t.size <= SMALL_FILE) {
        let buf: ArrayBuffer
        try {
          buf = await t.file!.arrayBuffer()
        } catch (e: any) {
          throw new Error(`无法读取文件内容（${t.name}）：${e?.message || String(e)}`)
        }
        t.buffer = buf
        // 注意：crypto.subtle 仅在安全上下文（HTTPS/localhost）存在，
        // 内网通过 http://IP 访问时需回退到纯 JS 实现（sha256 内部已处理）
        t.hash = await sha256(buf)
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
    },
    async pollProgress(t: TransferTask) {
      if (!t.sessionId) return
      if (t.status !== 'uploading') return
      try {
        // api() 已解包为 data 本体，这里拿到的直接是 {status,progress,...}
        // 进度以服务端为准（断点恢复后服务端可能领先本地计数）；速度只由本地分片循环
        // speedTick 提供真实字节数，避免与轮询重复计数造成抖动
        const d = await uploadApi.status(t.sessionId)
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
      }, 1000)
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
      } catch (e: any) {
        t.status = 'error'
        t.errMsg = e.message || '上传失败'
        // 失败即停：清零速度，否则该任务残留的 speed 会被 totalSpeed 累加，
        // 全部传完后面板头部仍显示 ↑速度（"这不是实时的吗"）
        t.speed = 0
        t.speedMark = undefined
        this.stopPolling(t)
        // 控制台留全量诊断（黄色 warn）：目标路径 + 原始错误，便于定位 Windows 文件系统类问题
        console.warn('[CloudPan 上传失败]', {
          parent: t.parent, name: t.name, policyId: t.policyId,
          size: t.size, hash: t.hash, error: e?.message ?? String(e)
        })
        const toast = useToast()
        toast.error('上传失败: ' + (e.message || '未知错误'))
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
      const init = await uploadApi.init({
        policyId: t.policyId, parent: t.parent, name: t.name,
        size: t.size, chunkSize: this.prefs.chunkMB << 20, hash: t.hash || ''
      })
      if (init.instant) {
        t.status = 'instant'
        t.uploaded = t.size
        t.progress = 100
        this.refreshExplorer(t)
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
          t.progress = Math.round((t.received.length / Math.max(t.totalChunks, 1)) * 100)
        }
      }
      if (t.status !== 'uploading') return
      // 服务端异步合并：complete 立即返回（大文件合并+哈希需数分钟），
      // 轮询状态直到 completed/失败；关页面/断网不影响服务端合并
      await uploadApi.complete(t.sessionId!)
      await this.waitMerge(t)
    },
    // 单分片重试（远端 DB 抖动/瞬时断流），全部失败才把错误抛给任务层
    async putChunk(t: TransferTask, idx: number, chunk: ArrayBuffer) {
      let lastErr: any
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await uploadApi.chunk(t.sessionId!, idx, chunk)
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
        let d: any
        try { d = await uploadApi.status(t.sessionId!) } catch { continue }
        if (!d) continue
        if (d.status === 'completed') {
          t.status = 'done'
          t.uploaded = t.size
          t.progress = 100
          this.refreshExplorer(t)
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
      window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId: t.policyId, path: t.parent } }))
    }
  }
})

export function openFileByType(app: string, props: any, title: string, w = 900, h = 600) {
  useWindows().open(app, props, { title, w, h })
}
