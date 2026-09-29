// Explorer 右键/下拉菜单的纯构建器：只负责「菜单长什么样」，不碰任何 store/接口。
// 状态（是否只读、剪贴板是否有内容…）与动作回调全部由调用方传入，
// 每条菜单的显隐/禁用逻辑因此可以脱离 Vue 组件做单元测试。
import type { MenuItem } from '../../stores/ui'
import type { SortMode } from './sortEntries'

// ---- 「新建」子菜单（工具栏下拉与空白右键共用） ----

export interface NewEntriesOpts {
  mindmap: boolean
  whiteboard: boolean
  flowchart: boolean
  onNew: (kind: 'folder' | 'text' | 'mindmap' | 'whiteboard' | 'flowchart') => void
}

/** 文件夹/文本文档恒在，创意文档按系统功能开关显隐 */
export function newEntries(o: NewEntriesOpts): MenuItem[] {
  return [
    { label: '文件夹', icon: 'folder', onClick: () => o.onNew('folder') },
    { label: '文本文档', icon: 'notepad', onClick: () => o.onNew('text') },
    ...(o.mindmap ? [{ label: '思维导图', icon: 'mindmap', onClick: () => o.onNew('mindmap') }] : []),
    ...(o.whiteboard ? [{ label: '白板', icon: 'whiteboard', onClick: () => o.onNew('whiteboard') }] : []),
    ...(o.flowchart ? [{ label: '流程图', icon: 'flowchart', onClick: () => o.onNew('flowchart') }] : [])
  ]
}

// ---- 空白区右键 ----

export interface BlankMenuOpts {
  noPolicy: boolean // 未打开任何盘（盘列表页空白处）
  shared: boolean // 当前在共享盘
  writable: boolean // 共享盘可写
  readOnly: boolean // 用户组只读
  viewGrid: boolean // 当前视图（用于「查看」勾选态）
  sortMode: SortMode
  hasClip: boolean // 剪贴板是否有内容
  canOffline: boolean
  canTerminal: boolean
  newItems: MenuItem[] // 「新建」子菜单（调用方用 newEntries 生成）
  on: {
    setView: (v: 'grid' | 'list') => void
    setSort: (m: SortMode) => void
    refresh: () => void
    paste: () => void
    sharedMkdir: () => void
    sharedPickFiles: () => void
    pickFiles: () => void
    pickFolder: () => void
    offline: () => void
    terminal: () => void
    props: () => void
  }
}

const SORT_LABEL: Record<SortMode, string> = { name: '名称', size: '大小', modTime: '修改时间', type: '类型' }

function viewChildren(o: Pick<BlankMenuOpts, 'viewGrid' | 'on'>): MenuItem[] {
  return [
    { label: '大图标', checked: o.viewGrid, onClick: () => o.on.setView('grid') },
    { label: '详细信息', checked: !o.viewGrid, onClick: () => o.on.setView('list') }
  ]
}

export function blankMenu(o: BlankMenuOpts): MenuItem[] {
  // 未打开任何盘：只留查看/刷新/禁用粘贴/属性（属性进系统设置）
  if (o.noPolicy) {
    return [
      { label: '查看', icon: 'grid', children: viewChildren(o) },
      { label: '刷新', icon: 'refresh', onClick: o.on.refresh },
      { separator: true },
      { label: '粘贴', icon: 'paste', disabled: true },
      { separator: true },
      { label: '属性', icon: 'info', onClick: o.on.props }
    ]
  }
  const menu: MenuItem[] = [
    { label: '查看', icon: 'grid', children: viewChildren(o) },
    {
      label: '排序方式', icon: 'list',
      children: (['name', 'size', 'modTime', 'type'] as const).map(m => ({
        label: SORT_LABEL[m], checked: o.sortMode === m, onClick: () => o.on.setSort(m)
      }))
    },
    { label: '刷新', icon: 'refresh', onClick: o.on.refresh },
    { separator: true }
  ]
  if (o.shared) {
    // 共享盘空白处：可写才有新建/上传入口；只读共享到分隔线为止
    if (o.writable) {
      menu.push(
        { label: '新建文件夹', icon: 'folder', onClick: o.on.sharedMkdir },
        { label: '上传文件…', icon: 'upload', onClick: o.on.sharedPickFiles },
        { separator: true }
      )
    }
    return menu
  }
  menu.push(
    { label: '粘贴', icon: 'paste', onClick: o.on.paste, disabled: !o.hasClip || o.readOnly },
    { separator: true },
    { label: '新建', icon: 'plus', disabled: o.readOnly, children: o.newItems },
    {
      label: '上传', icon: 'upload', disabled: o.readOnly, children: [
        { label: '上传文件…', icon: 'upload', onClick: o.on.pickFiles },
        { label: '上传文件夹…', icon: 'folder', onClick: o.on.pickFolder }
      ]
    },
    ...(o.canOffline ? [{ label: '离线下载到此', icon: 'cloud', onClick: o.on.offline }] as MenuItem[] : []),
    ...(o.canTerminal ? [{ label: '在终端中打开', icon: 'terminal', onClick: o.on.terminal }] as MenuItem[] : []),
    { separator: true },
    { label: '属性', icon: 'info', onClick: o.on.props }
  )
  return menu
}

// ---- 文件/文件夹条目右键 ----

/** 条目菜单需要的最小字段（FileItem 的结构子集） */
export interface ItemMenuTarget {
  isDir: boolean
  starred?: boolean
  path: string
  ext?: string
  name?: string
}

/** zip/常见 tar 系压缩包才能「解压到当前目录」 */
export function isExtractable(ext?: string, name?: string): boolean {
  return ext?.toLowerCase() === 'zip' || /\.(tar|tgz|tbz2|gz)$/i.test(name || '')
}

export interface ItemMenuOpts {
  f: ItemMenuTarget
  multi: boolean // 多选（>1 项）时只保留批量操作
  multiCount: number
  shared: boolean
  writable: boolean
  readOnly: boolean
  guest: boolean // 游客：收藏是共享状态，入口隐藏
  canSharePub: boolean
  canShareUser: boolean
  allowArchive: boolean // 「压缩」被组禁用时相关项整体隐藏
  hasClip: boolean
  on: {
    open: () => void
    openWith: () => MenuItem[]
    copyPath: () => void
    download: () => void
    share: () => void
    shareUser: () => void
    dlink: () => void
    toggleStar: () => void
    cut: () => void
    copy: () => void
    pasteInto: () => void
    rename: () => void
    archive: () => void
    extract: () => void
    del: () => void
    props: () => void
    sharedMkdir: () => void
  }
}

function starItem(o: ItemMenuOpts): MenuItem {
  return {
    label: o.f.starred ? '取消收藏' : '收藏到快速访问',
    icon: o.f.starred ? 'star' : 'starFill',
    onClick: o.on.toggleStar
  }
}

export function itemMenu(o: ItemMenuOpts): MenuItem[] {
  const { f } = o
  // 共享盘内：只保留 打开/路径/下载（+ 可写共享的 新建文件夹/删除）
  if (o.shared) {
    const menu: MenuItem[] = [
      { label: f.isDir ? '打开' : '预览/打开', icon: 'fwd', onClick: o.on.open },
      { label: '复制路径', icon: 'link', onClick: o.on.copyPath },
      { label: f.isDir ? '下载 (zip)' : '下载', icon: 'download', onClick: o.on.download }
    ]
    if (o.writable) {
      menu.push(
        { separator: true },
        ...(f.isDir ? [{ label: '新建文件夹', icon: 'folder', onClick: o.on.sharedMkdir }] as MenuItem[] : []),
        { label: '删除', icon: 'trash', danger: true, onClick: o.on.del }
      )
    }
    return menu
  }

  if (o.multi) {
    // 多选（Windows：只保留批量操作）
    return [
      { label: `下载 ${o.multiCount} 项`, icon: 'download', onClick: o.on.download },
      { label: '剪切', icon: 'cut', onClick: o.on.cut, disabled: o.readOnly },
      { label: '复制', icon: 'copy', onClick: o.on.copy, disabled: o.readOnly },
      { separator: true },
      ...(o.allowArchive ? [{ label: '压缩打包', icon: 'archive', onClick: o.on.archive, disabled: o.readOnly }] as MenuItem[] : []),
      { label: '删除', icon: 'trash', danger: true, onClick: o.on.del, disabled: o.readOnly },
      { separator: true },
      { label: '属性', icon: 'info', onClick: o.on.props }
    ]
  }

  const ops: MenuItem[] = [
    { label: '剪切', icon: 'cut', onClick: o.on.cut, disabled: o.readOnly },
    { label: '复制', icon: 'copy', onClick: o.on.copy, disabled: o.readOnly }
  ]
  const del: MenuItem = { label: '删除', icon: 'trash', danger: true, onClick: o.on.del, disabled: o.readOnly }
  const archive: MenuItem[] = o.allowArchive
    ? [{ label: '压缩打包', icon: 'archive', onClick: o.on.archive, disabled: o.readOnly }]
    : []
  const star: MenuItem[] = o.guest ? [] : [starItem(o)] // 游客为共享账号：收藏是共享状态，入口隐藏（后端 GuestReadOnly 兜底）

  if (f.isDir) {
    return [
      { label: '打开', icon: 'fwd', onClick: o.on.open },
      { label: '复制路径', icon: 'link', onClick: o.on.copyPath },
      { label: '下载 (zip)', icon: 'download', onClick: o.on.download },
      ...(o.canSharePub ? [{ label: '分享', icon: 'share2', onClick: o.on.share }] as MenuItem[] : []),
      ...(o.canShareUser ? [{ label: '共享…', icon: 'user', onClick: o.on.shareUser }] as MenuItem[] : []),
      { separator: true },
      ...star,
      ...ops,
      { label: '粘贴到内部', icon: 'paste', onClick: o.on.pasteInto, disabled: !o.hasClip || o.readOnly },
      { label: '重命名', icon: 'rename', onClick: o.on.rename, disabled: o.readOnly },
      { separator: true },
      ...archive,
      del,
      { separator: true },
      { label: '属性', icon: 'info', onClick: o.on.props }
    ]
  }

  return [
    { label: '打开', icon: 'fwd', onClick: o.on.open },
    { label: '打开方式', icon: 'openwith', children: o.on.openWith() },
    { label: '复制路径', icon: 'link', onClick: o.on.copyPath },
    { label: '下载', icon: 'download', onClick: o.on.download },
    ...(o.canSharePub ? [{ label: '分享', icon: 'share', onClick: o.on.share }] as MenuItem[] : []),
    { label: '提取直链', icon: 'link', onClick: o.on.dlink },
    { separator: true },
    ...star,
    ...ops,
    { label: '重命名', icon: 'rename', onClick: o.on.rename, disabled: o.readOnly },
    { separator: true },
    ...(isExtractable(f.ext, f.name) && o.allowArchive
      ? [{ label: '解压到当前目录', icon: 'archive', onClick: o.on.extract, disabled: o.readOnly }] as MenuItem[]
      : []),
    ...archive,
    del,
    { separator: true },
    { label: '属性', icon: 'info', onClick: o.on.props }
  ]
}

// ---- 盘卡片右键 ----

export interface PolicyMenuOpts {
  isAdmin: boolean
  canShareUser: boolean
  canTerminal: boolean
  on: {
    open: () => void
    shareRoot: () => void
    terminal: () => void
    admin: () => void
  }
}

export function policyMenu(o: PolicyMenuOpts): MenuItem[] {
  const menu: MenuItem[] = [{ label: '打开', icon: 'fwd', onClick: o.on.open }]
  // 整盘共享：把该磁盘根目录（含全部子目录）共享给指定用户/组/所有人
  if (o.canShareUser) menu.push({ label: '共享整个磁盘…', icon: 'share', onClick: o.on.shareRoot })
  if (o.canTerminal) menu.push({ label: '在终端中打开', icon: 'terminal', onClick: o.on.terminal })
  if (o.isAdmin) {
    menu.push({ separator: true })
    menu.push({ label: '管理存储', icon: 'admin', onClick: o.on.admin })
  }
  return menu
}
