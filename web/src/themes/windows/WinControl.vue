<template>
  <!-- #control 布局（350×250，3×2 磁贴 + 亮度滑杆）；
       磁贴内容改为 CloudPan 真实功能——网盘没有蓝牙/飞行模式/热点，不放假开关 -->
  <div class="w12-panel w12-ctrl show-begin" :class="{ show: shown }" :style="{ left: left + 'px' }" @click.stop>
    <div style="width: 100%">
      <div class="w12-ctrl-top">
        <div class="w12-ctrl-tile" v-for="t in tiles" :key="t.id">
          <button class="w12-ctrl-ico" :class="{ active: activeOf(t.id) }" :title="t.name" @click="act(t.id)">
            <span v-html="t.svg"></span>
          </button>
          <div class="tit">{{ t.name }}</div>
        </div>
      </div>
      <div class="w12-ctrl-bottom">
        <span class="bico">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </span>
        <div class="w12-range" ref="rangeEl" @mousedown="down($event)">
          <div class="after" :style="{ width: (bright - 0.3) / 0.9 * 100 + '%' }"></div>
          <div class="slider-btn" :style="{ left: (bright - 0.3) / 0.9 * 100 + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWindows } from '../../stores/windows'
import { useSession } from '../../stores/session'
import { useNotify } from '../../stores/notify'
import { useTransfer } from '../../stores/transfer'

const props = defineProps<{ shown: boolean; left?: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const wins = useWindows()
const session = useSession()
const notify = useNotify()
const transfer = useTransfer()

const G = (p: string) => `<svg viewBox="0 0 24 24" fill="none"><g stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</g></svg>`
// 六枚磁贴全部是真实功能：测速/通知/传输/护眼/深色/锁屏
const tiles = [
  { id: 'wifi', name: '网络测速', svg: G('<path d="M4 9.5a12 12 0 0 1 16 0"/><path d="M7 13a8 8 0 0 1 10 0"/><path d="M10 16.4a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>') },
  { id: 'notify', name: '通知中心', svg: G('<path d="M6 9.5a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>') },
  { id: 'transfer', name: '传输任务', svg: G('<path d="M12 4v9.5"/><path d="M8.2 10l3.8 3.8 3.8-3.8"/><path d="M5 19.5h14"/>') },
  { id: 'eye', name: '护眼模式', svg: G('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>') },
  { id: 'dark', name: '深色主题', svg: G('<path d="M20 13.6A8.2 8.2 0 1 1 10.4 4a6.6 6.6 0 0 0 9.6 9.6z"/>') },
  { id: 'lock', name: '锁定屏幕', svg: G('<rect x="6" y="10.8" width="12" height="9" rx="2"/><path d="M9 10.8V8.2a3 3 0 0 1 6 0v2.6"/>') }
]

// 护眼=用户态持久开关；深色/通知/传输 跟随各自真实状态高亮；测速/锁屏 是一次性动作
function initialEye(): boolean {
  const cur = localStorage.getItem('cp_w12_eye')
  if (cur !== null) return cur === '1'
  try { return !!JSON.parse(localStorage.getItem('cp_w12_ctrl') || '{}').eye } catch { return false }
}
const eye = ref(initialEye())

function activeOf(id: string): boolean {
  if (id === 'eye') return eye.value
  if (id === 'dark') return session.dark
  if (id === 'notify') return notify.open
  if (id === 'transfer') return transfer.visible
  return false
}
function act(id: string) {
  switch (id) {
    case 'wifi': wins.open('speedtest'); emit('close'); break
    case 'notify': notify.openPanel(); emit('close'); break
    case 'transfer': transfer.panel(); emit('close'); break
    case 'eye':
      eye.value = !eye.value
      localStorage.setItem('cp_w12_eye', eye.value ? '1' : '0')
      document.documentElement.style.setProperty('--w12-sepia', eye.value ? '0.25' : '0')
      break
    case 'dark': session.setDark(!session.dark); break
    case 'lock': session.locked = true; break
  }
}

// 亮度：作用于 .theme-win12 .desktop 的 filter（0.3 ~ 1.2）
const bright = ref(Math.min(1, Number(localStorage.getItem('cp_w12_bright') || '1')))
const rangeEl = ref<HTMLElement>()
document.documentElement.style.setProperty('--w12-bright', String(bright.value))

function setBright(clientX: number) {
  const el = rangeEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  bright.value = 0.3 + p * 0.9
  document.documentElement.style.setProperty('--w12-bright', bright.value.toFixed(3))
  localStorage.setItem('cp_w12_bright', bright.value.toFixed(3))
}
function down(e: MouseEvent) {
  e.preventDefault()
  setBright(e.clientX)
  const move = (ev: MouseEvent) => setBright(ev.clientX)
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

onMounted(() => {
  document.documentElement.style.setProperty('--w12-sepia', eye.value ? '0.25' : '0')
})
</script>
