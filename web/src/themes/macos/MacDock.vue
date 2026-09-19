<template>
  <div class="mac-dock" ref="dockEl" @mousemove="onMove" @mouseleave="onLeave">
    <!-- Launchpad -->
    <div class="dock-app" @click="$emit('launchpad')" :style="t(0)">
      <AppIcon name="grid" :size="48" class="ico" />
      <div class="tip">启动台</div>
    </div>

    <template v-for="(a, i) in dockApps" :key="a.id">
      <div class="dock-app" :class="{ bouncing: bouncing.has(a.id) }" @click="clickApp(a)" @contextmenu.prevent="quitMenu(a, $event)" :style="t(i + 1)">
        <AppIcon :name="a.icon" :size="48" class="ico" />
        <div v-if="running(a.id)" class="dot"></div>
        <div class="tip">{{ a.name }}</div>
      </div>
    </template>

    <div class="dock-sep"></div>

    <!-- 废纸篓 -->
    <div class="dock-app" @click="clickApp(TRASH)" :style="t(dockApps.length + 1)">
      <AppIcon name="recycle" :size="48" class="ico" />
      <div v-if="running('recycle')" class="dot"></div>
      <div class="tip">废纸篓</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWindows } from '../../stores/windows'
import { useSession } from '../../stores/session'
import { visibleApps, type AppDef } from '../../stores/apps'
import { useContextMenu } from '../../stores/ui'
import AppIcon from '../../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'launchpad'): void }>()
const store = useWindows()
const session = useSession()
const ctx = useContextMenu()
const dockEl = ref<HTMLElement>()

// Dock 应用：资源管理器（访达）+ 其余可见应用（thispc 为桌面快捷方式，不重复进 Dock）
const TRASH: AppDef = { id: 'recycle', name: '废纸篓', icon: 'recycle', w: 960, h: 600 }
const dockApps = computed(() =>
  visibleApps().filter(a => a.id !== 'thispc' && a.id !== 'recycle' && a.id !== 'settings')
)

function running(appId: string) {
  return store.wins.some(w => w.app === appId)
}
// 启动新应用时图标弹跳（真实 macOS Dock 行为）
const bouncing = ref<Set<string>>(new Set())
function bounce(id: string) {
  const s = new Set(bouncing.value)
  s.add(id)
  bouncing.value = s
  setTimeout(() => {
    const s2 = new Set(bouncing.value)
    s2.delete(id)
    bouncing.value = s2
  }, 1000)
}
function clickApp(a: AppDef) {
  if (a.id === 'recycle') {
    if (!running('recycle')) bounce('recycle')
    store.open('recycle', null, { title: '废纸篓', icon: 'recycle' })
    return
  }
  if (a.id === 'explorer') {
    const existing = store.wins.find(w => w.app === 'explorer' && !w.minimized)
    if (existing) store.focus(existing.id)
    else { bounce('explorer'); store.open('explorer', { thispc: true }, { title: '访达', icon: 'explorer', w: 1000, h: 640 }) }
    return
  }
  const existing = store.wins.find(w => w.app === a.id)
  if (existing) {
    if (store.activeId === existing.id && !existing.minimized) store.minimize(existing.id)
    else store.focus(existing.id)
  } else { bounce(a.id); store.open(a.id) }
}
function quitMenu(a: AppDef, e: MouseEvent) {
  ctx.show(e.clientX, e.clientY, [
    { label: a.name, icon: a.icon, onClick: () => clickApp(a) },
    { separator: true },
    { label: '退出', icon: 'close', danger: true, onClick: () => {
      store.wins.filter(w => w.app === a.id).forEach(w => store.close(w.id))
    } }
  ])
}

// ---- 放大效果：高斯衰减缩放（transform 由内联样式驱动） ----
const sigma = 64
const lift = 22
const scales = ref<number[]>([])
function t(i: number) {
  const s = scales.value[i] ?? 1
  if (!s || s <= 1.001) return {}
  return { transform: `translateY(-${((s - 1) * lift).toFixed(1)}px) scale(${s.toFixed(3)})` }
}
function onMove(e: MouseEvent) {
  const el = dockEl.value
  if (!el) return
  const apps = el.querySelectorAll('.dock-app')
  const next: number[] = []
  apps.forEach((a, i) => {
    const r = (a as HTMLElement).getBoundingClientRect()
    const d = Math.abs(e.clientX - (r.left + r.width / 2))
    next[i] = 1 + 0.55 * Math.exp(-(d * d) / (2 * sigma * sigma))
  })
  scales.value = next
}
function onLeave() { scales.value = [] }
onMounted(() => {})
onBeforeUnmount(() => {})
</script>
