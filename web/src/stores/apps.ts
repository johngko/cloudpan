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
  { id: 'speedtest', name: '网络测速', icon: 'speedtest', w: 480, h: 640, desktop: true, pinned: true, feature: 'speedtest' },
  { id: 'browser', name: '浏览器', icon: 'browser', w: 1100, h: 700, desktop: true, pinned: true, feature: 'browser' },
  // imageviewer（图片查看器）已下线：图片打开统一走 picasa
  { id: 'mediaviewer', name: '媒体播放器', icon: 'media', w: 880, h: 580 },
  { id: 'officeeditor', name: 'Office 编辑器', icon: 'office', w: 1100, h: 720, feature: 'office' },
  { id: 'archiveviewer', name: '压缩包浏览器', icon: 'archive', w: 1000, h: 620, feature: 'archive_view' },
  // 创意文档五件套（系统功能：管理员开关 + 组分配，不可自装）
  { id: 'mindmap', name: '思维导图', icon: 'mindmap', w: 1080, h: 700, feature: 'mindmap' },
  { id: 'whiteboard', name: '白板', icon: 'whiteboard', w: 1080, h: 700, feature: 'whiteboard' },
  { id: 'flowchart', name: '流程图', icon: 'flowchart', w: 1080, h: 700, feature: 'flowchart' },
  { id: 'imageeditor', name: '图片编辑器', icon: 'imageedit', w: 980, h: 660, feature: 'image_editor' },
  { id: 'pdfreader', name: 'PDF 阅读器', icon: 'pdfreader', w: 1080, h: 700, feature: 'pdf_reader' },
  // v9os 商店移植 webapps（自包含静态应用，容器 = WebAppHost，见 docs/DOCS-v9os应用移植.md）
  { id: 'musicplayer', name: '音乐播放器', icon: 'media', w: 920, h: 620, feature: 'music_player' },
  { id: 'picasa', name: 'Picasa 图片预览', icon: 'image', w: 980, h: 660, feature: 'picasa' },
  // 批次 2 移植：epub 阅读器 / ace 多功能编辑器 / SVG 编辑器 / EML 查看器
  { id: 'epubreader', name: 'Epub 电子书阅读器', icon: 'book', w: 1000, h: 700, feature: 'epub_reader' },
  { id: 'codeeditor', name: '多功能编辑器', icon: 'code', w: 1100, h: 720, feature: 'code_editor' },
  { id: 'svgeditor', name: 'SVG 编辑器', icon: 'vector', w: 1100, h: 720, feature: 'svg_editor' },
  { id: 'emlviewer', name: 'EML 查看器', icon: 'mail', w: 1000, h: 700, feature: 'eml_viewer' },
  // 批次 3 移植：在线PS（photopea，完整 vendored）。birdpaper（小鸟壁纸）已下线：
  // 与壁纸中心功能重复且依赖第三方公开 API，壁纸获取统一走壁纸中心
  { id: 'photopea', name: '在线PS', icon: 'ps', w: 1240, h: 780, feature: 'photopea' },
  { id: 'cadviewer', name: 'CAD 看图', icon: 'cad', w: 1200, h: 780, feature: 'cad_viewer' },
  { id: 'mediacenter', name: '媒体中心', icon: 'mediacenter', w: 1080, h: 680, desktop: true, installable: true },
  // 统一任务中心：聚合「上传/秒传任务（本机 transfer 队列）」与「离线下载（服务端任务队列）」
  { id: 'tasks', name: '任务中心', icon: 'tasks', w: 780, h: 580, desktop: true, pinned: true },
  // 壁纸中心：内置目录 + 管理员目录 + 我的壁纸（URL），支持定时自动轮换
  { id: 'wallpapers', name: '壁纸中心', icon: 'wallpapers', w: 860, h: 600, desktop: true, pinned: true },
  // 图库：按月份分组的照片墙（递归收集 + 缩略图缓存），点击进图片查看器灯箱
  { id: 'photos', name: '图库', icon: 'gallery', w: 1000, h: 660, desktop: true, installable: true },
  { id: 'shared', name: '来自他人的共享', icon: 'share', w: 900, h: 600, pinned: true, feature: 'usershare' },
  // 我的共享：查看/管理自己创建的链接分享（/api/shares）与内部共享（/api/usershares）
  // 无 feature 门控——双页签各自按 share/usershare 功能可用性独立显示
  { id: 'myshares', name: '我的共享', icon: 'share', w: 980, h: 620, pinned: true },
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
  // 管理员桌面/开始菜单/Dock/Launchpad 显示全部应用：
  // 不受全局开关、组/个人权限、安装态影响（管理员是这些设置的设定者，后端 AppAllowed 同样对管理员全放行）
  if (isAdmin) return APPS
  return APPS.filter(a =>
    (!a.adminOnly) &&
    // 全局停用 或 当前用户（组/个人）无权限 的应用从所有入口隐藏（桌面/开始菜单/Dock/Launchpad）
    (!a.feature || apps.isAvailable(a.feature)) &&
    // 可安装应用：仅当用户已安装时出现在桌面/Dock/Launchpad/开始菜单
    (!a.installable || apps.isInstalled(a.id))
  )
}

/** 应用中心「我的应用」分区展示的可安装应用 */
export function installableApps() {
  return APPS.filter(a => a.installable)
}

// 当前用户能否使用离线下载（与后端一致：offline_http/bt 任一功能可用 且 用户组启用）
// 无权限时所有入口（设置页签/资源管理器右键/搜索面板）整体隐藏
export function canUseOffline(): boolean {
  const s = useSession()
  const apps = useAppState()
  return (apps.isAvailable('offline_http') || apps.isAvailable('bt')) && !!s.group?.allowOffline
}

export interface DesktopAppIcon { id: string; name: string; icon: string; appId: string }

/**
 * 桌面图标（三个主题桌面共用）：
 * base = 主题自有的固定图标（此电脑/回收站，名称随主题语言）；
 * 动态部分 = 全部可见应用（visibleApps()：管理员全量，普通用户按权限），
 * 随「可安装应用安装态」与「系统功能开关」响应式增删（安装/卸载立即生效，无需重挂桌面）。
 */
export function useDesktopIcons(base: DesktopAppIcon[]): Ref<DesktopAppIcon[]> {
  const apps = useAppState()
  const session = useSession()
  const icons = ref<DesktopAppIcon[]>([...base])
  const sync = () => {
    const baseIds = new Set(base.map(b => b.id))
    const dyn = visibleApps()
      .filter(a => !baseIds.has(a.id))
      .map(a => ({ id: a.id, name: a.name, icon: a.icon, appId: a.id }))
    icons.value = [...base, ...dyn]
  }
  sync()
  // session.user 异步加载——adminOnly 应用（如管理控制台）必须等角色到位后再补同步；
  // allowed 随 /apps 加载到位后补同步（权限变更导致的应用显隐）；
  // loaded 翻转（未决→已决）保证 /apps 返回的瞬间图标按真实权限收敛
  watch([() => apps.loaded, () => apps.installed, () => apps.enabled, () => apps.allowed, () => session.user?.role], sync)
  return icons
}
