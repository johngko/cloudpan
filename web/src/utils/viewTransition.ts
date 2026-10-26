import { nextTick } from 'vue'

/**
 * 用 View Transitions API 包裹一次视觉更新（B15）。
 *  - 回调里只做"产生新视觉"的状态变更（改 ref / 切 class），内部等 Vue flush 完成，
 *    浏览器拿旧页快照 → 新页快照 → 按 ::view-transition-* 动画过渡；
 *  - 不支持的浏览器（老 Safari/Firefox）退化为直接更新；
 *  - 动画时长/方向由 <html> 上的 vt-back / vt-fwd 类选择（见 base.css），调用方
 *    在回调里加类、finished 后移除。
 */
export function withViewTransition(update: () => void): Promise<void> {
  const d = document as Document & {
    startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> }
  }
  if (typeof d.startViewTransition !== 'function') { update(); return Promise.resolve() }
  return d.startViewTransition(async () => {
    update()
    await nextTick()
  }).finished.catch(() => {}) // 跳过/被新过渡打断不算错
}

/** 带滑动方向的导航过渡：dir=null 纯交叉淡化，'back'/'fwd' 顺带方向位移 */
export function vtNavigate(update: () => void, dir: 'back' | 'fwd' | null = null): Promise<void> {
  const cls = dir ? 'vt-' + dir : ''
  return withViewTransition(() => {
    if (cls) document.documentElement.classList.add(cls)
    update()
  }).finally(() => {
    if (cls) document.documentElement.classList.remove(cls)
  })
}
