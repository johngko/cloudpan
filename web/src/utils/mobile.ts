// 手机布局判定的共享基础。
//
// 设计：<html data-mobile> 是**唯一事实来源**——
//   · CSS 用 [data-mobile] 作用域（见 assets/mobile.css）
//   · 命令式代码（开窗、事件处理）用 isMobileLayout() 读它，不必依赖 Pinia 实例
//   · 需要响应式的组件用 stores/viewport 的 mobile
// 纯函数（resolveMobile/parseOverride）在此便于单测。

/** 用户的布局偏好：auto=跟随窄屏判定，on=强制手机布局，off=强制桌面布局 */
export type MobileOverride = 'auto' | 'on' | 'off'

/** 窄屏判定结果 + 偏好 → 是否启用手机布局 */
export function resolveMobile(override: MobileOverride, narrow: boolean): boolean {
  if (override === 'on') return true
  if (override === 'off') return false
  return narrow
}

/** 解析用户设置 KV 里存的偏好（非法值一律回退 auto） */
export function parseOverride(raw: string | undefined): MobileOverride {
  if (!raw) return 'auto'
  try {
    const v = JSON.parse(raw)
    return v === 'on' || v === 'off' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** 当前是否处于手机布局（读 <html data-mobile>，由 stores/viewport 维护） */
export function isMobileLayout(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-mobile')
}

/** 当前是否触屏设备（读 <html data-touch>），用于交互分流 */
export function isTouchLayout(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-touch')
}
