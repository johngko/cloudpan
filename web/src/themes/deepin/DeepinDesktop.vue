<template>
  <div class="desktop" :class="wallpaperClass(session.wallpaper)"
    @mousedown="onDeskDown" @contextmenu.prevent="onDeskCtx">
    <div class="desktop-icons">
      <div v-for="ic in icons" :key="ic.id" class="desk-icon" :class="{ selected: sel === ic.id }" draggable="true"
        @mousedown.stop="sel = ic.id" @pointerup="onIconUp(ic, $event)" @dblclick="onIconDblClick(ic)" @contextmenu.stop.prevent="onIconCtx(ic, $event)"
        @dragstart="dragStart(ic, $event)" @dragover.prevent @drop.prevent="drop(ic)">
        <div class="ico"><AppIcon :name="ic.icon" :size="44" /></div>
        <div class="lbl">{{ ic.name }}</div>
      </div>
    </div>

    <!-- 桌面天气卡（右上角；Deepin 无顶部面板，top=12px） -->
    <WeatherWidget />

    <!-- 窗口层 -->
    <!-- 多窗口必须用 TransitionGroup：Transition 只渲染第一个子节点，第二个窗口会被吞掉 -->
    <TransitionGroup name="win-anim">
      <DeepinWindowFrame v-for="w in store.wins" :key="w.id" :win="w" />
    </TransitionGroup>

    <DeepinDock @launcher="launcher = !launcher" />
    <DeepinLauncher v-if="launcher" @close="launcher = false" />

    <ContextMenu />
    <DialogHost />
    <AltTabSwitcher v-if="altTab" :wins="tabWins" :idx="altTabIdx" @pick="pickWin" @close="closeAltTab" />
    <DeepinLock v-if="session.locked" @unlock="session.locked = false" />
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
import DeepinWindowFrame from './DeepinWindowFrame.vue'
import DeepinDock from './DeepinDock.vue'
import WeatherWidget from '../../shell/WeatherWidget.vue'
import AltTabSwitcher from '../../shell/AltTabSwitcher.vue'
import { useShellHotkeys } from '../../shell/useShellHotkeys'
import DeepinLauncher from './DeepinLauncher.vue'
import DeepinLock from './DeepinLock.vue'
import ContextMenu from '../../shell/ContextMenu.vue'
import DialogHost from '../../shell/DialogHost.vue'
import TransferPanel from '../../shell/TransferPanel.vue'
import AppIcon from '../../components/AppIcon.vue'
import { isMobileLayout, isTouchLayout } from '../../utils/mobile'

const router = useRouter()
const session = useSession()
const store = useWindows()
const { altTab, altTabIdx, tabWins, pickWin, closeAltTab } = useShellHotkeys() // Alt+Tab 切换器 + 键盘分屏（桌面全局键位）
const transfer = useTransfer()
const ctx = useContextMenu()

const sel = ref('')
const launcher = ref(false)

interface DeskIcon { id: string; name: string; icon: string; appId: string }
const { icons, dragStart, drop } = useDesktopIcons([
  { id: 'thispc', name: '此电脑', icon: 'thispc', appId: 'explorer' },
  { id: 'recycle', name: '回收站', icon: 'recycle', appId: 'recycle' }
])
onMounted(async () => {
  window.addEventListener('cp-close-window', (e: any) => store.close(e.detail))
  if (!session.user) {
    try { await session.loadMe() } catch { router.replace('/login'); return }
  }
})
onBeforeUnmount(() => {})

// ---- 桌面图标启动：鼠标保持「双击打开」，手机布局下触屏改为「单击打开」 ----
// 触屏不处理单击会让用户以为点了没反应；同时要防住触屏的双击再启动一次
// （多开应用会被开出两个窗口）。鼠标路径完全不变。
function onIconUp(ic: DeskIcon, e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  if (isMobileLayout()) launch(ic)
}
function onIconDblClick(ic: DeskIcon) {
  // 手机布局 + 触屏：单击已启动过，这里吞掉，避免重复
  if (isMobileLayout() && isTouchLayout()) return
  launch(ic)
}

function launch(ic: DeskIcon) {
  if (ic.appId === 'recycle') { store.open('recycle'); return }
  if (ic.appId === 'explorer' || ic.appId === 'thispc') {
    store.open('explorer', { thispc: true }, { title: '此电脑', icon: 'thispc', w: 1000, h: 640 })
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
    { label: '属性', icon: 'info', onClick: () => store.open('settings') }
  ])
}

// 会话恢复
session.loadSite()
</script>
