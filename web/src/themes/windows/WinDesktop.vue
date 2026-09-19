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
import { useToast, useUiDialog } from '../../stores/dialog'
import { useDesktopIcons } from '../../stores/apps'
import { fsApi } from '../../api/modules'
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
const toast = useToast()
const uiDlg = useUiDialog()

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
  // 个性化（主题/深色）为管理员全局设置：非管理员（含游客）不显示这些入口
  const isAdmin = session.user?.role === 'admin'
  ctx.show(e.clientX, e.clientY, [
    { label: '刷新', icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('cp-refresh-explorer')) },
    { separator: true },
    ...(isAdmin ? [
      { label: session.dark ? '切换为浅色主题' : '切换为深色主题', icon: 'sun', onClick: () => session.setDark(!session.dark) },
      { label: '个性化', icon: 'settings', onClick: () => store.open('settings', { tab: 'person' }) },
    ] : []),
    { label: '显示桌面', icon: 'grid', onClick: () => store.minimizeAll() },
    { separator: true },
    { label: '关于 CloudPan', icon: 'info', onClick: () => store.open('settings', { tab: 'about' }) }
  ])
}

// 图标右键：Windows 式——回收站菜单带「清空回收站」（一键永久物理删除，空时禁用）
async function onIconCtx(ic: DeskIcon, e: MouseEvent) {
  sel.value = ic.id
  if (ic.appId === 'recycle') {
    let count = 0
    try { count = (await fsApi.recycleList()).length } catch { count = 1 /* 查询失败不禁用，确认后由清空结果兜底 */ }
    ctx.show(e.clientX, e.clientY, [
      { label: '打开', icon: 'fwd', onClick: () => launch(ic) },
      { separator: true },
      { label: '清空回收站', icon: 'trash', onClick: emptyRecycle, disabled: count === 0 }
    ])
    return
  }
  ctx.show(e.clientX, e.clientY, [
    { label: '打开', icon: 'fwd', onClick: () => launch(ic) },
    { label: '刷新', icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('cp-refresh-explorer')) },
    { separator: true },
    { label: '属性', icon: 'info', onClick: () => store.open('settings') }
  ])
}

// 一键永久清空：物理删除回收站内全部文件（含目录整树），配额同步退款；二次确认防误触
async function emptyRecycle() {
  const ok = await uiDlg.confirm('清空回收站', '将永久删除回收站内全部文件，不可恢复。', { danger: true, okText: '清空' })
  if (!ok) return
  try {
    await fsApi.recyclePurge([], true)
    toast.success('回收站已清空')
    window.dispatchEvent(new CustomEvent('cp-refresh-recycle'))
  } catch (e: any) {
    toast.error('清空失败：' + (e?.message || e))
  }
}

// 会话恢复
session.loadSite()
</script>
