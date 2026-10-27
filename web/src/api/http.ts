import axios, { type AxiosRequestConfig } from 'axios'
import { useToast } from '../stores/dialog'

export const http = axios.create({ baseURL: '/api', timeout: 60000 })

const TOKEN_KEY = 'cp_token'
const REFRESH_KEY = 'cp_refresh'
// 会话令牌存 sessionStorage：按标签页隔离。localStorage 同源共享，
// 多用户共用浏览器时在任一标签页登录（如游客登录）会顶掉其他标签页的会话。
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}
export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY)
}
export function setToken(t: string, rt?: string) {
  sessionStorage.setItem(TOKEN_KEY, t)
  if (rt !== undefined) sessionStorage.setItem(REFRESH_KEY, rt)
}
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}

/** 后端统一响应信封（Go 侧 dto.R）：code === 0 为成功，失败时无 data */
export interface Envelope<T> {
  code: number
  msg?: string
  data?: T
}

/** 401 续期会给请求配置打上自定义标记，axios 的类型里没有这一项 */
interface RetryConfig extends AxiosRequestConfig {
  _retried?: boolean
}

http.interceptors.request.use(cfg => {
  const t = getToken()
  if (t) cfg.headers.Authorization = 'Bearer ' + t
  return cfg
})

// 401 静默续期（TabOS 同款）：访问令牌过期（7 天）时用刷新令牌（30 天）
// 换新令牌对并重试原请求一次，用户无感知。并发 401 共享同一次刷新（single-flight），
// 避免刷新风暴与「旧令牌对覆盖新令牌对」竞态。
let refreshPromise: Promise<string | null> | null = null
// 返回 string = 新令牌；null = 服务端明确否定（refresh 失效，应登出）；
// 抛出 = 暂时性故障（网络瞬断/5xx，令牌未必失效，不能据此登出）
function doRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', { refreshToken: getRefreshToken() }, { timeout: 15000 })
      .then(res => {
        const d = res.data as Envelope<{ token?: string; refreshToken?: string }> | undefined
        if (d?.code === 0 && d.data?.token) {
          setToken(d.data.token, d.data.refreshToken)
          return d.data.token
        }
        return null // 服务端 200 但业务码非 0：refresh 明确失效
      })
      .catch((err: unknown) => {
        const st = axios.isAxiosError(err) ? err.response?.status : undefined
        // 只有服务端明确否定（401/403）才判定失效；网络不可达、超时、5xx 均视为暂时性故障
        if (st === 401 || st === 403) return null
        throw err
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

http.interceptors.response.use(
  // 解包：成功分支直接返回后端信封（调用方拿到的不是 AxiosResponse，见 requestEnvelope 说明）
  resp => resp.data,
  async (err: unknown) => {
    const ax = axios.isAxiosError(err) ? err : null
    const cfg = ax?.config as RetryConfig | undefined
    if (ax?.response?.status === 401 && cfg && !cfg._retried) {
      cfg._retried = true
      if (getRefreshToken() && location.hash !== '#/login') {
        let t: string | null = null
        let transient = false
        try {
          t = await doRefresh()
        } catch {
          transient = true // 网络瞬断：保留凭证，避免弱网下把用户误登出
        }
        if (t) {
          cfg.headers = { ...cfg.headers, Authorization: 'Bearer ' + t } as RetryConfig['headers']
          return http.request(cfg)
        }
        if (transient) return Promise.reject(err)
      }
    }
    if (ax?.response?.status === 401) {
      clearToken()
      if (location.hash !== '#/login') location.hash = '#/login'
    }
    // A3 强制两步验证：428 用后端信封文案提示（默认 axios message 只有状态码），并弹一次 toast
    if (ax?.response?.status === 428) {
      const msg = (ax.response.data as { msg?: string } | undefined)?.msg || '本站已强制两步验证，请先绑定'
      ax.message = msg
      try {
        useToast().error(msg)
      } catch {
        // pinia 未就绪（极早期请求）：文案已并入 message，调用方仍可见
      }
    }
    return Promise.reject(err)
  }
)

/** 发出请求并取回后端信封。拦截器已把 AxiosResponse 解包成 resp.data，
 *  axios 的类型签名表达不了这种解包，故只在此集中断言一次，其它地方都是正常类型。 */
async function requestEnvelope<T>(cfg: AxiosRequestConfig): Promise<Envelope<T>> {
  return (await http.request(cfg)) as unknown as Envelope<T>
}

// 统一返回 {code, msg, data}；业务码非 0 抛错
export async function api<T = unknown>(method: string, url: string, data?: unknown, cfg?: AxiosRequestConfig): Promise<T> {
  const res = await requestEnvelope<T>({ method, url, data, ...cfg })
  if (res.code !== 0) throw new Error(res.msg || '请求失败')
  return res.data as T
}

export const get = <T = unknown>(url: string, cfg?: AxiosRequestConfig) => api<T>('GET', url, undefined, cfg)
export const post = <T = unknown>(url: string, data?: unknown, cfg?: AxiosRequestConfig) => api<T>('POST', url, data, cfg)
export const put = <T = unknown>(url: string, data?: unknown, cfg?: AxiosRequestConfig) => api<T>('PUT', url, data, cfg)
export const del = <T = unknown>(url: string, data?: unknown, cfg?: AxiosRequestConfig) => api<T>('DELETE', url, data, cfg)
