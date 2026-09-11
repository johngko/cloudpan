import axios from 'axios'

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

http.interceptors.request.use(cfg => {
  const t = getToken()
  if (t) cfg.headers.Authorization = 'Bearer ' + t
  return cfg
})

// 401 静默续期（TabOS 同款）：访问令牌过期（7 天）时用刷新令牌（30 天）
// 换新令牌对并重试原请求一次，用户无感知。并发 401 共享同一次刷新（single-flight），
// 避免刷新风暴与「旧令牌对覆盖新令牌对」竞态。
let refreshPromise: Promise<string | null> | null = null
function doRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', { refreshToken: getRefreshToken() }, { timeout: 15000 })
      .then(res => {
        const d: any = res.data
        if (d?.code === 0 && d.data?.token) {
          setToken(d.data.token, d.data.refreshToken)
          return d.data.token as string
        }
        return null
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

http.interceptors.response.use(
  resp => resp.data,
  async err => {
    const cfg: any = err.config
    if (err.response && err.response.status === 401 && cfg && !cfg._retried) {
      cfg._retried = true
      if (getRefreshToken() && location.hash !== '#/login') {
        const t = await doRefresh()
        if (t) {
          cfg.headers = { ...cfg.headers, Authorization: 'Bearer ' + t }
          return http.request(cfg)
        }
      }
    }
    if (err.response && err.response.status === 401) {
      clearToken()
      if (location.hash !== '#/login') location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)

// 统一返回 {code, msg, data}
export async function api<T = any>(method: string, url: string, data?: any, cfg?: any): Promise<T> {
  const res: any = await http.request({ method, url, data, ...cfg })
  if (res.code !== 0) throw new Error(res.msg || '请求失败')
  return res.data as T
}

export const get = <T = any>(url: string, cfg?: any) => api<T>('GET', url, undefined, cfg)
export const post = <T = any>(url: string, data?: any, cfg?: any) => api<T>('POST', url, data, cfg)
export const put = <T = any>(url: string, data?: any, cfg?: any) => api<T>('PUT', url, data, cfg)
export const del = <T = any>(url: string, data?: any, cfg?: any) => api<T>('DELETE', url, data, cfg)
