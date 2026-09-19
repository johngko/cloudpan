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
      <MacWindowFrame v-for="w in store.wins" :key="w.id" :win="w" />
    </TransitionGroup>

    <MacMenuBar />
    <MacDock @launchpad="launchpad = true" />
    <MacLaunchpad v-if="launchpad" @close="launchpad = false" />

    <ContextMenu />
    <DialogHost />
    <MacLock v-if="session.locked" @unlock="session.locked = false" />
    <TransferPanel v-if="transfer.visible" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../stores/session'
import { useWindows } from '../../stores/windows'
import { useTransfer } from '../../stores/transfer'
import { useContextMenu } from '../../stores/ui'
import { useDesktopIcons } from '../../stores/apps'
import { wallpaperClass } from '../../assets/wallpapers'
import MacWindowFrame from './MacWindowFrame.vue'
import MacMenuBar from './MacMenuBar.vue'
import MacDock from './MacDock.vue'
import MacLaunchpad from './MacLaunchpad.vue'
import MacLock from './MacLock.vue'
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
const launchpad = ref(false)

interface DeskIcon { id: string; name: string; icon: string; appId: string }
const icons = useDesktopIcons([
  { id: 'thispc', name: '访达', icon: 'explorer', appId: 'explorer' },
  { id: 'recycle', name: '废纸篓', icon: 'recycle', appId: 'recycle' }
])
onMounted(async () => {
  window.addEventListener('cp-close-window', (e: any) => store.close(e.detail))
  if (!session.user) {
    try { await session.loadMe() } catch { router.replace('/login'); return }
  }
})
onBeforeUnmount(() => {})

function launch(ic: DeskIcon) {
  if (ic.appId === 'recycle') { store.open('recycle', null, { title: '废纸篓', icon: 'recycle' }); return }
  if (ic.appId === 'explorer' || ic.appId === 'thispc') {
    store.open('explorer', { thispc: true }, { title: '访达', icon: 'explorer', w: 1000, h: 640 })
    return
  }
  store.open(ic.appId)
}

function onDeskDown(e: MouseEvent) {
  if (e.button !== 0) return
  sel.value = ''
}

function onDeskCtx(e: MouseEvent) {
  // 个性化（站点主题）为管理员全局设置：非管理员（含游客）不显示入口
  const isAdmin = session.user?.role === 'admin'
  ctx.show(e.clientX, e.clientY, [
    { label: '刷新', icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('cp-refresh-explorer')) },
    ...(isAdmin ? [{ separator: true }, { label: '个性化', icon: 'sun', onClick: () => store.open('settings', { tab: 'person' }) }] : [])
  ])
}

function onIconCtx(ic: DeskIcon, e: MouseEvent) {
  sel.value = ic.id
  ctx.show(e.clientX, e.clientY, [
    { label: '打开', icon: 'fwd', onClick: () => launch(ic) },
    { separator: true },
    { label: '显示简介', icon: 'info', onClick: () => store.open('settings') }
  ])
}

// 会话恢复
session.loadSite()
</script>
