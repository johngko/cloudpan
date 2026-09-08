<template>
  <!-- win12-online #start-menu 1:1：左栏（头像+用户名+搜索+应用列表），
       右栏（文件夹快捷 + 时钟/电源 + 已固定网格 + 推荐）；右栏子块错峰入场 -->
  <div class="w12-panel w12-start show-begin" :class="{ show: shown }" @click.stop>
    <div class="w12-sml">
      <div class="w12-sml-user">
        <!-- 用户头像（1:1：紫蓝渐变人物 svg） -->
        <svg viewBox="0,0,257,344" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
          <defs>
            <linearGradient x1="351.462" y1="233.56" x2="669.496" y2="500.422" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12user-fill1"><stop offset="0" stop-color="#A964C8"/><stop offset="0.35" stop-color="#A964C8"/><stop offset="0.87" stop-color="#2D8AD5"/><stop offset="1" stop-color="#2D8AD5"/></linearGradient>
            <linearGradient x1="351.462" y1="233.56" x2="669.496" y2="500.422" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12user-fill2"><stop offset="0" stop-color="#A964C8"/><stop offset="0.35" stop-color="#A964C8"/><stop offset="0.87" stop-color="#2D8AD5"/><stop offset="1" stop-color="#2D8AD5"/></linearGradient>
          </defs>
          <g transform="translate(-382 -195)">
            <path d="M637.755 433.872C642.215 515.221 579.577 537.983 508.011 537.983 436.444 537.983 376.676 507.833 383.513 437.11 383.109 425.234 389.59 414.133 398.634 409.891 413.82 402.768 444.753 402.936 507.484 402.997 570.214 403.058 609.164 402.279 621.521 407.947 633.878 413.614 638.011 424.609 637.755 433.872Z" fill="url(#w12user-fill1)" fill-rule="evenodd"/>
            <path d="M422 285C422 235.847 461.623 196 510.5 196 559.377 196 599 235.847 599 285 599 334.153 559.377 374 510.5 374 461.623 374 422 334.153 422 285Z" fill="url(#w12user-fill2)" fill-rule="evenodd"/>
          </g>
        </svg>
      </div>
      <div class="w12-sml-name">{{ userName }}</div>

      <div class="w12-inwrap">
        <span class="w12-inico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </span>
        <input class="w12-input" placeholder="搜索应用和文件" @focus="emit('search')" />
      </div>

      <div class="w12-sml-list">
        <div class="w12-sml-sec">可用</div>
        <div v-for="a in allApps" :key="a.id" class="w12-sml-item" @click="launch(a.id)">
          <AppIcon :name="a.icon" :size="28" /><p>{{ a.name }}</p>
        </div>
      </div>
    </div>

    <div class="w12-smr">
      <!-- row1：文件夹快捷 + 时钟/电源 -->
      <div class="w12-smr-row1">
        <div class="w12-smr-folder">
          <button v-for="f in folders" :key="f.name" class="w12-smapp small enable" @click="openFolder(f)">
            <img :src="'/icons/win12/folder/' + f.icon" /><p>{{ f.name }}</p>
          </button>
        </div>
        <div class="w12-smr-tool">
          <div class="w12-smr-time">{{ time }}</div>
          <div class="w12-smr-date">{{ dateFull }}</div>
          <div class="w12-smr-pw">
            <button class="w12-smr-pwbtn" title="锁定" @click="lock">
              <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="w12-smr-pwbtn" title="注销" @click="logout">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 0 0 1.5 1.5h2.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M10 5l3 3-3 3M13 8H6.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="w12-smr-pwbtn" title="重启" @click="reboot">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.6 5.4A5 5 0 1 1 3.2 9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M3.4 2.4v3.2h3.2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 已固定 -->
      <div class="w12-pinned">
        <div class="w12-pinned-title">
          <span>已固定</span>
          <button class="w12-morebtn" @click="openAll">所有应用
            <svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="w12-pinned-apps">
          <button v-for="a in pinned" :key="a.id" class="w12-smapp enable" @click="launch(a.id)">
            <AppIcon :name="a.icon" :size="40" /><p>{{ a.name }}</p>
          </button>
        </div>
      </div>

      <!-- 推荐的项目（收藏） -->
      <div class="w12-tuijian">
        <div class="w12-tuijian-title">
          <span>推荐的项目</span>
          <button class="w12-morebtn" @click="openExplorer">更多
            <svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="w12-tuijian-apps" v-if="stars.length">
          <button v-for="s in stars.slice(0, 4)" :key="s.id" class="w12-tjobj" @click="openStar(s)">
            <img src="/icons/win12/apps/explorer/folder.svg" /><div class="tjdiv">
              <p class="t">{{ s.name }}</p><p class="s">收藏的文件夹</p>
            </div>
          </button>
        </div>
        <div v-else class="w12-tj-empty">在文件资源管理器中右键文件夹即可收藏</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSession } from '../../stores/session'
import { visibleApps } from '../../stores/apps'
import { useWindows } from '../../stores/windows'
import { fsApi } from '../../api/modules'
import AppIcon from '../../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'close'): void; (e: 'search'): void }>()
const props = defineProps<{ shown: boolean }>()
const session = useSession()
const store = useWindows()

const userName = computed(() => session.user?.nickname || session.user?.username || 'Administrator')
const allApps = computed(() => visibleApps().filter(a => a.id !== 'thispc' && a.id !== 'recycle'))
const pinned = computed(() => allApps.value.filter(a => a.pinned).slice(0, 8))
const stars = ref<any[]>([])
const time = ref('')
const dateFull = ref('')

const folders = [
  { name: '文档', icon: 'docs.svg' },
  { name: '图片', icon: 'pics.svg' },
  { name: '音乐', icon: 'music.svg' }
]

function tick() {
  const d = new Date()
  time.value = d.toTimeString().slice(0, 5)
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  dateFull.value = `星期${'日一二三四五六'[d.getDay()]}，${y} 年 ${String(m).padStart(2, '0')} 月 ${String(day).padStart(2, '0')} 日`
}
let timer: number
onMounted(async () => {
  tick()
  timer = setInterval(tick, 10000)
  try { stars.value = await fsApi.starList() } catch {}
})
onBeforeUnmount(() => clearInterval(timer))

function launch(id: string) {
  if (id === 'explorer') store.open('explorer', null, { title: '文件资源管理器' })
  else store.open(id)
  emit('close')
}
function openFolder() { store.open('explorer', null, { title: '文件资源管理器' }); emit('close') }
function openExplorer() { store.open('explorer', null, { title: '文件资源管理器' }); emit('close') }
function openAll() { store.open('appcenter'); emit('close') }
function openStar(s: any) {
  store.open('explorer', { policyId: s.policyId, path: s.path }, { title: s.name, icon: 'explorer', w: 1000, h: 640 })
  emit('close')
}
function lock() { session.locked = true; emit('close') }
function logout() { session.logout() }
function reboot() { location.reload() }
</script>
