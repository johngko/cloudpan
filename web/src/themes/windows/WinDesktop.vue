<template>
  <div class="desktop" :class="wallpaperClass(session.wallpaper)"
    @mousedown="onDeskDown" @contextmenu.prevent="onDeskCtx">
    <div class="desktop-icons">
      <div v-for="ic in icons" :key="ic.id" class="desk-icon" :class="{ selected: sel === ic.id }"
        @mousedown.stop="sel = ic.id" @dblclick="launch(ic)" @contextmenu.stop.prevent="onIconCtx(ic, $event)">
        <div class="ico"><AppIcon :name="ic.icon" :size="44" /></div>
        <div class="lbl">{{ ic.name }}</div>
      </div>
    </div>

    <!-- 窗口层 -->
    <!-- 多窗口必须用 TransitionGroup：Transition 只渲染第一个子节点，第二个窗口会被吞掉 -->
    <TransitionGroup name="win-anim">
      <WinWindowFrame v-for="w in store.wins" :key="w.id" :win="w" />
    </TransitionGroup>

    <ContextMenu />
    <DialogHost />
    <WinLock v-if="session.locked" @unlock="session.locked = false" />
    <TransferPanel v-if="transfer.visible" />
    <WinTaskBar />

    <div v-if="selRect" class="sel-rect" :style="selRect"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../stores/session'
import { useWindows } from '../../stores/windows'
import { useTransfer } from '../../stores/transfer'
import { useContextMenu } from '../../stores/ui'
import { useDesktopIcons } from '../../stores/apps'
import { wallpaperClass } from '../../assets/wallpapers'
import WinWindowFrame from './WinWindowFrame.vue'
import WinTaskBar from './WinTaskBar.vue'
import WinLock from './WinLock.vue'
import ContextMenu from '../../shell/ContextMenu.vue'
import DialogHost from '../../shell/DialogHost.vue'
import TransferPanel from '../../shell/TransferPanel.vue'
import AppIcon from '../../components/AppIcon.vue'

const router = useRouter()
const session = useSession()
const store = useWindows()
const transfer = useTransfer()
const ctx = useContextMenu()

const sel = ref('')
const selRect = ref<null | { left: string; top: string; width: string; height: string }>(null)

interface DeskIcon { id: string; name: string; icon: string; appId: string }
const icons = useDesktopIcons([
  { id: 'thispc', name: '此电脑', icon: 'thispc', appId: 'explorer' },
  { id: 'recycle', name: '回收站', icon: 'recycle', appId: 'recycle' }
])
onMounted(async () => {
  window.addEventListener('cp-close-window', (e: any) => store.close(e.detail))
  if (!session.user) {
    try { await session.loadMe() } catch { router.replace('/login'); return }
  }
})

function launch(ic: DeskIcon) {
  if (ic.appId === 'recycle') { store.open('recycle', null, { title: '回收站', icon: 'recycle' }); return }
  if (ic.appId === 'explorer' || ic.appId === 'thispc') {
    store.open('explorer', { thispc: true }, { title: '此电脑', icon: 'thispc', w: 1000, h: 640 })
    return
  }
  store.open(ic.appId)
}

function onDeskDown(e: MouseEvent) {
  if (e.button !== 0) return
  sel.value = ''
  // 框选动画（简化：仅清除选择）
}

function onDeskCtx(e: MouseEvent) {
  // 演示站桌面右键：刷新 / 切换主题 / 个性化 / 关于（1:1 项目集）
  ctx.show(e.clientX, e.clientY, [
    { label: '刷新', icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('cp-refresh-explorer')) },
    { separator: true },
    { label: session.dark ? '切换为浅色主题' : '切换为深色主题', icon: 'sun', onClick: () => session.setDark(!session.dark) },
    { label: '个性化', icon: 'settings', onClick: () => store.open('settings') },
    { label: '显示桌面', icon: 'grid', onClick: () => store.minimizeAll() },
    { separator: true },
    { label: '关于 CloudPan', icon: 'info', onClick: () => store.open('settings') }
  ])
}

function onIconCtx(ic: DeskIcon, e: MouseEvent) {
  sel.value = ic.id
  ctx.show(e.clientX, e.clientY, [
    { label: '打开', icon: 'fwd', onClick: () => launch(ic) },
    { separator: true },
    { label: '属性', icon: 'info', onClick: () => store.open('settings') }
  ])
}

// 会话恢复
session.loadSite()
</script>
