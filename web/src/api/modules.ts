import { api, get, post, put, del, getToken } from './http'
export interface User {
  id: number; username: string; nickname: string; avatar: number
  role: string; groupId: number; usedBytes: number
  appPerms?: Record<string, boolean> // 个人应用权限覆盖（键缺失=跟随用户组）
}
export interface UserGroup {
  id: number; name: string; quotaMB: number; allowShare: boolean; allowWebdav: boolean
  allowArchive: boolean; allowOffline: boolean; shareAllowDownload: boolean
  readOnly: boolean // 只读用户组：成员仅可查看/下载
  downloadSpeedKB: number; recycleRetentionDays: number
  keepVersions: number; versionRetentionDays: number
  allowedPolicyIds: string; isDefault: boolean; remark: string
  appPerms: Record<string, boolean> // 组级应用权限（键缺失=允许）
}
export interface Policy {
  id: number; name: string; letter: string; type: string; rootPath: string
  status: string; usageBytes: number
}
export interface FileItem {
  name: string; isDir: boolean; size: number; modTime: number; ext: string
  path: string; starred?: boolean
}

export const authApi = {
  // isGuest：是否游客共享账号（系统托管身份，前端据此隐藏账号自管理入口；后端另有 GuestReadOnly 兜底）
  login: (username: string, password: string) => post<{ token: string; refreshToken: string; user: User; isGuest: boolean }>('/auth/login', { username, password }),
  // 游客登录：登录页「游客登录」入口，无需凭据（后端为共享游客账号签发 24h 令牌）
  guest: () => post<{ token: string; refreshToken: string; user: User; isGuest: boolean }>('/auth/guest', {}),
  register: (username: string, password: string, nickname: string, inviteCode: string) =>
    post<{ token: string; refreshToken: string; user: User; isGuest: boolean }>('/auth/register', { username, password, nickname, inviteCode }),
  me: () => get<{ user: User; group: UserGroup; isGuest: boolean }>('/auth/me'),
  updateMe: (d: any) => put('/users/me', d),
  changePassword: (old_: string, new_: string) => put('/users/me/password', { old: old_, new: new_ }),
  setWebdavPassword: (password: string) => put('/users/me/webdav-password', { password })
}

export const siteApi = {
  publicInfo: () => get<{ siteName: string; registerOpen: boolean; needInviteCode: boolean; officeConfigured: boolean; announcement: string; guestLogin: boolean; theme: string; demoShare: string; standaloneApps: boolean; wallpaperCatalog: { name: string; url: string }[] }>('/site/public')
}

// 在线 Office：实时协作「正在编辑」状态
export const officeApi = {
  // 编辑器心跳（登录态；公开分享端点 /s/:token/office/status 为匿名同款）
  status: (qs: string) => get<any>(`/office/status?${qs}`),
  // 文件列表批量只读查询：不把查看者登记为编辑者
  statusBatch: (items: { key: string; policyId?: number; path?: string; shareId?: number; rel?: string }[]) =>
    post<Record<string, { editors: { name: string; mode: string }[]; modTime: number }>>('/office/status-batch', items)
}

export const notifyApi = {
  list: (limit = 50) => get<any[]>(`/notify?limit=${limit}`),
  unread: () => get<{ count: number }>('/notify/unread'),
  read: (id: number) => post('/notify/read', { id }),
  readAll: () => post('/notify/read', { all: true }),
  clear: () => post<{ cleared: number }>('/notify/clear', {})
}

export const fsApi = {
  policies: () => get<Policy[]>('/policies'),
  list: (policyId: number, path: string) => get<{ policy: Policy; path: string; items: FileItem[] }>(`/fs/list?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  mkdir: (policyId: number, path: string, name: string) => post('/fs/mkdir', { policyId, path, name }),
  rename: (policyId: number, path: string, newName: string) => post('/fs/rename', { policyId, path, newName }),
  move: (policyId: number, paths: string[], dstDir: string) => post('/fs/move', { policyId, paths, dstDir }),
  copy: (policyId: number, paths: string[], dstDir: string) => post('/fs/copy', { policyId, paths, dstDir }),
  crossCopy: (dstPolicyId: number, dstDir: string, items: { policyId: number; path: string }[]) => post('/fs/cross-copy', { dstPolicyId, dstDir, items }),
  crossMove: (dstPolicyId: number, dstDir: string, items: { policyId: number; path: string }[]) => post('/fs/cross-move', { dstPolicyId, dstDir, items }),
  remove: (policyId: number, paths: string[]) => post('/fs/delete', { policyId, paths }),
  search: (policyId: number, keyword: string, path = '/') => get<FileItem[]>(`/fs/search?policyId=${policyId}&keyword=${encodeURIComponent(keyword)}&path=${encodeURIComponent(path)}`),
  globalSearch: (q: string) => get<any[]>(`/fs/global-search?q=${encodeURIComponent(q)}`),
  properties: (policyId: number, path: string) => get<any>(`/fs/properties?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  dlink: (policyId: number, path: string, expireHours: number) => get<{ url: string; expireAt: number; permanent: boolean; name: string; size: number }>(`/fs/dlink?policyId=${policyId}&path=${encodeURIComponent(path)}&expireHours=${expireHours}`),
  readText: (policyId: number, path: string) => get<{ content: string }>(`/fs/text?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  writeText: (policyId: number, path: string, content: string) => post('/fs/text', { policyId, path, content }),
  archive: (policyId: number, paths: string[], name: string, extract = false) => post('/fs/archive', { policyId, paths, name, extract }),
  starList: () => get<any[]>('/stars'),
  starAdd: (policyId: number, path: string, name: string) => post('/stars', { policyId, path, name }),
  starRemove: (policyId: number, path: string) => del('/stars', { policyId, path }),
  fileVersions: (policyId: number, path: string) => get<any[]>(`/fileversions?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  fileVersionRestore: (policyId: number, path: string, version: number) => post('/fileversions/restore', { policyId, path, version }),
  fileVersionDownloadUrl: (policyId: number, path: string, version: number) =>
    `/api/fileversions/download?policyId=${policyId}&path=${encodeURIComponent(path)}&version=${version}&t=${getToken()}`,
  recycleList: () => get<any[]>('/recycle'),
  recycleRestore: (ids: number[]) => post('/recycle/restore', { ids }),
  recyclePurge: (ids: number[], all = false) => post('/recycle/purge', { ids, all })
}

export const shareApi = {
  create: (d: { policyId: number; path: string; password?: string; expireDays?: number; remainDownloads?: number; allowDownload?: boolean; previewEnabled?: boolean; allowEdit?: boolean }) => post<any>('/shares', d),
  mine: () => get<any[]>('/shares'),
  cancel: (id: number) => del(`/shares/${id}`),
  // 转存：把公开分享内容一键保存到自己账号（登录态；带提取码需 st）
  save: (token: string, d: { policyId: number; path: string }, st?: string) =>
    post<any>(`/s/${token}/save?st=${encodeURIComponent(st || '')}`, d)
}

// 系统功能（应用中心）
export interface SysApp { key: string; name: string; icon: string; desc: string; version: string; enabled: boolean; allowed: boolean }
export const appsApi = {
  list: () => get<SysApp[]>('/apps')
}

// 网络测速（内置应用；流式接口走 ?t= 令牌直连，避免 Bearer 头）
export const speedtestApi = {
  pingUrl: () => `/api/speedtest/ping?t=${getToken()}`,
  downloadUrl: (size: number) => `/api/speedtest/download?size=${size}&t=${getToken()}`,
  uploadUrl: () => `/api/speedtest/upload?t=${getToken()}`
}

// 内置浏览器：签发票据（iframe 子资源凭 ?pt= 走代理，避免真实 JWT 进资源 URL）
export const browserApi = {
  session: () => get<{ pt: string }>('/browser/session')
}

// 用户设置 KV（播放列表 / 观看进度 / 已安装应用等 JSON）
export const settingsApi = {
  get: (keys?: string[]) => get<Record<string, string>>('/settings' + (keys && keys.length ? `?keys=${keys.join(',')}` : '')),
  set: (key: string, value: string) => put('/settings', { key, value })
}

export const adminApi = {
  dashboard: () => get<any>('/admin/dashboard'),
  system: () => get<any>('/admin/system'),
  users: (page = 1, size = 20, keyword = '') => get<any>(`/admin/users?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  userCreate: (d: any) => post('/admin/users', d),
  userUpdate: (id: number, d: any) => put(`/admin/users/${id}`, d),
  userResetPwd: (id: number, password: string) => put(`/admin/users/${id}/password`, { password }),
  userDelete: (id: number) => del(`/admin/users/${id}`),
  groups: () => get<UserGroup[]>('/admin/groups'),
  groupSave: (d: any) => post('/admin/groups', d),
  groupDelete: (id: number) => del(`/admin/groups/${id}`),
  policies: () => get<Policy[]>('/admin/policies'),
  policyCreate: (d: any) => post('/admin/policies', d),
  policyUpdate: (id: number, d: any) => put(`/admin/policies/${id}`, d),
  policyToggle: (id: number, status: string) => put(`/admin/policies/${id}/status`, { status }),
  policyDelete: (id: number) => del(`/admin/policies/${id}`),
  settings: () => get<Record<string, string>>('/admin/settings'),
  settingsSet: (d: Record<string, string>) => put('/admin/settings', d),
  logs: (page = 1, size = 20, keyword = '') => get<any>(`/admin/logs?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  logsExport: (keyword = '') => `/api/admin/logs/export?keyword=${encodeURIComponent(keyword)}&t=${getToken()}`,
  notifications: (page = 1, size = 20, keyword = '', clearedOnly = false) =>
    get<{ total: number; items: any[] }>(`/admin/notifications?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}&cleared=${clearedOnly}`),
  tasks: () => get<any[]>('/admin/tasks'),
  shares: (page = 1, size = 50, keyword = '') => get<any>(`/admin/shares?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  shareDelete: (id: number) => del(`/admin/shares/${id}`),
  appToggle: (key: string, enabled: boolean) => post(`/admin/apps/${key}/toggle`, { enabled }),
  officeTest: (url?: string) => post<{ ok: boolean; msg: string }>(url ? `/admin/office-test?url=${encodeURIComponent(url)}` : '/admin/office-test'),
  // 多 Document Server（健康检查 + 故障切换）
  officeDses: () => get<any>('/admin/office-dses'),
  officeDsesSave: (list: { name: string; url: string; jwt: string; priority: number }[]) => post<any>('/admin/office-dses', list),
  // 系统更新
  updateCheck: () => get<any>('/admin/update/check'),
  updateStart: () => post<any>('/admin/update/start'),
  updateStatus: () => get<any>('/admin/update/status'),
  updateHistory: () => get<any[]>('/admin/update/history')
}

// 分块上传
export const uploadApi = {
  init: (d: { policyId: number; parent: string; name: string; size: number; chunkSize: number; hash: string }) =>
    post<{ instant: boolean; path?: string; sessionId?: string; chunkSize?: number; totalChunks?: number; received?: number[] }>('/upload/init', d),
  chunk: (sid: string, idx: number, data: ArrayBuffer) =>
    // 大分片在慢速网络下可能超过全局 60s 超时，分片请求不设超时
    api('PUT', `/upload/chunk/${sid}/${idx}`, data, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 0 }),
  complete: (sessionId: string) => post<any>('/upload/complete', { sessionId }),
  abort: (sid: string) => api('DELETE', `/upload/${sid}`),
  status: (sid: string) => get<any>(`/upload/${sid}/status`)
}

// 站内用户共享
export const userShareApi = {
  users: () => get<any[]>('/users'),
  groups: () => get<{ id: number; name: string }[]>('/groups'),
  // targetType: user=指定用户 / group=用户组 / all=所有人（all 时 targetId=0）
  create: (d: { policyId: number; path: string; targetType: 'user' | 'group' | 'all'; targetId: number; perm: string }) => post<any>('/usershares', d),
  mine: () => get<any[]>('/usershares'),
  cancel: (id: number) => del(`/usershares/${id}`),
  withMe: () => get<any[]>('/usershares/with-me'),
  info: (id: number) => get<any>(`/shared/${id}/info`),
  list: (id: number, rel: string) => get<{ items: any[]; perm: string; name: string; rel: string }>(`/shared/${id}/list?rel=${encodeURIComponent(rel)}`),
  mkdir: (id: number, rel: string, name: string) => post(`/shared/${id}/mkdir`, { rel, name }),
  del: (id: number, rels: string[]) => post(`/shared/${id}/delete`, { rels }),
  upload: (id: number, rel: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('rel', rel)
    return post('/shared/' + id + '/upload', fd)
  },
  rawUrl: (id: number, rel: string) => `/api/shared/${id}/raw?rel=${encodeURIComponent(rel)}&t=${getToken()}`,
  dlUrl: (id: number, rel: string) => `/api/shared/${id}/download?rel=${encodeURIComponent(rel)}&t=${getToken()}`
}

// img/video/iframe/a 标签无法带 Authorization 头，改用 ?t= 查询令牌
export function rawUrl(policyId: number, path: string) {
  return `/api/fs/raw?policyId=${policyId}&path=${encodeURIComponent(path)}&t=${getToken()}`
}
// 媒体内嵌封面（mp3/flac/ogg）：无封面时 404，由调用方 onerror 回退
export function coverUrl(policyId: number, path: string) {
  return `/api/fs/raw?policyId=${policyId}&path=${encodeURIComponent(path)}&cover=1&t=${getToken()}`
}
export function downloadUrl(policyId: number, paths: string[]) {
  const q = paths.map(p => 'path=' + encodeURIComponent(p)).join('&')
  return `/api/fs/download?policyId=${policyId}&${q}&t=${getToken()}`
}

// ---- 终端（本地真实 shell / 远程 SSH + SFTP）----

export interface SshConnView {
  id: number; name: string; host: string; port: number
  username: string; authType: 'password' | 'key'
}
export interface SshConnInput {
  name: string; host: string; port: number; username: string
  authType: 'password' | 'key'; password?: string; privateKey?: string
}
export interface SftpEntry {
  name: string; type: 'dir' | 'file'; size: number; modTime: string; perm: string
}

export const termApi = {
  platform: () => get<{ os: string; shells: string[]; defaultShell: string }>('/terminal/platform'),
  conns: () => get<SshConnView[]>('/terminal/conns'),
  connSave: (d: SshConnInput) => post<SshConnView>('/terminal/conns', d),
  connUpdate: (id: number, d: SshConnInput) => put<SshConnView>(`/terminal/conns/${id}`, d),
  connDelete: (id: number) => del(`/terminal/conns/${id}`),
  connTest: (id: number) => post<{ ok: boolean; latencyMs: number; os: string }>(`/terminal/conns/${id}/test`),
  fsList: (connId: number, p: string) =>
    get<{ path: string; parent: string; entries: SftpEntry[] }>(
      `/terminal/fs/list?connId=${connId}&path=${encodeURIComponent(p)}`),
  fsOp: (d: { connId: number; op: 'mkdir' | 'delete' | 'rename' | 'move'; path: string; target?: string }) =>
    post('/terminal/fs/op', d),
  fsDownloadUrl: (connId: number, p: string) =>
    `/api/terminal/fs/download?connId=${connId}&path=${encodeURIComponent(p)}&t=${getToken()}`,
  // 原始字节流上传（XHR 以便上报进度）
  fsUpload: (connId: number, dir: string, name: string, data: Blob,
    overwrite: boolean, onProgress?: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `/api/terminal/fs/upload?connId=${connId}&path=${encodeURIComponent(dir)}` +
        `&name=${encodeURIComponent(name)}${overwrite ? '&overwrite=1' : ''}&t=${getToken()}`
      xhr.open('POST', url)
      xhr.setRequestHeader('Authorization', 'Bearer ' + (getToken() || ''))
      xhr.responseType = 'text'
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status === 401) { clearToken(); if (location.hash !== '#/login') location.hash = '#/login'; return reject(new Error('未登录')) }
        if (xhr.status >= 200 && xhr.status < 300) {
          try { const r = JSON.parse(xhr.responseText); if (r.code !== 0) return reject(new Error(r.msg)) } catch { /* ok */ }
          return resolve()
        }
        reject(new Error('上传失败（HTTP ' + xhr.status + '）'))
      }
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.send(data)
    })
}

/** 终端 WebSocket 地址（浏览器 WS 无法自定义头，令牌走 ?t=） */
export function termWsUrl(mode: 'local' | 'ssh', params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({ mode, t: getToken() || '' })
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/terminal/ws?${qs.toString()}`
}
