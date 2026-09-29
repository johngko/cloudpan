// 管理控制台的纯展示逻辑：格式化与名称映射。
// 与 Vue/接口无关，可脱离组件单测（见 format.spec.ts）。
// 注意：这些函数的输出文案是既有 UI 的一部分，改文案必须同步改测试。

/** 1 TB（按二进制 2^40，与后端字节口径一致） */
export const TB = Math.pow(2, 40)

/** 容量（仪表盘「全站用量」口径）：0/空 → '-'；TB / GB / MB 三档 */
export function fmt(n: number): string {
  if (!n) return '-'
  if (n > TB) return (n / TB).toFixed(2) + ' TB'
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  return (n / (1 << 20)).toFixed(1) + ' MB'
}

/** 仅 GB 一档（仪表盘统计卡） */
export function fmtGB(n: number): string {
  if (!n) return '0'
  return (n / (1 << 30)).toFixed(1) + ' GB'
}

/** 字节（更新包体积等）：GB / MB / KB / B 四档 */
export function fmtBytes(n: number): string {
  if (!n) return '0 B'
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

/** 速率（网卡实时流量） */
export function fmtRate(n: number): string {
  if (!n) return '0 B/s'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB/s'
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB/s'
  return n + ' B/s'
}

/** 运行时长：X天Y时Z分（不足一天省略「天」） */
export function fmtUptime(s: number): string {
  if (!s) return '-'
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60)
  return (d ? d + '天' : '') + h + '时' + m + '分'
}

/** 布尔 → ✓ / ✗ */
export function yn(v: boolean): string {
  return v ? '✓' : '✗'
}

/** 存储策略类型 → 中文名 */
export function typeName(t: string): string {
  return ({
    local: '本地目录', pan123: '123云盘', aliyun: '阿里云盘',
    baidu: '百度网盘', tianyi: '天翼云盘（实验性·暂不可用）'
  } as Record<string, string>)[t] || t
}

/** 后台任务类型 → 中文名 */
export function taskTypeName(t: string): string {
  return ({
    offline: 'HTTP 离线', bt: 'BT/磁力链', compress: '压缩',
    decompress: '解压', upload: '上传', transfer: '转存'
  } as Record<string, string>)[t] || t
}

/** 任务状态 → 中文名 */
export function taskStatusName(s: string): string {
  return ({
    queued: '排队中', processing: '执行中', finished: '完成',
    error: '失败', canceled: '已取消'
  } as Record<string, string>)[s] || s
}

/** 通知类型 → 中文名 */
export function notifTypeName(t: string): string {
  return ({ task: '任务', quota: '配额', system: '系统', offline: '离线下载' } as Record<string, string>)[t] || t
}

/** 用户组卡片上的应用权限摘要（三态：键缺失=继承） */
export function permSummary(g: { appPerms?: Record<string, boolean> }): string {
  const p = g.appPerms || {}
  const vals = Object.values(p)
  const deny = vals.filter(v => v === false).length
  const allow = vals.filter(v => v === true).length
  if (!deny && !allow) return '全部默认'
  return `${allow} 允许 / ${deny} 禁止`
}

/** 用户列表「配额」列文案（quotaMB：-1 随组 / 0 不限 / >0 专属） */
export function userQuotaText(u: { quotaMB: number }): string {
  if (u.quotaMB === 0) return '不限量'
  if (u.quotaMB > 0) return `${u.quotaMB} MB（专属）`
  return '随组'
}

/** 用户配额对话框的三选一模式 */
export type QuotaMode = 'group' | 'unlimited' | 'custom'

/** 由用户当前 quotaMB 反推对话框应选中的模式 */
export function quotaModeOf(u: { quotaMB: number }): QuotaMode {
  if (u.quotaMB === 0) return 'unlimited'
  if (u.quotaMB > 0) return 'custom'
  return 'group'
}

/** 更新来源模式：后端以「update_url 是否为空」判定（update.go: latestRelease） */
export type UpdMode = 'github' | 'direct'

/**
 * 推导更新来源模式。
 * override 是「用户本次手动切换的选择」：非空时优先（否则空地址下选「直链」会被数据立即拉回
 * GitHub，表现为下拉变化但面板不跟随）；保存后应清空 override，重新以落库数据为准。
 */
export function resolveUpdMode(updateUrl: string | undefined, override: UpdMode | null = null): UpdMode {
  if (override) return override
  return updateUrl ? 'direct' : 'github'
}

/** 对话框模式 → 落库的 quotaMB（自定义值非法时按「不限量」处理，与原实现一致） */
export function quotaModeToMB(mode: QuotaMode, custom: number): number {
  if (mode === 'group') return -1
  if (mode === 'unlimited') return 0
  return Number(custom) > 0 ? Math.floor(Number(custom)) : 0
}
