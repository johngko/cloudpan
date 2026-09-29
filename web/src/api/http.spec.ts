import { describe, it, expect, vi, beforeEach } from 'vitest'

// axios 替身：捕获 http.ts 注册的 401 响应拦截器，直接驱动它做行为断言
const h = vi.hoisted(() => ({
  request: vi.fn(),
  post: vi.fn(),
  errHandler: undefined as unknown as (err: any) => Promise<any>
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: () => {} },
        response: {
          use: (_ok: unknown, err: (e: any) => Promise<any>) => {
            h.errHandler = err
          }
        }
      },
      request: (...a: any[]) => h.request(...a)
    }),
    post: (...a: any[]) => h.post(...a),
    // 与真实 axios 一致：错误对象自带 isAxiosError 标记
    isAxiosError: (p: any) => !!p?.isAxiosError
  }
}))

import { api, getToken, getRefreshToken, setToken, clearToken } from './http'

const okRefresh = () => ({ data: { code: 0, data: { token: 'new-token', refreshToken: 'new-refresh' } } })
const badRefresh = () => ({ data: { code: 401, msg: 'refresh 失效' } })

// 错误替身统一带 isAxiosError（真实 axios 的 AxiosError 就有这个标记）
function err401(cfg: any = { headers: {} }) {
  return { isAxiosError: true, response: { status: 401 }, config: cfg }
}

describe('http 拦截器：401 静默续期与凭证语义', () => {
  beforeEach(() => {
    h.request.mockReset()
    h.post.mockReset()
    clearToken()
    ;(globalThis as any).location.hash = ''
  })

  it('并发 401 共享同一次刷新（single-flight）', async () => {
    setToken('old', 'r1')
    h.post.mockResolvedValue(okRefresh())
    h.request.mockResolvedValue({ code: 0, data: 'ok' })

    const c1 = { headers: {} }
    const c2 = { headers: {} }
    await Promise.all([h.errHandler(err401(c1)), h.errHandler(err401(c2))])

    expect(h.post).toHaveBeenCalledTimes(1)
    expect(h.request).toHaveBeenCalledTimes(2)
    // 重试请求携带新令牌
    expect(h.request.mock.calls[0][0].headers.Authorization).toBe('Bearer new-token')
    expect(getToken()).toBe('new-token')
    expect(getRefreshToken()).toBe('new-refresh')
  })

  it('刷新成功但 refresh 缺失时不刷新，直接登出', async () => {
    setToken('old') // 无刷新令牌
    h.request.mockResolvedValue({ code: 0, data: 'ok' })
    await expect(h.errHandler(err401())).rejects.toBeTruthy()
    expect(h.post).not.toHaveBeenCalled()
    expect(getToken()).toBeNull()
    expect((globalThis as any).location.hash).toBe('#/login')
  })

  it('refresh 明确失效（code!=0）时清凭证并跳登录', async () => {
    setToken('old', 'r1')
    h.post.mockResolvedValue(badRefresh())
    await expect(h.errHandler(err401())).rejects.toBeTruthy()
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect((globalThis as any).location.hash).toBe('#/login')
  })

  it('网络错误（无 response）不清除凭证、不跳登录', async () => {
    setToken('old', 'r1')
    const netErr = { config: { headers: {} }, message: 'Network Error' }
    await expect(h.errHandler(netErr)).rejects.toBeTruthy()
    expect(getToken()).toBe('old')
    expect(getRefreshToken()).toBe('r1')
    expect((globalThis as any).location.hash).toBe('')
  })

  it('refresh 遭遇网络故障时保留凭证（弱网不误登出）', async () => {
    setToken('old', 'r1')
    h.post.mockRejectedValue({ message: 'Network Error' }) // 无 response
    await expect(h.errHandler(err401())).rejects.toBeTruthy()
    expect(getToken()).toBe('old')
    expect(getRefreshToken()).toBe('r1')
    expect((globalThis as any).location.hash).toBe('')
  })

  it('refresh 返回 5xx 时视为暂时性故障，保留凭证', async () => {
    setToken('old', 'r1')
    h.post.mockRejectedValue({ isAxiosError: true, response: { status: 500 } })
    await expect(h.errHandler(err401())).rejects.toBeTruthy()
    expect(getToken()).toBe('old')
    expect((globalThis as any).location.hash).toBe('')
  })

  it('refresh 明确被服务端否定（401）时清凭证并跳登录', async () => {
    setToken('old', 'r1')
    h.post.mockRejectedValue({ isAxiosError: true, response: { status: 401 } })
    await expect(h.errHandler(err401())).rejects.toBeTruthy()
    expect(getToken()).toBeNull()
    expect((globalThis as any).location.hash).toBe('#/login')
  })

  it('非 401 错误原样抛出', async () => {
    const e = { isAxiosError: true, response: { status: 500 }, config: { headers: {} } }
    await expect(h.errHandler(e)).rejects.toBe(e)
  })

  it('api() 在 code!==0 时抛错，code===0 时解包 data', async () => {
    h.request.mockResolvedValueOnce({ code: 1, msg: '参数错误' })
    await expect(api('GET', '/x')).rejects.toThrow('参数错误')

    h.request.mockResolvedValueOnce({ code: 0, data: { a: 1 } })
    await expect(api('GET', '/x')).resolves.toEqual({ a: 1 })
  })
})