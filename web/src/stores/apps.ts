import { ref, watch, type Ref } from 'vue'
import { useSession } from './session'
import { useAppState } from './appstate'

export interface AppDef {
  id: string
  name: string
  icon: string
  w: number
  h: number
  desktop?: boolean
  pinned?: boolean
  adminOnly?: boolean
  /** 关联的系统功能 key（应用中心）：功能被停用时该应用从所有入口隐藏 */
  feature?: string
  /** 可安装应用（应用中心「我的应用」）：用户自行安装/卸载，安装态存用户设置 KV */
  installable?: boolean
}

export const APPS: AppDef[] = [
  { id: 'explorer', name: '文件资源管理器', icon: 'explorer', w: 1000, h: 640, desktop: false, pinned: true },
  { id: 'thispc', name: '此电脑', icon: 'thispc', w: 1000, h: 640, desktop: true, pinned: true },
  { id: 'recycle', name: '回收站', icon: 'recycle', w: 960, h: 600, desktop: true, pinned: true },
  { id: 'notepad', name: '记事本', icon: 'notepad', w: 760, h: 560, desktop: true, pinned: true },
  { id: 'terminal', name: '终端', icon: 'terminal', w: 1040, h: 640, desktop: true, pinned: true, feature: 'terminal' },
  { id: 'calculator', name: '计算器', icon: 'calculator', w: 340, h: 500, desktop: true, pinned: true },
  { id: 'speedtest', name: '网络测速', icon: 'speedtest', w: 480, h: 640, desktop: true, pinned: true },
  { id: 'browser', name: '浏览器', icon: 'browser', w: 1100, h: 700, desktop: true, pinned: true, feature: 'browser' },
  { id: 'imageviewer', name: '图片查看器', icon: 'image', w: 880, h: 620 },
  { id: 'mediaviewer', name: '媒体播放器', icon: 'media', w: 880, h: 580 },
  { id: 'officeeditor', name: 'Office 编辑器', icon: 'office', w: 1100, h: 720, feature: 'office' },
  { id: 'mediacenter', name: '媒体中心', icon: 'media', w: 1080, h: 680, desktop: true, installable: true },
  { id: 'shared', name: '来自他人的共享', icon: 'share', w: 900, h: 600, pinned: true, feature: 'usershare' },
  { id: 'appcenter', name: '应用中心', icon: 'appstore', w: 980, h: 640, desktop: true, pinned: true, feature: 'app_center' },
  { id: 'settings', name: '设置', icon: 'settings', w: 900, h: 620, desktop: true, pinned: true },
  { id: 'admin', name: '管理控制台', icon: 'admin', w: 1060, h: 680, desktop: true, pinned: true, adminOnly: true }
]

export function appDef(id: string): AppDef | undefined {
  return APPS.find(a => a.id === id)
}

export function visibleApps() {
  const s = useSession()
  const apps = useAppState()
  const isAdmin = s.user?.role === 'admin'
  return APPS.filter(a =>
    (!a.adminOnly || isAdmin) &&
    // 全局停用 或 当前用户（组/个人）无权限 的应用从所有入口隐藏（桌面/开始菜单/Dock/Launchpad）；
    // 应用中心是功能管理入口：管理员在 app_center 被全局停用时仍须可见（否则无法再启用）
    ((!a.feature || apps.isAvailable(a.feature)) || (a.id === 'appcenter' && isAdmin)) &&
    // 可安装应用：仅当用户已安装时出现在桌面/Dock/Launchpad/开始菜单
    (!a.installable || apps.isInstalled(a.id))
  )
}

/** 应用中心「我的应用」分区展示的可安装应用 */
export function installableApps() {
  return APPS.filter(a => a.installable)
}

export interface DesktopAppIcon { id: string; name: string; icon: string; appId: string }

/**
 * 桌面图标（三个主题桌面共用）：
 * base = 主题自有的固定图标（此电脑/回收站，名称随主题语言）；
 * 动态部分 = visibleApps() 中带 desktop 标记的应用，随「可安装应用安装态」
 * 与「系统功能开关」响应式增删（安装/卸载立即生效，无需重挂桌面）。
 */
export function useDesktopIcons(base: DesktopAppIcon[]): Ref<DesktopAppIcon[]> {
  const apps = useAppState()
  const session = useSession()
  const icons = ref<DesktopAppIcon[]>([...base])
  const sync = () => {
    const baseIds = new Set(base.map(b => b.id))
    const dyn = visibleApps()
      .filter(a => a.desktop && !baseIds.has(a.id))
      .map(a => ({ id: a.id, name: a.name, icon: a.icon, appId: a.id }))
    icons.value = [...base, ...dyn]
  }
  sync()
  // session.user 异步加载——adminOnly 应用（如管理控制台）必须等角色到位后再补同步；
  // allowed 随 /apps 加载到位后补同步（权限变更导致的应用显隐）
  watch([() => apps.installed, () => apps.enabled, () => apps.allowed, () => session.user?.role], sync)
  return icons
}
