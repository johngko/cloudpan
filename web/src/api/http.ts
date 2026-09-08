import axios from 'axios'

export const http = axios.create({ baseURL: '/api', timeout: 60000 })

const TOKEN_KEY = 'cp_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

http.interceptors.request.use(cfg => {
  const t = getToken()
  if (t) cfg.headers.Authorization = 'Bearer ' + t
  return cfg
})

http.interceptors.response.use(
  resp => resp.data,
  err => {
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
