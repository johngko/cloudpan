import { api, get, post, put, del, getToken, clearToken } from './http'
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
  // 展示口径按角色分离（后端计算）：
  // 管理员 = 整盘已用 / 分区大小（挂载时设定或真实分区大小）；非管理员 = 本人已用 / 本人配额
  totalBytes?: number // 0/缺省 = 不限量或未知（进度条中性显示）
  quotaBytes?: number // 管理员设定的分区标称大小（0=自动）
}
/** 管理端存储行（GET /admin/policies）：内含 options（密钥）等仅管理员可见字段，
 *  与基础 Policy 的差别是 totalBytes/quotaBytes 恒有值、并多出 statusMsg —— 别把它当 Policy 用 */
export interface AdminPolicyRow {
  id: number; name: string; letter: string; type: string; rootPath: string
  options: Record<string, string>
  status: string; statusMsg: string
  usageBytes: number; quotaBytes: number; totalBytes: number
  createdAt: string
}
export interface FileItem {
  name: string; isDir: boolean; size: number; modTime: number; ext: string
  path: string; starred?: boolean
  letter?: string // 搜索/跨盘结果带盘符，用于同名路径去重（grid key）
}

/** 通知（GET /notify：裸数组，直接序列化后端 model.Notification） */
export interface NotifyItem {
  id: number; userId: number; type: string; title: string; content: string
  refId: number; read: boolean; cleared: boolean; createdAt: string
}
/** 收藏的目录（GET /stars） */
export interface StarItem {
  id: number; userId: number; policyId: number; path: string; name: string; createdAt: string
}
/** 回收站条目（GET /recycle；后端 trashPath 标了 json:"-"，不会下发） */
export interface RecycleItem {
  id: number; userId: number; ownerId: number; policyId: number
  origPath: string; name: string; isDir: boolean; size: number; deletedAt: string
}
/** 历史版本（GET /fileversions） */
export interface FileVersionItem {
  id: number; userId: number; policyId: number; path: string
  version: number; size: number; ext: string; operator: string; createdAt: string
}
/** 属性面板（GET /fs/properties）：sha256 仅文件有；文件 >4GB 时另给 sha256Note */
export interface FileProps {
  entry: FileItem
  count: number; dirCount: number; size: number; path: string
  sha256?: string; sha256Note?: string
}
/** 全局搜索命中（GET /fs/global-search；kind=browse 时为各盘顶层首屏） */
export interface SearchHit extends FileItem {
  policyId: number; letter: string; policyName: string; policyType: string
}
/** 后端任务（GET /tasks、GET /offline：直接序列化 model.Task）。
 *  注意 props 是 **JSON 字符串**（字段随任务类型不同），用前必须 JSON.parse */
export interface TaskItem {
  id: number; userId: number; type: string; status: string
  progress: number; error: string; props: string; createdAt: string; updatedAt: string
}
/** Office 协作状态（GET /office/status） */
export interface OfficeStatus {
  docKey: string; modTime: number
  editors: { name: string; mode: string; me: boolean }[]
}
/** 站内共享（GET /usershares、/usershares/with-me）。
 *  注意 owner=昵称、ownerName=用户名 —— 与公开分享同名概念但字段名不同，别混用 */
export interface UserShareItem {
  id: number; name: string; perm: string; path: string
  targetType: string; targetName: string
  ownerId: number; owner: string; ownerName: string; createdAt: string
}
/** 共享信息（GET /shared/:id/info） */
export interface UserShareInfo { name: string; perm: string; owner: string; ownerName: string }
/** 共享目录条目（GET /shared/:id/list） */
export interface SharedEntry {
  name: string; isDir: boolean; size: number; modTime: number; ext: string
  relPath: string
}
/** 我的公开分享列表项（GET /shares：手工拼的 gin.H，给的是 hasPassword 而非 passwordHash） */
export interface ShareItem {
  id: number; userId: number; policyId: number; path: string; name: string; isDir: boolean
  token: string; hasPassword: boolean; expiresAt: string | null; remainDownloads: number
  previewEnabled: boolean; allowDownload: boolean; allowEdit: boolean; encrypted: boolean
  views: number; downloads: number; createdAt: string
}
/** 新建分享的返回（POST /shares：直接序列化 model.Share → 无 hasPassword，多 encSalt） */
export type ShareCreated = Omit<ShareItem, 'hasPassword'> & { encSalt: string }
/** 上传会话状态（GET /upload/:sid/status） */
export interface UploadStatus {
  status: string; progress: number; received: number; totalChunks: number
  size: number; uploaded: number; error: string
}
/** 分块上传初始化（POST /upload/init）：秒传 / 普通两种形态。
 *  注意：判别式 instant 是布尔字面量，TS 对它的**真值判断不会收窄**
 *  （`if (r.instant)` 之后仍拿不到 sessionId），必须写 `if (r.instant === true)` */
export type UploadInit =
  | { instant: true; path: string }
  | { instant: false; sessionId: string; chunkSize: number; totalChunks: number; received: number[] }

/** PUT /users/me 请求体（两个字段都可单独省略） */
export interface MeUpdateIn { nickname?: string; avatar?: number }
/** 管理端：新建用户请求体 */
export interface AdminUserCreateIn { username: string; password: string; nickname: string; role: string; groupId: number; quotaMB: number }
/** 管理端：改用户请求体（全字段可选） */
export interface AdminUserUpdateIn { nickname?: string; role?: string; groupId?: number; disabled?: boolean; quotaMB?: number; appPerms?: Record<string, boolean> }
/** 管理端：存储策略新建/更新请求体（同一结构） */
export interface PolicyIn { name: string; letter: string; type: string; rootPath: string; options?: Record<string, string>; quotaGB?: number }
/** 新建公开分享请求体 */
export interface ShareCreateIn {
  policyId: number; path: string; password?: string; expireDays?: number
  remainDownloads?: number; allowDownload?: boolean; previewEnabled?: boolean; allowEdit?: boolean
}

export const authApi = {
  // isGuest：是否游客共享账号（系统托管身份，前端据此隐藏账号自管理入口；后端另有 GuestReadOnly 兜底）
  login: (username: string, password: string) => post<{ token: string; refreshToken: string; user: User; isGuest: boolean }>('/auth/login', { username, password }),
  // 游客登录：登录页「游客登录」入口，无需凭据（后端为共享游客账号签发 24h 令牌）
  guest: () => post<{ token: string; refreshToken: string; user: User; isGuest: boolean }>('/auth/guest', {}),
  register: (username: string, password: string, nickname: string, inviteCode: string) =>
    post<{ token: string; refreshToken: string; user: User; isGuest: boolean }>('/auth/register', { username, password, nickname, inviteCode }),
  me: () => get<{ user: User; group: UserGroup; isGuest: boolean }>('/auth/me'),
  updateMe: (d: MeUpdateIn) => put<User>('/users/me', d),
  changePassword: (old_: string, new_: string) => put('/users/me/password', { old: old_, new: new_ }),
  setWebdavPassword: (password: string) => put('/users/me/webdav-password', { password })
}

export const siteApi = {
  publicInfo: () => get<{ siteName: string; registerOpen: boolean; needInviteCode: boolean; officeConfigured: boolean; announcement: string; guestLogin: boolean; theme: string; demoShare: string; standaloneApps: boolean; wallpaperCatalog: { name: string; url: string }[] }>('/site/public')
}

// 在线 Office：实时协作「正在编辑」状态
export const officeApi = {
  // 编辑器心跳（登录态；公开分享端点 /s/:token/office/status 为匿名同款）
  status: (qs: string) => get<OfficeStatus>(`/office/status?${qs}`),
  // 文件列表批量只读查询：不把查看者登记为编辑者
  statusBatch: (items: { key: string; policyId?: number; path?: string; shareId?: number; rel?: string }[]) =>
    post<Record<string, { editors: { name: string; mode: string }[]; modTime: number }>>('/office/status-batch', items)
}

export const notifyApi = {
  list: (limit = 50) => get<NotifyItem[]>(`/notify?limit=${limit}`),
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
  move: (policyId: number, paths: string[], dstDir: string, overwrite = false) => post('/fs/move', { policyId, paths, dstDir, overwrite }),
  copy: (policyId: number, paths: string[], dstDir: string) => post('/fs/copy', { policyId, paths, dstDir }),
  crossCopy: (dstPolicyId: number, dstDir: string, items: { policyId: number; path: string }[]) => post('/fs/cross-copy', { dstPolicyId, dstDir, items }),
  crossMove: (dstPolicyId: number, dstDir: string, items: { policyId: number; path: string }[]) => post('/fs/cross-move', { dstPolicyId, dstDir, items }),
  remove: (policyId: number, paths: string[]) => post('/fs/delete', { policyId, paths }),
  search: (policyId: number, keyword: string, path = '/') => get<FileItem[]>(`/fs/search?policyId=${policyId}&keyword=${encodeURIComponent(keyword)}&path=${encodeURIComponent(path)}`),
  globalSearch: (q: string, kind?: string) => get<SearchHit[]>(`/fs/global-search?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ''}`),
  properties: (policyId: number, path: string) => get<FileProps>(`/fs/properties?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  dlink: (policyId: number, path: string, expireHours: number) => get<{ url: string; expireAt: number; permanent: boolean; name: string; size: number }>(`/fs/dlink?policyId=${policyId}&path=${encodeURIComponent(path)}&expireHours=${expireHours}`),
  readText: (policyId: number, path: string) => get<{ content: string }>(`/fs/text?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  writeText: (policyId: number, path: string, content: string) => post('/fs/text', { policyId, path, content }),
  archive: (policyId: number, paths: string[], name: string, extract = false, opts: { password?: string; encoding?: string; mask?: string; dst?: string } = {}) =>
    post('/fs/archive', { policyId, paths, name, extract, password: opts.password || '', encoding: opts.encoding || '', mask: opts.mask || '', dst: opts.dst || '' }),
  // 压缩包在线浏览：列出归档内容（扁平条目）
  archiveList: (policyId: number, path: string, encoding = '', password = '') =>
    get<{ meta: { format: string; compress: string }; entries: { name: string; size: number; mtime: number; isDir: boolean }[] }>(
      `/fs/archive/list?policyId=${policyId}&path=${encodeURIComponent(path)}&encoding=${encodeURIComponent(encoding)}&password=${encodeURIComponent(password)}`),
  // 压缩包内单条目直链（?t= 令牌，供 img/iframe/下载）
  archiveRawUrl: (policyId: number, path: string, entry: string, encoding = '', password = '') =>
    `/api/fs/archive/raw?policyId=${policyId}&path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry)}&encoding=${encodeURIComponent(encoding)}&password=${encodeURIComponent(password)}&t=${getToken()}`,
  tasks: () => get<TaskItem[]>('/tasks'),
  starList: () => get<StarItem[]>('/stars'),
  starAdd: (policyId: number, path: string, name: string) => post('/stars', { policyId, path, name }),
  starRemove: (policyId: number, path: string) => del('/stars', { policyId, path }),
  fileVersions: (policyId: number, path: string) => get<FileVersionItem[]>(`/fileversions?policyId=${policyId}&path=${encodeURIComponent(path)}`),
  fileVersionRestore: (policyId: number, path: string, version: number) => post('/fileversions/restore', { policyId, path, version }),
  fileVersionDownloadUrl: (policyId: number, path: string, version: number) =>
    `/api/fileversions/download?policyId=${policyId}&path=${encodeURIComponent(path)}&version=${version}&t=${getToken()}`,
  recycleList: () => get<RecycleItem[]>('/recycle'),
  recycleRestore: (ids: number[]) => post('/recycle/restore', { ids }),
  recyclePurge: (ids: number[], all = false) => post('/recycle/purge', { ids, all })
}

export const shareApi = {
  create: (d: ShareCreateIn) => post<ShareCreated>('/shares', d),
  mine: () => get<ShareItem[]>('/shares'),
  cancel: (id: number) => del(`/shares/${id}`),
  // 转存：把公开分享内容一键保存到自己账号（登录态；带提取码需 st）
  save: (token: string, d: { policyId: number; path: string }, st?: string) =>
    post<{ saved: boolean; bytes: number }>(`/s/${token}/save?st=${encodeURIComponent(st || '')}`, d)
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

export interface AuditItem {
  id: number
  username: string
  action: string
  detail: string
  ip: string
  createdAt: string
}

// 本人操作记录（只读，后端按 user_id 严格过滤；管理员查全量走 adminApi.logs）
export const auditApi = {
  mine: (page = 1, size = 20, keyword = '') =>
    get<{ total: number; items: AuditItem[] }>(`/audit/mine?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`)
}

/** 管理端分页（后端 dto.PageOut）：统一 { total, items } */
export interface PageOut<T> { total: number; items: T[] }
/** 总览（GET /admin/dashboard） */
export interface AdminDashboard {
  users: number; shares: number; policies: number; recycle: number
  usedBytes: number; serverTime: number
}
/** 系统信息（GET /admin/system；注意 CPU 逐核字段名是 perCore） */
export interface AdminSystem {
  at: number; hostname: string; os: string; platform: string; kernel: string; uptime: number
  goVersion: string; perCore: number[]; cpuPct: number; cores: number; model: string
  memTotal: number; memUsed: number; memPct: number; swapTotal: number; swapUsed: number
  disks: { mount: string; fstype: string; total: number; used: number; free: number; pct: number }[]
  nets: { name: string; rxRate: number; txRate: number; rxTotal: number; txTotal: number }[]
}
/** 用户行（GET /admin/users；appPerms 被后端覆盖成了对象，无需再解析） */
export interface AdminUser {
  id: number; username: string; nickname: string; avatar: number; role: string
  groupId: number; disabled: boolean; quotaMB: number; usedBytes: number
  appPerms: Record<string, boolean>; createdAt: string; lastLoginAt: string | null
}
/** 通知记录行（GET /admin/notifications；比用户侧少了 userId/refId） */
export interface AdminNotification {
  id: number; username: string; type: string; title: string; content: string
  read: boolean; cleared: boolean; createdAt: string
}
/** 分享行（GET /admin/shares；手工 gin.H，owner=昵称、ownerName=用户名） */
export interface AdminShare {
  id: number; name: string; isDir: boolean; owner: string; ownerName: string
  hasPassword: boolean; views: number; downloads: number
  allowDownload: boolean; expiresAt: string | null; createdAt: string
}
/** 站内共享行（GET /admin/usershares） */
export interface AdminUserShare {
  id: number; name: string; path: string; perm: string; policy: string
  owner: string; ownerName: string; targetType: string; targetName: string
  views: number; downloads: number; createdAt: string
}
/** Document Server 健康态（GET /admin/office-dses；jwt 明文，仅管理员端点） */
export interface OfficeDs {
  name: string; url: string; jwt: string; priority: number
  healthy: boolean; latencyMs: number; active: boolean; origin: string
}
export interface OfficeDsState { list: OfficeDs[]; lastCheck: number; active: OfficeDs | null }
/** 更新检查（GET /admin/update/check） */
export interface UpdateCheck {
  current: string; latest: string; hasUpdate: boolean
  release: { version: string; name: string; notes: string; url: string; size: number; mode: string }
  checkedAt: number; busy: boolean
}
/** 更新进度（GET /admin/update/status） */
export interface UpdateStatus {
  current: string; status: string; progress: number; received: number; total: number
  speed: number; target: string; msg: string; started: number
}
/** 更新历史（GET /admin/update/history） */
export interface UpdateLog {
  id: number; from: string; to: string; url: string; bytes: number
  status: string; error: string; createdAt: string
}
/** 转码能力探测（GET /admin/transcode/probe） */
export interface TranscodeProbe { ffmpeg: boolean; version: string; hw: string; working: string[] }

export const adminApi = {
  dashboard: () => get<AdminDashboard>('/admin/dashboard'),
  system: () => get<AdminSystem>('/admin/system'),
  users: (page = 1, size = 20, keyword = '') => get<PageOut<AdminUser>>(`/admin/users?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  userCreate: (d: AdminUserCreateIn) => post('/admin/users', d),
  userUpdate: (id: number, d: AdminUserUpdateIn) => put(`/admin/users/${id}`, d),
  userResetPwd: (id: number, password: string) => put(`/admin/users/${id}/password`, { password }),
  userDelete: (id: number) => del(`/admin/users/${id}`),
  groups: () => get<UserGroup[]>('/admin/groups'),
  groupSave: (d: UserGroup) => post('/admin/groups', d),
  groupDelete: (id: number) => del(`/admin/groups/${id}`),
  policies: () => get<AdminPolicyRow[]>('/admin/policies'),
  policyCreate: (d: PolicyIn) => post<Policy>('/admin/policies', d),
  policyUpdate: (id: number, d: PolicyIn) => put<Policy>(`/admin/policies/${id}`, d),
  policyToggle: (id: number, status: string) => put(`/admin/policies/${id}/status`, { status }),
  policyDelete: (id: number) => del(`/admin/policies/${id}`),
  settings: () => get<Record<string, string>>('/admin/settings'),
  settingsSet: (d: Record<string, string>) => put('/admin/settings', d),
  logs: (page = 1, size = 20, keyword = '') => get<PageOut<AuditItem>>(`/admin/logs?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  logsExport: (keyword = '') => `/api/admin/logs/export?keyword=${encodeURIComponent(keyword)}&t=${getToken()}`,
  notifications: (page = 1, size = 20, keyword = '', clearedOnly = false) =>
    get<PageOut<AdminNotification>>(`/admin/notifications?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}&cleared=${clearedOnly}`),
  tasks: () => get<TaskItem[]>('/admin/tasks'),
  shares: (page = 1, size = 50, keyword = '') => get<PageOut<AdminShare>>(`/admin/shares?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  shareDelete: (id: number) => del(`/admin/shares/${id}`),
  userShares: (page = 1, size = 100, keyword = '') => get<PageOut<AdminUserShare>>(`/admin/usershares?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
  userShareDelete: (id: number) => del(`/admin/usershares/${id}`),
  appToggle: (key: string, enabled: boolean) => post(`/admin/apps/${key}/toggle`, { enabled }),
  officeTest: (url?: string) => post<{ ok: boolean; msg: string }>(url ? `/admin/office-test?url=${encodeURIComponent(url)}` : '/admin/office-test'),
  // 多 Document Server（健康检查 + 故障切换）
  officeDses: () => get<OfficeDsState>('/admin/office-dses'),
  officeDsesSave: (list: { name: string; url: string; jwt: string; priority: number }[]) => post<{ saved: number }>('/admin/office-dses', list),
  // 系统更新
  updateCheck: () => get<UpdateCheck>('/admin/update/check'),
  updateStart: () => post<{ started: boolean; target: string }>('/admin/update/start'),
  updateStatus: () => get<UpdateStatus>('/admin/update/status'),
  updateHistory: () => get<UpdateLog[]>('/admin/update/history'),
  transcodeProbe: () => get<TranscodeProbe>('/admin/transcode/probe'),
}

// 分块上传
export const uploadApi = {
  init: (d: { policyId: number; parent: string; name: string; size: number; chunkSize: number; hash: string }) =>
    post<UploadInit>('/upload/init', d),
  chunk: (sid: string, idx: number, data: ArrayBuffer | Blob) =>
    // 大分片在慢速网络下可能超过全局 60s 超时，分片请求不设超时
    api('PUT', `/upload/chunk/${sid}/${idx}`, data, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 0 }),
  complete: (sessionId: string) =>
    // 服务端异步合并：complete 只做状态跃迁立即返回，但远端 DB 慢时跃迁链路本身也可能超过 60s
    post<{ status: string; sessionId: string }>('/upload/complete', { sessionId }, { timeout: 180000 }),
  abort: (sid: string) => api('DELETE', `/upload/${sid}`),
  status: (sid: string) => get<UploadStatus>(`/upload/${sid}/status`)
}

// 站内用户共享
export const userShareApi = {
  users: () => get<User[]>('/users'),
  groups: () => get<{ id: number; name: string }[]>('/groups'),
  // targetType: user=指定用户 / group=用户组 / all=所有人（all 时 targetId=0）
  create: (d: { policyId: number; path: string; targetType: 'user' | 'group' | 'all'; targetId: number; perm: string }) => post<UserShareItem>('/usershares', d),
  mine: () => get<UserShareItem[]>('/usershares'),
  cancel: (id: number) => del(`/usershares/${id}`),
  withMe: () => get<UserShareItem[]>('/usershares/with-me'),
  info: (id: number) => get<UserShareInfo>(`/shared/${id}/info`),
  list: (id: number, rel: string) => get<{ items: SharedEntry[]; perm: string; name: string; rel: string }>(`/shared/${id}/list?rel=${encodeURIComponent(rel)}`),
  mkdir: (id: number, rel: string, name: string) => post(`/shared/${id}/mkdir`, { rel, name }),
  del: (id: number, rels: string[]) => post(`/shared/${id}/delete`, { rels }),
  // 小文件直传（单次 FormData）：无需分片、无需秒传判定的场景（如共享盘拖入小文件）
  upload: (id: number, rel: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('rel', rel)
    return post('/shared/' + id + '/upload', fd)
  },
  // 共享盘分片上传：只有 init 需要共享上下文（rel = 共享内相对目录）；
  // 分片/完成/状态/取消复用 /upload/*（见 stores/transfer 的上传泵）
  uploadInit: (id: number, d: { rel: string; name: string; size: number; chunkSize: number; hash: string }) =>
    post<{ instant: boolean; path?: string; sessionId?: string; chunkSize?: number; totalChunks?: number; received?: number[] }>(`/shared/${id}/upload/init`, d),
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
