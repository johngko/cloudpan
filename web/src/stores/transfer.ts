import { defineStore } from 'pinia'
import { uploadApi } from '../api/modules'
import { sha256 } from '../utils/sha256'
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
  status: 'hashing' | 'uploading' | 'paused' | 'done' | 'error' | 'instant'
  errMsg?: string
  sessionId?: string
  chunkSize?: number
  totalChunks?: number
  received: number[]
  file?: File
  buffer?: ArrayBuffer
  hash?: string
  pausedFlag?: boolean
  /** pump 已认领（防止 await 间隙被重复调度导致并发重复上传） */
  claimed?: boolean
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
    progressTimers: new Map<string, number>()
  }),
  getters: {
    activeCount: s => s.tasks.filter(t => t.status === 'uploading' || t.status === 'hashing').length
  },
  actions: {
    panel(v?: boolean) {
      this.visible = v === undefined ? !this.visible : v
    },
    async addFiles(policyId: number, parent: string, files: FileList | File[]) {
      const arr = Array.from(files)
      for (const f of arr) {
        // 文件夹上传/拖拽：按 webkitRelativePath 还原目录结构，落到对应子目录
        // （后端上传完成时自动创建父目录）
        let p = parent
        let name = f.name
        const rel = (f as any).webkitRelativePath as string | undefined
        if (rel) {
          const parts = rel.split('/')
          name = parts[parts.length - 1]
          if (parts.length > 1) p = joinVP(parent, parts.slice(0, -1).join('/'))
        }
        const t: TransferTask = {
          id: Math.random().toString(36).slice(2), name, policyId, parent: p,
          size: f.size, uploaded: 0, progress: 0, status: 'hashing', received: [], file: f
        }
        this.tasks.push(t)
        this.pump()
      }
    },
    async pump() {
      while (this.running < 3) {
        const next = this.tasks.find(t => t.status === 'hashing' && !t.pausedFlag && !t.claimed)
        if (!next) break
        next.claimed = true
        this.running++
        this.run(next).finally(() => { this.running--; this.pump() })
      }
    },
    pause(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      if (t.status === 'hashing' || t.status === 'uploading') t.pausedFlag = true
      if (t.status === 'uploading') t.status = 'paused'
    },
    resume(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      t.pausedFlag = false
      if (t.status === 'paused') { t.status = 'uploading'; this.cont(t) }
      // hashing 状态下 run 仍在进行（claimed 占位），无需重新调度
    },
    cancel(id: string) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      if (t.sessionId) uploadApi.abort(t.sessionId).catch(() => {})
      if (t.sessionId) { clearInterval(this.progressTimers.get(t.sessionId)!); this.progressTimers.delete(t.sessionId) }
      t.pausedFlag = true
      this.tasks = this.tasks.filter(x => x.id !== id)
    },
    async hashFile(t: TransferTask) {
      const buf = await t.file!.arrayBuffer()
      t.buffer = buf
      // 注意：crypto.subtle 仅在安全上下文（HTTPS/localhost）存在，
      // 内网通过 http://IP 访问时需回退到纯 JS 实现（sha256 内部已处理）
      t.hash = await sha256(buf)
    },
    async pollProgress(t: TransferTask) {
      if (!t.sessionId || t.status !== 'uploading') return
      try {
        // api() 已解包为 data 本体，这里拿到的直接是 {status,progress,...}
        const d = await uploadApi.status(t.sessionId)
        if (d) {
          t.progress = d.progress ?? Math.round((d.uploaded ?? 0) / Math.max(t.size, 1) * 100)
          t.uploaded = d.uploaded ?? t.uploaded
          if (d.received !== undefined) {
            t.received = Array.from({ length: d.received }, (_, i) => i)
          }
        }
      } catch { /* ignore */ }
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
        this.stopPolling(t)
        const toast = useToast()
        toast.error('上传失败: ' + (e.message || '未知错误'))
      }
    },
    async upload(t: TransferTask) {
      await this.hashFile(t)
      const init = await uploadApi.init({
        policyId: t.policyId, parent: t.parent, name: t.name,
        size: t.size, chunkSize: 4 << 20, hash: t.hash || ''
      })
      if (init.instant) {
        t.status = 'instant'
        t.uploaded = t.size
        t.progress = 100
        this.refreshExplorer(t)
        return
      }
      t.sessionId = init.sessionId
      t.chunkSize = init.chunkSize || (4 << 20)
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
      const buf = t.buffer || await t.file!.arrayBuffer()
      t.buffer = buf
      while (t.status === 'uploading') {
        if (t.pausedFlag) return
        const pending: number[] = []
        for (let i = 0; i < t.totalChunks!; i++) if (!t.received.includes(i)) pending.push(i)
        if (!pending.length) break
        for (const i of pending) {
          if (t.status !== 'uploading') return
          const start = i * t.chunkSize!
          const end = Math.min(start + t.chunkSize!, t.size)
          const slice = buf.slice(start, end)
          await uploadApi.chunk(t.sessionId!, i, slice)
          t.received.push(i)
          t.uploaded = Math.min(t.size, t.received.length * t.chunkSize!)
          t.progress = Math.round((t.received.length / Math.max(t.totalChunks, 1)) * 100)
        }
      }
      if (t.status !== 'uploading') return
      await uploadApi.complete(t.sessionId!)
      t.status = 'done'
      t.uploaded = t.size
      t.progress = 100
      this.stopPolling(t)
      this.refreshExplorer(t)
    },
    refreshExplorer(t: TransferTask) {
      window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId: t.policyId, path: t.parent } }))
    }
  }
})

export function openFileByType(app: string, props: any, title: string, w = 900, h = 600) {
  useWindows().open(app, props, { title, w, h })
}
