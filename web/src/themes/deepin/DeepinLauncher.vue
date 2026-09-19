<template>
  <!-- DDE 25 启动器：默认全屏模式（顶部搜索 + 左侧分类 + 7 列网格 + 右下用户电源） -->
  <div class="dde-launcher">
    <div class="dl-bg" :class="wallpaperClass(session.wallpaper)"></div>
    <div class="dl-veil"></div>

    <div class="dl-body">
      <div class="dl-search">
        <input ref="searchEl" class="input" placeholder="搜索应用" v-model="kw" @click.stop />
      </div>

      <div class="dl-mid">
        <div class="dl-rail">
          <div v-for="c in cats" :key="c.id" class="dl-rail-item" :class="{ active: cat === c.id }" @click="cat = c.id">
            <span class="ci-ico"><AppIcon :name="c.icon" :size="16" /></span>
            <span>{{ c.name }}</span>
          </div>
        </div>

        <div class="dl-grid">
          <div v-for="a in shown" :key="a.id" class="dl-app" @click="launch(a)">
            <span class="ico"><AppIcon :name="a.icon" :size="52" /></span>
            <span class="lbl">{{ a.name }}</span>
          </div>
          <div v-if="!shown.length" style="grid-column: 1 / -1; color: rgba(255,255,255,0.7); font-size: 14px; padding: 40px; text-align: center">
            没有匹配「{{ kw }}」的应用
          </div>
        </div>
      </div>

      <div class="dl-foot">
        <div class="dl-ver">
          <AppIcon name="cloud" :size="18" style="vertical-align: -4px" />
          CloudPan 25
        </div>
        <div class="dl-user">
          <div class="uinfo" title="账户">
            <div class="avatar">{{ initial }}</div>
            <div class="uname">{{ session.user?.nickname || session.user?.username }}</div>
          </div>
          <div class="dl-power">
            <button class="dl-pbtn" title="锁定" @click="lock"><AppIcon name="lock" :size="17" /></button>
            <button class="dl-pbtn" title="注销" @click="logout"><AppIcon name="logout" :size="17" /></button>
            <button class="dl-pbtn" title="重新启动" @click="reboot"><AppIcon name="refresh" :size="17" /></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useSession } from '../../stores/session'
import { visibleApps, type AppDef } from '../../stores/apps'
import { useWindows } from '../../stores/windows'
import { wallpaperClass } from '../../assets/wallpapers'
import AppIcon from '../../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const session = useSession()
const store = useWindows()

const TRASH: AppDef = { id: 'recycle', name: '回收站', icon: 'recycle', w: 960, h: 600 }
const kw = ref('')
const cat = ref('all')
const searchEl = ref<HTMLInputElement>()

const allApps = computed(() => [...visibleApps(), TRASH])
// 左侧分类（DDE AppListView 的收藏/全部/分类的简化映射）
const cats = [
  { id: 'all', name: '全部应用', icon: 'grid' },
  { id: 'pinned', name: '收藏', icon: 'starFill' },
  { id: 'office', name: '办公', icon: 'office' },
  { id: 'media', name: '影音', icon: 'media' },
  { id: 'system', name: '系统工具', icon: 'settings' }
]
const catIds: Record<string, string[]> = {
  office: ['officeeditor', 'notepad', 'explorer'],
  media: ['mediacenter', 'mediaviewer', 'picasa', 'music'],
  system: ['settings', 'terminal', 'calculator', 'admin', 'appcenter', 'shared', 'recycle']
}
const shown = computed(() => {
  let list = allApps.value.filter(a => a.id !== 'thispc')
  if (cat.value === 'pinned') list = list.filter(a => a.pinned)
  else if (catIds[cat.value]) list = list.filter(a => catIds[cat.value].includes(a.id))
  if (kw.value) list = list.filter(a => a.name.includes(kw.value))
  return list
})
const initial = computed(() => (session.user?.nickname || session.user?.username || 'C').charAt(0).toUpperCase())

function launch(a: AppDef) {
  if (a.id === 'recycle') store.open('recycle')
  else if (a.id === 'explorer') store.open('explorer', { thispc: true }, { title: '此电脑', icon: 'thispc', w: 1000, h: 640 })
  else store.open(a.id)
  emit('close')
}
function lock() { session.locked = true; emit('close') }
function logout() { session.logout(); emit('close') }
function reboot() { location.reload() }

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  document.addEventListener('keydown', onKey)
  nextTick(() => searchEl.value?.focus())
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
