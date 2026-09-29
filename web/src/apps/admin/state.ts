// 管理控制台的状态与业务逻辑（单例 composable）。
//
// 设计：ref 定义在模块作用域并具名导出 —— AdminConsole 是单实例应用（stores/apps.ts 未标 multi），
// 因此全站只有一份管理台状态，各页签/对话框组件直接 import 所需成员即可拿到同一批 ref，
// 不需要任何 props/emits 管道。生命周期（首次载入、轮询启停）仍由 AdminConsole.vue 负责。
import { ref, computed } from 'vue'
import { useSession } from '../../stores/session'
import { useAppState } from '../../stores/appstate'
import { useUiDialog, useToast } from '../../stores/dialog'
import {
  adminApi, appsApi,
  type AdminUser, type AdminPolicyRow, type AdminShare, type AdminUserShare,
  type UserGroup, type SysApp, type TaskItem, type AuditItem
} from '../../api/modules'
// qrcode 无内置类型；其 @types/qrcode 依赖 @types/node 会污染浏览器端全局类型（setTimeout 等），
// 因此不安装类型包，仅在此局部忽略缺声明报错
// @ts-ignore
import QRCode from 'qrcode'
import { fmt, quotaModeOf, quotaModeToMB, resolveUpdMode, type QuotaMode, type UpdMode } from './format'

const session = useSession()
const appstate = useAppState()
const uiDlg = useUiDialog()
const toast = useToast()

// ---- 页签 ----
export const tab = ref('dash')
export const tabs = computed<{ id: string; name: string; icon: string; badge?: string }[]>(() => [
  { id: 'dash', name: '仪表盘', icon: 'info' },
  { id: 'users', name: '用户管理', icon: 'user' },
  { id: 'groups', name: '用户组', icon: 'lock' },
  { id: 'policies', name: '存储策略', icon: 'drive' },
  { id: 'shares', name: '分享审计', icon: 'share' },
  { id: 'usershares', name: '共享审计', icon: 'share2' },
  { id: 'tasks', name: '任务监控', icon: 'list' },
  { id: 'settings', name: '站点设置', icon: 'settings' },
  { id: 'update', name: '系统更新', icon: 'refresh' },
  { id: 'logs', name: '审计日志', icon: 'edit' },
  { id: 'notify', name: '通知记录', icon: 'bell' }
])

// ---- 数据（列表类用 api 层的契约类型；表单/三方形状保持宽松，与原实现一致）----
export const dash = ref<any>({})
export const users = ref<AdminUser[]>([])
export const groups = ref<UserGroup[]>([])
export const policies = ref<AdminPolicyRow[]>([])
export const allShares = ref<AdminShare[]>([])
// 站内用户共享审计（与外链分享审计并列）
export const allUserShares = ref<AdminUserShare[]>([])
export const userShareKw = ref('')
export const tasks = ref<TaskItem[]>([])
export const logs = ref<AuditItem[]>([])
export const logPage = ref(1)
export const logTotal = ref(0)
export const logKw = ref('')
// 通知行沿用宽松类型：后端该端点的 DTO 不含 userId，模板里有 `n.username || n.userId` 兜底
export const notifList = ref<any[]>([])
export const notifPage = ref(1)
export const notifTotal = ref(0)
export const notifKw = ref('')
export const notifClearedOnly = ref(false)
export const settings = ref<Record<string, string>>({})
// 系统功能清单（应用权限 UI 数据源）
export const appDefs = ref<SysApp[]>([])

// ---- 系统资源监控（3s 轮询，仅仪表盘页激活时）----
export const sys = ref<any>(null)
export const sysMsg = ref('')
let sysTimer: number | undefined
const sysOn = computed(() => appstate.isOn('system_monitor'))
async function loadSys() {
  if (!sysOn.value) { sys.value = null; sysMsg.value = '系统监控已被管理员停用（应用中心可开启）'; return }
  try {
    sys.value = await adminApi.system()
    sysMsg.value = ''
  } catch (e: any) {
    if (e?.code === 403 || /停用/.test(e?.message || '')) { sys.value = null; sysMsg.value = '系统监控已被管理员停用' }
    else sys.value = null
  }
}
export function startSysPoll() {
  stopSysPoll()
  loadSys()
  sysTimer = window.setInterval(loadSys, 3000)
}
export function stopSysPoll() {
  if (sysTimer) { clearInterval(sysTimer); sysTimer = undefined }
}

// ---- 系统更新（检查/下载/自重启；更新中 2s 轮询状态）----
export const updStatus = ref<any>({ current: '', status: 'idle', progress: 0, received: 0, total: 0, speed: 0, msg: '' })
export const updInfo = ref<any>({})
export const updHistory = ref<any[]>([])
export const updChecking = ref(false)
let updTimer: number | undefined
export const updBusy = computed(() => ['downloading', 'replacing'].includes(updStatus.value.status))
export const updMsgText = computed(() => {
  const m = updStatus.value.msg || ''
  if (updStatus.value.status === 'downloading') return m || '下载中…'
  if (updStatus.value.status === 'replacing') return '重启中，页面几秒后自动恢复…'
  return m
})
// 更新来源模式。后端以「update_url 是否为空」判定直链/仓库，而地址为空时选中「直链」并不改变
// 该真值 → Vue 判定绑定值未变、不回写已被用户交互改动的 DOM，表现为「下拉变直链、面板仍是仓库」。
// 这里用一层本地覆盖（用户本次手动选择）让面板立即跟随；保存成功后清空覆盖、重新以数据为准。
const updModeOverride = ref<UpdMode | null>(null)
export const updMode = computed<UpdMode>({
  get: () => resolveUpdMode(settings.value.update_url, updModeOverride.value),
  set: (m: UpdMode) => {
    updModeOverride.value = m
    if (m === 'github') settings.value.update_url = '' // 切回仓库模式时清掉直链地址（原语义）
  }
})
export async function loadUpdStatus() {
  try { updStatus.value = await adminApi.updateStatus() } catch { /* ignore */ }
}
export async function loadUpdHistory() {
  try { updHistory.value = await adminApi.updateHistory() } catch { /* ignore */ }
}
export async function checkUpdate() {
  updChecking.value = true
  try {
    updInfo.value = await adminApi.updateCheck()
  } catch (e: any) {
    toast.error('检查更新失败：' + (e.message || ''))
  } finally {
    updChecking.value = false
  }
}
export async function startUpdate() {
  if (!confirm('将下载并替换当前运行的二进制（自动备份旧版本后重启）。继续？')) return
  try {
    await adminApi.updateStart()
    startUpdPoll()
  } catch (e: any) {
    toast.error('启动更新失败：' + (e.message || ''))
  }
}
export function startUpdPoll() {
  stopUpdPoll()
  loadUpdStatus()
  updTimer = window.setInterval(async () => {
    await loadUpdStatus()
    // 重启完成（状态回到 idle 且版本号变化）或出错 → 停止轮询
    if (['idle', 'error'].includes(updStatus.value.status)) {
      stopUpdPoll()
      loadUpdHistory()
      if (updStatus.value.status === 'idle') checkUpdate()
    }
  }, 2000)
}
export function stopUpdPoll() {
  if (updTimer) { clearInterval(updTimer); updTimer = undefined }
}
export async function saveUpdSource() {
  try {
    await adminApi.settingsSet({
      update_repo: settings.value.update_repo || 'johngko/cloudpan',
      update_proxy: settings.value.update_proxy || '',
      update_url: settings.value.update_url || '',
      update_version: settings.value.update_version || ''
    })
    updModeOverride.value = null // 已落库：显示重新以数据为准（保存后模式与实际生效来源一致）
    toast.success('更新来源已保存')
  } catch (e: any) {
    toast.error('保存失败：' + (e.message || ''))
  }
}

// ---- 用户对话框 / 配额 / 权限 ----
export const userShow = ref(false)
export const userForm = ref<any>({})
export const emptyUser = { username: '', password: '', nickname: '', role: 'user', groupId: 0 }
// 用户配额覆盖：-1 随组 / 0 不限量 / >0 专属上限(MB)
export const quotaShow = ref(false)
export const quotaUser = ref<AdminUser | null>(null)
export const quotaMode = ref<QuotaMode>('group')
export const quotaCustom = ref(1024)
export function groupQuotaMB(id?: number) { return groups.value.find(g => g.id === id)?.quotaMB ?? 0 }
export function openQuota(u: AdminUser) {
  quotaUser.value = u
  quotaMode.value = quotaModeOf(u)
  if (u.quotaMB > 0) quotaCustom.value = u.quotaMB
  quotaShow.value = true
}
export async function saveQuota() {
  const u = quotaUser.value
  if (!u) return
  const mb = quotaModeToMB(quotaMode.value, quotaCustom.value)
  try { await adminApi.userUpdate(u.id, { quotaMB: mb }); quotaShow.value = false; toast.success('配额已更新'); await loadAll() } catch (e: any) { toast.error(e.message) }
}
// 用户个人应用权限（三态：键缺失=继承用户组 / true=允许 / false=禁止）
export const permShow = ref(false)
export const permUser = ref<AdminUser | null>(null)
export const permForm = ref<Record<string, boolean>>({})
export function openPerms(u: AdminUser) {
  permUser.value = u
  permForm.value = { ...(u.appPerms || {}) }
  permShow.value = true
}
export function setPerm(key: string, mode: 'inherit' | 'allow' | 'deny') {
  if (mode === 'inherit') delete permForm.value[key]
  else permForm.value[key] = mode === 'allow'
}
export function setGroupPerm(key: string, mode: 'inherit' | 'allow' | 'deny') {
  if (!editGroup.value.appPerms) editGroup.value.appPerms = {}
  if (mode === 'inherit') delete editGroup.value.appPerms[key]
  else editGroup.value.appPerms[key] = mode === 'allow'
}
export const savingPerms = ref(false)
export async function savePerms() {
  const u = permUser.value
  if (!u) return
  if (savingPerms.value) return
  savingPerms.value = true
  try { await adminApi.userUpdate(u.id, { appPerms: permForm.value }); permShow.value = false; toast.success('权限已更新'); await loadAll() } catch (e: any) { toast.error(e.message) } finally { savingPerms.value = false }
}

// ---- 用户组对话框 ----
export const groupShow = ref(false)
export const editGroup = ref<any>({})
export const emptyGroup = { name: '', quotaMB: 10240, allowShare: true, allowWebdav: true, allowArchive: true, allowOffline: false, shareAllowDownload: true, readOnly: false, downloadSpeedKB: 0, recycleRetentionDays: 0, keepVersions: 10, versionRetentionDays: 0, appPerms: {}, remark: '' }
export const savingGroup = ref(false)
export async function saveGroup() {
  if (savingGroup.value) return // 保存中防重：远端 DB 慢响应时连点会打出多个重复写请求
  savingGroup.value = true
  try {
    await adminApi.groupSave({ ...editGroup.value, allowedPolicyIds: editGroup.value.allowedPolicyIds || '' })
    groupShow.value = false
    toast.success('已保存')
    loadAll()
  } catch (e: any) { toast.error(e.message) } finally { savingGroup.value = false }
}

// ---- 存储策略对话框 ----
export const policyShow = ref(false)
export const editPolicy = ref<any>({})
export const emptyPolicy = { type: 'local', name: '', letter: '', rootPath: '', quotaGB: 0 }
export const pOpts = ref<Record<string, string>>({})
export const authMsg = ref('')

// ---- 页签切换与载入 ----
export function switchTab(id: string) {
  tab.value = id
  if (id === 'tasks') loadTasks()
  if (id === 'notify') loadNotif()
  if (id === 'settings') loadDsList()
  if (id === 'update') {
    loadUpdStatus(); loadUpdHistory()
    loadUpdStatus().then(() => { if (['downloading', 'replacing'].includes(updStatus.value.status)) startUpdPoll() })
  } else stopUpdPoll()
  if (id === 'dash') startSysPoll(); else stopSysPoll()
}

// 单飞合并：保存/操作后多处都会触发 loadAll（9 路并发 GET），
// 远端 DB 慢时连点保存会打出多倍重复请求、界面数据反复回跳——同一时刻只允许一轮
let loadAllInflight: Promise<void> | null = null
export async function loadAll() {
  if (loadAllInflight) return loadAllInflight
  loadAllInflight = (async () => {
    try {
      dash.value = await adminApi.dashboard()
      users.value = (await adminApi.users(1, 100)).items
      groups.value = await adminApi.groups()
      appDefs.value = await appsApi.list()
      policies.value = await adminApi.policies()
      settings.value = await adminApi.settings()
      if (!settings.value.video_transcode) settings.value.video_transcode = 'off'
      allShares.value = (await adminApi.shares(1, 100)).items
      allUserShares.value = (await adminApi.userShares(1, 200)).items
      tasks.value = await adminApi.tasks()
      await loadLogs()
    } catch (e: any) { console.warn(e) }
  })().finally(() => { loadAllInflight = null })
  return loadAllInflight
}
export async function loadTasks() { try { tasks.value = await adminApi.tasks() } catch { /* ignore */ } }
export async function loadLogs() {
  try {
    const d = await adminApi.logs(logPage.value, 20, logKw.value.trim())
    logs.value = d.items
    logTotal.value = d.total
  } catch { /* ignore */ }
}
export async function loadNotif() {
  try {
    const d = await adminApi.notifications(notifPage.value, 20, notifKw.value.trim(), notifClearedOnly.value)
    notifList.value = d.items
    notifTotal.value = d.total
  } catch { /* ignore */ }
}
export function exportLogs() {
  window.open(adminApi.logsExport(logKw.value.trim()), '_blank')
}

// id 允许缺省：配额对话框里传的是 quotaUser?.groupId（可能为 undefined），此时返回 undefined 渲染空白
// —— 与拆分前一致（原实现同样如此，只是非严格模式下 TS 不报错）
export function groupName(id?: number) { return groups.value.find(g => g.id === id)?.name || id }

// ---- 用户增删改 ----
export async function createUser() {
  try { await adminApi.userCreate(userForm.value); userShow.value = false; await loadAll() } catch (e: any) { toast.error(e.message) }
}
export async function toggleUser(u: AdminUser) {
  try { await adminApi.userUpdate(u.id, { disabled: !u.disabled }); loadAll() } catch (e: any) { toast.error(e.message) }
}
export async function resetPwd(u: AdminUser) {
  const pwd = await uiDlg.prompt(`重置 ${u.username} 的密码`, '', '重置')
  if (!pwd) return
  try { await adminApi.userResetPwd(u.id, pwd); toast.success('密码已重置') } catch (e: any) { toast.error(e.message) }
}
export async function delUser(u: AdminUser) {
  if (!(await uiDlg.confirm('删除用户', `确定删除用户 ${u.username}？其登录将立即失效。`, { danger: true, okText: '删除' }))) return
  try { await adminApi.userDelete(u.id); loadAll() } catch (e: any) { toast.error(e.message) }
}

// ---- 用户组 ----
export function openNewUser() { userForm.value = { ...emptyUser }; userShow.value = true }
export function openNewGroup() { editGroup.value = { ...emptyGroup }; groupShow.value = true }
// 编辑用深拷贝：否则 appPerms 三态开关会直接改到列表数据上
export function openEditGroup(g: UserGroup) { editGroup.value = JSON.parse(JSON.stringify(g)); groupShow.value = true }

export async function delGroup(g: UserGroup) {
  if (!confirm(`删除用户组 ${g.name}？`)) return
  try { await adminApi.groupDelete(g.id); loadAll() } catch (e: any) { toast.error(e.message) }
}

// ---- 存储策略 ----
export async function editPolicyRow(p: AdminPolicyRow) {
  editPolicy.value = {
    id: p.id, name: p.name, letter: p.letter, type: p.type, rootPath: p.rootPath,
    quotaGB: p.quotaBytes > 0 ? p.quotaBytes / (1 << 30) : 0
  }
  pOpts.value = { ...(p.options || {}) }
  stopQr()
  policyShow.value = true
}
export function newPolicy() {
  editPolicy.value = { ...emptyPolicy }
  pOpts.value = {}
  stopQr()
  policyShow.value = true
}
export async function checkPolicy(p: AdminPolicyRow) {
  try {
    const { get } = await import('../../api/http')
    const st = await get<{ ok: boolean; msg?: string; used?: number; total?: number }>(`/cloud/status?policyId=${p.id}`)
    if (st.ok) {
      // 本地策略无配额信息：直接展示 msg（"本地存储"），避免出现"已用 -"
      const detail = st.used || st.total
        ? `已用 ${fmt(st.used || 0)}${st.total ? ' / 总量 ' + fmt(st.total) : ''}`
        : (st.msg || '正常')
      await uiDlg.alert('测通结果', `连通正常！${detail}`)
    } else await uiDlg.alert('测通失败', st.msg || '未知错误')
  } catch (e: any) { toast.error(e.message) }
}
export async function togglePolicy(p: AdminPolicyRow) {
  try { await adminApi.policyToggle(p.id, p.status === 'disabled' ? 'active' : 'disabled'); loadAll() } catch (e: any) { toast.error(e.message) }
}
export async function delPolicy(p: AdminPolicyRow) {
  if (!confirm(`卸载存储 ${p.name}？（不会删除磁盘上的文件）`)) return
  try { await adminApi.policyDelete(p.id); loadAll() } catch (e: any) { toast.error(e.message) }
}
export async function savePolicy(silent = false) {
  const d: any = { ...editPolicy.value, options: pOpts.value }
  if (editPolicy.value.id) await adminApi.policyUpdate(editPolicy.value.id, d)
  else {
    const p = await adminApi.policyCreate(d)
    editPolicy.value.id = p.id
  }
  if (!silent) { closePolicy(); loadAll() }
}
export async function createPolicy() {
  try { await savePolicy() } catch (e: any) { toast.error(e.message) }
}

// ---- 云盘扫码绑定：渲染厂商授权页二维码（带签名 state），轮询 /cloud/status 直到回调完成 ----
export const qrUrl = ref('')
export const qrImg = ref('')
let authPoll: ReturnType<typeof setInterval> | null = null

export async function startAuth(codeMode = false) {
  authMsg.value = ''
  qrImg.value = ''
  stopAuthPoll()
  try {
    const { get, post } = await import('../../api/http')
    await savePolicy(true)
    // codeMode：手机完全不可达本站时的回退——oob 授权页直接显示授权码，人工粘贴
    const r = await get<{ url: string; mode: string }>(`/cloud/auth-url?policyId=${editPolicy.value.id}${codeMode ? '&mode=code' : ''}`)
    if (!r.url) { authMsg.value = '该类型无需跳转授权'; return }
    if (r.mode === 'qr' && !codeMode) {
      // 扫码绑定：二维码即厂商授权页（redirect 回 /api/cloud/callback），手机扫码→授权→自动回填
      qrUrl.value = r.url
      qrImg.value = await QRCode.toDataURL(r.url, { width: 180, margin: 1, errorCorrectionLevel: 'M' })
      authMsg.value = '正在等待扫码授权… 用云盘 App / 手机浏览器扫描二维码并确认授权（手机需能访问本站「公开地址」）。'
      pollAuth()
    } else {
      // 回退：授权码粘贴模式（站点公开地址不可达时使用）
      window.open(r.url, '_blank')
      const code = prompt('完成授权登录后，把页面上的授权码(code)粘贴到这里：')
      if (!code) return
      await post('/cloud/exchange', { policyId: editPolicy.value.id, type: editPolicy.value.type, code })
      authMsg.value = '授权成功！'
      loadAll()
    }
  } catch (e: any) { authMsg.value = e.message }
}
function pollAuth() {
  stopAuthPoll()
  authPoll = setInterval(async () => {
    try {
      const { get } = await import('../../api/http')
      const st = await get<{ ok: boolean; msg?: string }>(`/cloud/status?policyId=${editPolicy.value.id}`)
      if (!st.ok) return // 尚未绑定（缺 token 时 status 报"需要 refresh_token…"）
      stopAuthPoll()
      qrImg.value = ''
      authMsg.value = '授权成功！'
      // 拉取最新 options 回填 token 字段
      const list = await get<AdminPolicyRow[]>('/admin/policies')
      const p = (list || []).find((x: AdminPolicyRow) => x.id === editPolicy.value.id)
      if (p) pOpts.value = { ...(p.options || {}) }
      toast.success('云盘绑定成功')
      loadAll()
    } catch { /* 轮询中的网络抖动忽略 */ }
  }, 2500)
}
export function stopAuthPoll() { if (authPoll) { clearInterval(authPoll); authPoll = null } }
export function stopQr() { stopAuthPoll(); qrImg.value = ''; authMsg.value = '' }
export function closePolicy() { stopQr(); policyShow.value = false }

// ---- 转码探测 / 站点设置 / ONLYOFFICE ----
export const tcProbing = ref(false)
export const tcInfo = ref('')
export async function probeTranscode() {
  tcProbing.value = true
  try {
    const r = await adminApi.transcodeProbe()
    tcInfo.value = r.ffmpeg
      ? `ffmpeg ${r.version}｜可用编码器: ${r.working.length ? r.working.join(', ') : '无'}`
      : '未检测到 ffmpeg'
  } catch (e: any) { tcInfo.value = '检测失败: ' + (e.message || e) }
  finally { tcProbing.value = false }
}
export async function saveSettings() {
  try {
    await adminApi.settingsSet(settings.value)
    await session.loadSite()
    toast.success('设置已保存')
  } catch (e: any) { toast.error(e.message) }
}
// ONLYOFFICE 连接探测：先确保当前填写的地址已保存，再由服务端 /healthcheck
export const officeTesting = ref(false)
export const officeTestMsg = ref('')
export const officeTestOk = ref(false)
export async function testOffice() {
  if (!settings.value.onlyoffice_url) { toast.error('请先填写 Document Server 地址并保存'); return }
  officeTesting.value = true
  officeTestMsg.value = ''
  try {
    // 未保存的地址探测不到：先落库再测
    await adminApi.settingsSet(settings.value)
    const r = await adminApi.officeTest()
    officeTestOk.value = r.ok
    officeTestMsg.value = r.msg
  } catch (e: any) {
    officeTestOk.value = false
    officeTestMsg.value = e.message || '探测失败'
  } finally {
    officeTesting.value = false
  }
}

// ---- 分享 / 站内共享审计 ----
export async function adminDelShare(s: AdminShare) {
  if (!(await uiDlg.confirm('取消分享', `取消分享「${s.name}」？外链将立即失效。`, { danger: true, okText: '取消分享' }))) return
  try { await adminApi.shareDelete(s.id); loadAll() } catch (e: any) { toast.error(e.message) }
}
export async function loadUserShares() {
  try {
    allUserShares.value = (await adminApi.userShares(1, 200, userShareKw.value.trim())).items
  } catch (e: any) { toast.error(e.message) }
}
export async function adminDelUserShare(s: AdminUserShare) {
  if (!(await uiDlg.confirm('取消共享', `取消共享「${s.name}」给 ${s.targetName}？对方将立即无法再访问该目录。`, { danger: true, okText: '取消共享' }))) return
  try { await adminApi.userShareDelete(s.id); loadUserShares() } catch (e: any) { toast.error(e.message) }
}

// ---- 多 Document Server（健康检查 + 故障切换）----
export const dsList = ref<any[]>([])
export const dsSaving = ref(false)
export async function loadDsList() {
  try {
    const d = await adminApi.officeDses()
    dsList.value = (d.list || []).map((x: any) => ({ name: x.name, url: x.url, jwt: x.jwt, priority: x.priority, _healthy: !!x.healthy, _checked: true, _active: !!x.active }))
  } catch { dsList.value = [] }
}
export async function saveDsList() {
  const list = dsList.value
    .filter((d: any) => (d.url || '').trim())
    .map((d: any) => ({ name: d.name || '', url: d.url.trim().replace(/\/+$/, ''), jwt: d.jwt || '', priority: Number(d.priority) || 0 }))
  dsSaving.value = true
  try {
    await adminApi.officeDsesSave(list)
    toast.success('DS 列表已保存（已立即探测一次）')
    await loadDsList()
  } catch (e: any) { toast.error(e.message) }
  finally { dsSaving.value = false }
}
export async function testDsRow(d: any) {
  if (!d.url) { toast.error('请先填写地址'); return }
  try {
    const r = await adminApi.officeTest(d.url.trim().replace(/\/+$/, ''))
    toast[r.ok ? 'success' : 'error'](r.msg)
  } catch (e: any) { toast.error(e.message) }
}
