// 移动态开关：把"是否手机布局"这件事集中到一处，并同步到 <html> 上的标记。
//
// 为什么不用裸 @media：三套主题各自有大量同类规则，分散写媒体查询会三份重复且易漏。
// 这里统一算出布尔值 → 挂 data-mobile → 样式集中在 assets/mobile.css 一份。
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsApi } from '../api/modules'
import { resolveMobile, parseOverride, type MobileOverride } from '../utils/mobile'

const QUERY_NARROW = '(max-width: 640px)'
const QUERY_COARSE = '(pointer: coarse)'
const KV_KEY = 'mobile_layout'

export const useViewport = defineStore('viewport', () => {
  const narrow = ref(false)
  const coarse = ref(false)
  const override = ref<MobileOverride>('auto')

  /** 是否启用手机布局（偏好优先，否则跟随窄屏） */
  const mobile = computed(() => resolveMobile(override.value, narrow.value))

  /** 同步到 <html>：CSS 与命令式代码都以这两个属性为准 */
  function apply() {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    // 注意：置空字符串仍会命中 [data-mobile]，必须真正 removeAttribute
    if (mobile.value) el.setAttribute('data-mobile', '1')
    else el.removeAttribute('data-mobile')
    if (coarse.value) el.setAttribute('data-touch', '1')
    else el.removeAttribute('data-touch')
  }

  /** 订阅视口变化（旋转屏幕/改窗口大小）；测试环境无 matchMedia 时静默跳过 */
  function bindMedia() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mqNarrow = window.matchMedia(QUERY_NARROW)
    const mqCoarse = window.matchMedia(QUERY_COARSE)
    const sync = () => {
      narrow.value = mqNarrow.matches
      coarse.value = mqCoarse.matches
      apply()
    }
    sync()
    // 旧内核的 MediaQueryList 只有 addListener，做能力判断
    if (typeof mqNarrow.addEventListener === 'function') {
      mqNarrow.addEventListener('change', sync)
      mqCoarse.addEventListener('change', sync)
    } else {
      ;(mqNarrow as any).addListener?.(sync)
      ;(mqCoarse as any).addListener?.(sync)
    }
  }

  /** 读取用户偏好；失败保持 auto（不影响判定，也不阻塞启动） */
  async function loadPref() {
    try {
      const m = await settingsApi.get([KV_KEY])
      override.value = parseOverride(m[KV_KEY])
    } catch { /* 忽略：读失败按 auto */ }
    apply()
  }

  /** 保存偏好（fire-and-forget：写失败时本次 UI 仍生效，下次加载回退服务端值） */
  async function setOverride(v: MobileOverride) {
    override.value = v
    apply()
    try { await settingsApi.set(KV_KEY, JSON.stringify(v)) } catch { /* 忽略 */ }
  }

  return { narrow, coarse, override, mobile, apply, bindMedia, loadPref, setOverride }
})
