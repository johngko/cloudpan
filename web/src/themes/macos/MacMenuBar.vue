<template>
  <div class="mac-menubar">
    <div class="mb-left">
      <!-- logo 菜单 -->
      <div class="mb-item" @click.stop="toggle('logo', $event)" :class="{ active: open === 'logo' }">
        <AppIcon name="cloud" :size="16" class="mb-ico" />
      </div>
      <!-- 当前应用名 -->
      <div class="mb-item bold">{{ activeAppName }}</div>
      <template v-for="m in menus" :key="m.key">
        <div class="mb-item" @click.stop="toggle(m.key, $event)">{{ m.name }}</div>
      </template>
    </div>

    <div class="mb-right">
      <div class="mb-item" title="网络测速" @click.stop="openSpeedtest"><AppIcon name="wifi" :size="15" class="mb-ico" /></div>
      <div v-if="notifyAvail" class="mb-item mb-badge" title="通知" @click.stop="notify.openPanel()">
        <AppIcon name="bell" :size="15" class="mb-ico" />
        <span v-if="notify.unread" class="badge">{{ notify.unread > 99 ? '99+' : notify.unread }}</span>
      </div>
      <div class="mb-item" title="传输" @click.stop="transfer.panel()"><AppIcon name="download" :size="15" class="mb-ico" /></div>
      <div class="mb-item mb-clock" @click.stop="openSettings">{{ clock }}</div>
    </div>

    <!-- 下拉菜单 -->
    <div v-if="open && menuX >= 0" class="mb-menu" :style="{ left: menuX + 'px' }" @click.stop>
      <template v-for="(it, i) in openItems" :key="i">
        <div v-if="it.sep" class="mb-menu-sep"></div>
        <div v-else class="mb-menu-item" @click="runItem(it)">
          <span class="ci-ico" v-if="it.icon"><AppIcon :name="it.icon" :size="15" /></span>
          <span>{{ it.label }}</span>
        </div>
      </template>
    </div>
  </div>

  <!-- 通知中心面板（独立于菜单栏，保证 fixed 定位正确） -->
  <div v-if="notify.open" class="notify-panel" @click.stop>
    <div class="np-head">
      <span>通知中心</span>
      <div class="np-actions">
        <button v-if="notify.unread" class="np-all" @click="notify.markAll()">全部已读</button>
        <button v-if="notify.list.length" class="np-all np-clear" @click="notify.clear()">清除</button>
      </div>
    </div>
    <div class="np-body">
      <div v-if="!notify.list.length" class="np-empty">无新通知</div>
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
import { useWindows, type WinState } from '../../stores/windows'
import { useTransfer } from '../../stores/transfer'
import { useSession } from '../../stores/session'
import { useNotify } from '../../stores/notify'
import { useAppState } from '../../stores/appstate'
import { appDef } from '../../stores/apps'
import AppIcon from '../../components/AppIcon.vue'

const store = useWindows()
const transfer = useTransfer()
const session = useSession()
const notify = useNotify()
// 通知被管理员对该用户禁用时隐藏铃铛（与后端 AppGate 一致）
const notifyAvail = computed(() => useAppState().isAvailable('notify'))

const open = ref('')
const menuX = ref(-1)
const clock = ref('')

interface MBItem { label: string; icon?: string; sep?: boolean; onClick?: () => void }

// 聚焦窗口的应用名（无窗口时显示系统名）
const activeAppName = computed(() => {
  const w = store.wins.find(x => x.id === store.activeId && !x.minimized)
  if (!w) return 'CloudPan'
  return w.app === 'explorer' ? (w.props?.thispc ? '访达' : '访达') : (appDef(w.app)?.name || 'CloudPan')
})

const menus = [
  { key: 'file', name: '文件' },
  { key: 'view', name: '视图' },
  { key: 'window', name: '窗口' },
  { key: 'help', name: '帮助' }
]

const openItems = computed<MBItem[]>(() => {
  switch (open.value) {
    case 'logo':
      return [
        { label: '关于 CloudPan', icon: 'info', onClick: () => store.open('settings') },
        { sep: true },
        { label: '锁定屏幕', icon: 'lock', onClick: () => { session.locked = true } },
        { label: '注销…', icon: 'logout', onClick: () => { session.logout() } },
        { sep: true },
        { label: '重新启动', icon: 'refresh', onClick: () => location.reload() }
      ]
    case 'file':
      return [
        { label: '打开资源管理器', icon: 'explorer', onClick: () => store.open('explorer') },
        { label: '打开回收站', icon: 'recycle', onClick: () => store.open('recycle') },
        { sep: true },
        { label: '刷新', icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('cp-refresh-explorer')) }
      ]
    case 'view':
      // 个性化（站点主题）为管理员全局设置：非管理员（含游客）不显示入口
      return [
        { label: '刷新', icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('cp-refresh-explorer')) },
        ...(session.user?.role === 'admin' ? [{ sep: true }, { label: '个性化…', icon: 'sun', onClick: () => store.open('settings', { tab: 'person' }) }] : [])
      ]
    case 'window':
      return [
        ...store.wins.map((w: WinState) => ({
          label: w.title, icon: w.icon,
          onClick: () => store.focus(w.id)
        })),
        ...(store.wins.length ? [{ sep: true } as MBItem] : []),
        { label: '全部最小化', icon: 'min', onClick: () => store.wins.forEach(w => store.minimize(w.id)) }
      ]
    case 'help':
      return [
        { label: 'CloudPan 帮助', icon: 'info', onClick: () => store.open('settings') }
      ]
    default:
      return []
  }
})

function toggle(key: string, e: MouseEvent) {
  if (open.value === key) { closeMenu(); return }
  const el = e.currentTarget as HTMLElement
  menuX.value = Math.max(4, Math.min(el.getBoundingClientRect().left, window.innerWidth - 240))
  open.value = key
}
function closeMenu() { open.value = ''; menuX.value = -1 }
function runItem(it: MBItem) { closeMenu(); it.onClick?.() }

function openSettings() { closeMenu(); store.open('settings') }
function openSpeedtest() { closeMenu(); store.open('speedtest') }
function fmtTime(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function tick() {
  const d = new Date()
  clock.value = `${d.getMonth() + 1}月${d.getDate()}日 周${'日一二三四五六'[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
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
function onDocClick() { closeMenu(); notify.close() }
</script>
