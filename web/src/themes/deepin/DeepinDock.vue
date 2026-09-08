<template>
  <!-- DDE 25：底部全宽任务栏 = 左启动器 / 中应用 / 右托盘+显示桌面 -->
  <div class="dde-taskbar">
    <!-- 左区：启动器入口 -->
    <div class="tb-launcher" title="启动器" @click="$emit('launcher')">
      <AppIcon name="grid" :size="26" class="ico" />
    </div>

    <!-- 中区：应用（居中）——类名带 dde 前缀，避免与 win.css 的 .tb-center（绝对定位）冲突 -->
    <div class="dde-tb-center">
      <template v-for="(a, i) in dockApps" :key="a.id">
        <div class="dd-app" :class="{ running: running(a.id) }" @click="clickApp(a)"
          @contextmenu.prevent="quitMenu(a, $event)">
          <AppIcon :name="a.icon" :size="30" class="ico" />
          <div v-if="running(a.id)" class="dot" :class="{ multi: winCount(a.id) > 1 }"></div>
          <div class="tip">{{ a.name }}</div>
        </div>
      </template>
      <div class="dd-sep"></div>
      <div class="dd-app" :class="{ running: running('recycle') }" @click="clickApp(TRASH)">
        <AppIcon name="recycle" :size="30" class="ico" />
        <div v-if="running('recycle')" class="dot" :class="{ multi: winCount('recycle') > 1 }"></div>
        <div class="tip">回收站</div>
      </div>
    </div>

    <!-- 右区：托盘（DDE tray：网络/通知/传输/时钟）+ 显示桌面窄条 -->
    <div class="tb-right">
      <div class="dp-item" title="网络测速" @click.stop="openSpeedtest"><AppIcon name="wifi" :size="16" class="dp-ico" /></div>
      <div class="dp-item dp-badge" title="通知" @click.stop="notify.openPanel()">
        <AppIcon name="bell" :size="16" class="dp-ico" />
        <span v-if="notify.unread" class="badge">{{ notify.unread > 99 ? '99+' : notify.unread }}</span>
      </div>
      <div class="dp-item" title="传输" @click.stop="transfer.panel()"><AppIcon name="download" :size="16" class="dp-ico" /></div>
      <div class="dp-item" title="时间"><span class="dp-clock">{{ clock }}</span></div>
      <div class="dde-showdesk" title="显示桌面" @click="minAll"></div>
    </div>
  </div>

  <!-- 通知中心（右侧贴边） -->
  <div v-if="notify.open" class="notify-panel" @click.stop>
    <div class="np-head">
      <span>通知</span>
      <div class="np-actions">
        <button v-if="notify.unread" class="np-all" @click="notify.markAll()">全部已读</button>
        <button v-if="notify.list.length" class="np-all np-clear" @click="notify.clear()">清除</button>
      </div>
    </div>
    <div class="np-body">
      <div v-if="!notify.list.length" class="np-empty">暂无通知</div>
      <div v-for="n in notify.list" :key="n.id" class="np-item" :class="{ unread: !n.read }" @click="notify.markRead(n.id)">
        <div class="np-title">
          <AppIcon :name="n.type === 'task' ? 'cloud' : n.type === 'quota' ? 'drive' : 'info'" :size="15" />
          <span>{{ n.title }}</span>
        </div>
        <div class="np-content">{{ n.content }}</div>
        <div class="np-time">{{ fmtTime(n.createdAt) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWindows } from '../../stores/windows'
import { visibleApps, type AppDef } from '../../stores/apps'
import { useTransfer } from '../../stores/transfer'
import { useNotify } from '../../stores/notify'
import { useContextMenu } from '../../stores/ui'
import AppIcon from '../../components/AppIcon.vue'

defineEmits<{ (e: 'launcher'): void }>()

const store = useWindows()
const transfer = useTransfer()
const notify = useNotify()
const ctx = useContextMenu()

const TRASH: AppDef = { id: 'recycle', name: '回收站', icon: 'recycle', w: 960, h: 600 }
const dockApps = computed(() =>
  visibleApps().filter(a => a.id !== 'thispc' && a.id !== 'recycle' && a.id !== 'settings')
)

function running(appId: string) {
  return store.wins.some(w => w.app === appId)
}
function winCount(appId: string) {
  return store.wins.filter(w => w.app === appId).length
}
function clickApp(a: AppDef) {
  if (a.id === 'recycle') { store.open('recycle'); return }
  if (a.id === 'explorer') {
    const existing = store.wins.find(w => w.app === 'explorer' && !w.minimized)
    if (existing) store.focus(existing.id)
    else store.open('explorer', { thispc: true }, { title: '此电脑', icon: 'thispc', w: 1000, h: 640 })
    return
  }
  const existing = store.wins.find(w => w.app === a.id)
  if (existing) {
    if (store.activeId === existing.id && !existing.minimized) store.minimize(existing.id)
    else store.focus(existing.id)
  } else store.open(a.id)
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
function minAll() {
  store.minimizeAll()
}
function openSettings() { store.open('settings') }
function openSpeedtest() { store.open('speedtest') }

// 托盘时钟（DDE datetime）
const clock = ref('')
function fmtTime(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function tick() { clock.value = new Date().toTimeString().slice(0, 5) }
let timer: number
onMounted(() => {
  tick(); timer = setInterval(tick, 10000)
  notify.startPolling()
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  notify.stopPolling()
  document.removeEventListener('click', onDocClick)
})
function onDocClick() { notify.close() }
</script>
