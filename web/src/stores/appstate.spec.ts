import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(async () => ({})),
  set: vi.fn(async () => ({}))
}))

vi.mock('../api/modules', () => ({
  appsApi: { list: (...a: any[]) => h.list(...a) },
  settingsApi: { get: () => h.get(), set: () => h.set() }
}))
vi.mock('./session', () => ({ useSession: () => ({ user: { id: 1, role: 'user' } }) }))

import { useAppState } from './appstate'

// /apps 拉取失败的语义：401 = 身份失效（未决，调用方踢登录）；
// 其他失败 = loadFailed（入口仍放行，但外壳提示可重试）
describe('appstate 功能权限加载语义', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.list.mockReset()
  })

  it('成功：loaded=true 且 loadFailed=false，权限按响应生效', async () => {
    h.list.mockResolvedValueOnce([
      { key: 'explorer', enabled: true, allowed: true },
      { key: 'terminal', enabled: false, allowed: true }
    ])
    const s = useAppState()
    await expect(s.load()).resolves.toBe(true)
    expect(s.loaded).toBe(true)
    expect(s.loadFailed).toBe(false)
    expect(s.isOn('explorer')).toBe(true)
    expect(s.isOn('terminal')).toBe(false)
    expect(s.isAllowed('terminal')).toBe(true)
  })

  it('网络失败：loaded=true + loadFailed=true（入口保持可见，不空白桌面）', async () => {
    h.list.mockRejectedValueOnce(new Error('Network Error'))
    const s = useAppState()
    await expect(s.load()).resolves.toBe(true)
    expect(s.loaded).toBe(true)
    expect(s.loadFailed).toBe(true)
    // 离线兜底：默认放行（后端 AppGate 仍逐请求鉴权）
    expect(s.isOn('explorer')).toBe(true)
    expect(s.isAvailable('terminal')).toBe(true)
  })

  it('401：返回 false 且保持未决（不标记 loadFailed）', async () => {
    h.list.mockRejectedValueOnce({ response: { status: 401 } })
    const s = useAppState()
    await expect(s.load()).resolves.toBe(false)
    expect(s.loaded).toBe(false)
    expect(s.loadFailed).toBe(false)
    expect(s.isOn('explorer')).toBe(false)
  })

  it('重试成功后 loadFailed 归位', async () => {
    h.list.mockRejectedValueOnce(new Error('boom'))
    const s = useAppState()
    await s.load()
    expect(s.loadFailed).toBe(true)

    h.list.mockResolvedValueOnce([{ key: 'explorer', enabled: true, allowed: false }])
    await s.load()
    expect(s.loadFailed).toBe(false)
    expect(s.loaded).toBe(true)
    expect(s.isAllowed('explorer')).toBe(false)
  })
})