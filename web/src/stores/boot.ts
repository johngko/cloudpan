import { useSession } from './session'
import { useAppState } from './appstate'
import { getToken } from '../api/http'

// 桌面外壳数据就绪门。
//
// 背景（刷新 #/desktop 时图标"先缺后补"的权限竞态）：桌面组件挂载即渲染图标，
// 而身份(/auth/me)、功能清单(/apps)、自装应用(/settings installed_apps)是三个并行
// 异步——就绪窗口内 session.user 还是 null，visibleApps() 会把管理员误判为普通
// 用户，功能应用/自装应用全部隐藏，等响应返回后图标再逐批"长"出来。
//
// 这里提供全站唯一的身份+权限数据准备动作（并发去重、按身份缓存）：
//   - ShellHost 在进入桌面屏前 await 它，未就绪时渲染过渡幕而非桌面本体；
//   - App.vue 的身份 watcher 用它替代裸 apps.load()，避免登录后重复拉 /apps；
//   - main.ts 启动时也走它（有令牌才拉，登录页首访零请求）。
// loadedFor 记录数据对应的身份（id:role），登录/切号后自动重拉，同一身份幂等。
let inflight: Promise<boolean> | null = null
let loadedFor = ''

async function run(): Promise<boolean> {
  const session = useSession()
  if (!getToken()) return false
  try {
    if (!session.user) await session.loadMe()
  } catch {
    // 令牌无效且刷新失败：http 拦截器会把 hash 踢到 #/login，这里直接报未就绪
    return false
  }
  const apps = useAppState()
  const identity = session.user ? `${session.user.id}:${session.user.role}` : ''
  if (loadedFor === identity && apps.loaded && apps.installedLoaded) return true
  const ok = await apps.load()
  await apps.loadInstalled()
  if (!ok) return false
  loadedFor = identity
  return true
}

/** 返回 false = 无令牌或身份确认失败（调用方应跳登录页）；true = 桌面数据已就绪 */
export function ensureBootData(): Promise<boolean> {
  if (!inflight) inflight = run().finally(() => { inflight = null })
  return inflight
}

/** 同步判断：当前身份数据是否已就绪（ ShellHost 用于跳过过渡幕，避免回桌面闪一帧） */
export function isBootDataReady(): boolean {
  const session = useSession()
  if (!session.user) return false
  const apps = useAppState()
  const identity = `${session.user.id}:${session.user.role}`
  return loadedFor === identity && apps.loaded && apps.installedLoaded
}
