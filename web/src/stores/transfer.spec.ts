import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../api/modules', () => ({
  uploadApi: {
    init: vi.fn(),
    chunk: vi.fn(),
    complete: vi.fn(),
    abort: vi.fn(),
    status: vi.fn(),
    progress: vi.fn()
  },
  userShareApi: {
    uploadInit: vi.fn()
  },
  settingsApi: {
    get: vi.fn(async () => ({})),
    set: vi.fn(async () => ({}))
  }
}))
vi.mock('./windows', () => ({ useWindows: () => ({}) }))
vi.mock('./dialog', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

import { useTransfer, uploadEndpoints, type TransferTask } from './transfer'
import { uploadApi, userShareApi } from '../api/modules'

function task(patch: Partial<TransferTask>): TransferTask {
  return {
    id: 'a', name: 'a.bin', policyId: 1, parent: '/', size: 1,
    uploaded: 0, progress: 0, status: 'queued', speed: 0, received: [],
    ...patch
  }
}

// P1.3 / P0.1：速度衰减定时器必须在任务收敛后停表，否则全部传完后仍每秒空转
describe('transfer 速度衰减定时器生命周期', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('没有任何在途任务时，一拍之后自动停表', () => {
    const t = useTransfer()
    t.tasks = [task({ status: 'done' })]
    t.ensureSpeedTimer()
    expect(t.speedTimer).not.toBe(0)
    vi.advanceTimersByTime(1100)
    expect(t.speedTimer).toBe(0)
  })

  it('有在途任务时保持运行；任务清空后停表', () => {
    const t = useTransfer()
    t.tasks = [task({ status: 'uploading', speed: 100, speedMark: { at: Date.now(), bytes: 0 } })]
    t.ensureSpeedTimer()
    vi.advanceTimersByTime(3100)
    expect(t.speedTimer).not.toBe(0)

    t.tasks = []
    vi.advanceTimersByTime(1100)
    expect(t.speedTimer).toBe(0)
  })

  it('重复 ensure 不会叠加多个定时器', () => {
    const t = useTransfer()
    t.tasks = [task({ status: 'uploading' })]
    t.ensureSpeedTimer()
    const first = t.speedTimer
    t.ensureSpeedTimer()
    expect(t.speedTimer).toBe(first)
    t.stopSpeedTimer()
  })
})

// P4.1 共享盘大文件上传：复用同一套上传泵（分片/秒传/续传/重试），
// 只把 init 换成共享端点并把 parent 映射成 rel（共享内相对目录），其余端点共用 /upload/*
describe('uploadEndpoints 共享盘端点选择', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('普通任务：init 走 /upload/init，且不碰共享接口', async () => {
    const ep = uploadEndpoints(task({ policyId: 7, parent: '/docs' }))
    expect(ep.init).toBe(uploadApi.init)
    await ep.init({ policyId: 7, parent: '/docs', name: 'a.bin', size: 10, chunkSize: 1024, hash: 'h' })
    expect(uploadApi.init).toHaveBeenCalledWith({ policyId: 7, parent: '/docs', name: 'a.bin', size: 10, chunkSize: 1024, hash: 'h' })
    expect(userShareApi.uploadInit).not.toHaveBeenCalled()
  })

  it('共享任务：init 走 /shared/:id/upload/init，parent 映射为 rel', async () => {
    const ep = uploadEndpoints(task({ policyId: 0, parent: '/sub/dir', shareId: 42 }))
    await ep.init({ policyId: 0, parent: '/sub/dir', name: 'big.bin', size: 99, chunkSize: 2048, hash: 'hh' })
    expect(userShareApi.uploadInit).toHaveBeenCalledWith(42, { rel: '/sub/dir', name: 'big.bin', size: 99, chunkSize: 2048, hash: 'hh' })
    expect(uploadApi.init).not.toHaveBeenCalled()
  })

  it('共享任务：分片/完成/状态/取消仍复用 /upload/*（服务端按会话归属鉴权）', () => {
    const ep = uploadEndpoints(task({ shareId: 42 }))
    expect(ep.chunk).toBe(uploadApi.chunk)
    expect(ep.complete).toBe(uploadApi.complete)
    expect(ep.status).toBe(uploadApi.status)
    expect(ep.abort).toBe(uploadApi.abort)
  })

  it('共享任务完成时派发 cp-refresh-shared（而不是 explorer 事件）', () => {
    const t = useTransfer()
    // Node 环境无事件系统：临时补齐 CustomEvent/dispatchEvent 以断言派发目标
    const g = globalThis as any
    const savedCE = g.CustomEvent
    const savedDispatch = g.dispatchEvent
    class FakeEvent {
      type: string
      detail: any
      constructor(type: string, opt?: any) { this.type = type; this.detail = opt?.detail }
    }
    const seen: any[] = []
    g.CustomEvent = FakeEvent
    g.dispatchEvent = (e: any) => { seen.push([e.type, e.detail]); return true }
    try {
      t.refreshExplorer(task({ shareId: 42, policyId: 3, parent: '/x' }))
      t.refreshExplorer(task({ policyId: 3, parent: '/x' }))
    } finally {
      g.CustomEvent = savedCE
      g.dispatchEvent = savedDispatch
    }
    expect(seen).toEqual([['cp-refresh-shared', { shareId: 42 }], ['cp-refresh-explorer', { policyId: 3, path: '/x' }]])
  })
})