<template>
  <!-- #widgets：1000×600 双栏（左=时钟/日历，右=天气/存储/任务/收藏/SSH） -->
  <div class="w12-panel w12-widgets show-begin" :class="{ show: shown }" @click.stop>
    <div class="w12-wg-half">
      <div class="w12-wg-bar"><p class="tit">小组件</p><button class="btn" title="占位">＋</button></div>
      <div class="w12-wg-content wg-scroll">
        <!-- 时钟：数字 + 指针 + 公历/农历/节假日 -->
        <ClockCard />
        <!-- 日历：公历 + 农历 + 节气 + 法定节假日（含调休） -->
        <CalendarCard />
      </div>
    </div>
    <span class="hr"></span>
    <div class="w12-wg-half">
      <div class="w12-wg-bar">
        <p class="tit">网盘动态</p>
        <span style="color: #7f7f7f; font-size: 12px">实时</span>
      </div>
      <div class="w12-wg-content wg-scroll">
        <!-- 天气：iOS 风格（当前 + AQI + 逐时 + 15 天，Open-Meteo 免费无 key） -->
        <WxCard />
        <!-- 存储空间：各盘用量 + 个人配额 -->
        <div class="wg-card wg-item">
          <p class="wg-tit">存储空间</p>
          <div v-for="p in drives" :key="p.id" class="wg-drive">
            <div class="wg-row"><span class="wg-name">{{ p.name }}</span><span class="wg-val">{{ fmtBytes(p.usageBytes) }}</span></div>
            <div class="wg-track"><div class="wg-fill" :style="{ width: p._pct + '%' }"></div></div>
          </div>
          <div class="wg-drive">
            <div class="wg-row"><span class="wg-name">我的配额</span><span class="wg-val">{{ quotaText }}</span></div>
            <div class="wg-track"><div class="wg-fill quota" :style="{ width: quotaPct + '%' }"></div></div>
          </div>
        </div>
        <!-- 传输任务：点击进任务中心 -->
        <div class="wg-card wg-item wg-click" @click="openTasks">
          <p class="wg-tit">传输任务<span class="wg-badge" v-if="transfer.activeCount">{{ transfer.activeCount }} 进行中</span></p>
          <template v-if="transfer.tasks.length">
            <div v-for="t in transfer.tasks.slice(0, 3)" :key="t.id" class="wg-drive">
              <div class="wg-row"><span class="wg-name">{{ t.name }}</span><span class="wg-val">{{ taskState(t.status) }}</span></div>
              <div class="wg-track"><div class="wg-fill trans" :class="{ err: t.status === 'error' }" :style="{ width: Math.round(t.progress) + '%' }"></div></div>
            </div>
            <p class="wg-more" v-if="transfer.tasks.length > 3">还有 {{ transfer.tasks.length - 3 }} 个任务…</p>
          </template>
          <p class="wg-empty" v-else>暂无传输任务</p>
        </div>
        <!-- 收藏：点击打开所在目录 -->
        <div class="wg-card wg-item">
          <p class="wg-tit">收藏</p>
          <template v-if="stars.length">
            <div v-for="s in stars.slice(0, 5)" :key="s.id" class="wg-star" :title="s.path" @click="openStar(s)">
              <span class="wg-starico">★</span><span class="wg-name">{{ s.name }}</span>
            </div>
          </template>
          <p class="wg-empty" v-else>暂无收藏（资源管理器右键「收藏到快速访问」）</p>
        </div>
        <!-- SSH 快捷连接：有终端权限才显示 -->
        <div class="wg-card wg-item" v-if="termAllowed">
          <p class="wg-tit">SSH 快捷连接</p>
          <template v-if="sshs.length">
            <div v-for="c in sshs.slice(0, 5)" :key="c.id" class="wg-star" :title="c.username + '@' + c.host" @click="openSsh(c)">
              <span class="wg-starico">⇄</span><span class="wg-name">{{ c.name }}</span>
              <span class="wg-val" style="margin-left: auto">{{ c.host }}</span>
            </div>
          </template>
          <p class="wg-empty" v-else>暂无 SSH 连接（终端应用中添加）</p>
        </div>
        <div class="wg-card wg-item wg-click" @click="openGithub">
          <p class="wg-tit">CloudPan · 私有云存储</p>
          <p class="wg-empty">Go + Vue 全栈 · 三主题 Web 桌面 · GitHub 开源</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fsApi, termApi, appsApi, type Policy } from '../../api/modules'
import { useAppState } from '../../stores/appstate'
import { useTransfer } from '../../stores/transfer'
import { useSession } from '../../stores/session'
import { useWindows } from '../../stores/windows'
import ClockCard from './widgets/ClockCard.vue'
import CalendarCard from './widgets/CalendarCard.vue'
import WxCard from './widgets/WxCard.vue'
const props = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const transfer = useTransfer()
const session = useSession()
const store = useWindows()
const appstate = useAppState()
const termAllowed = computed(() => appstate.isAvailable('terminal'))

// ---- SSH 快捷连接 ----
const sshs = ref<{ id: number; name: string; host: string; username: string }[]>([])
function openSsh(c: any) {
  store.open('terminal', { mode: 'ssh', connId: c.id }, { title: 'SSH · ' + c.name, icon: 'terminal', w: 1040, h: 640 })
  emit('close')
}

// 存储空间：各盘用量（相对最大盘归一化为条形）+ 个人配额
const drives = ref<(Policy & { _pct: number })[]>([])
const quotaPct = computed(() => {
  const q = session.group?.quotaMB ?? 0
  if (!q || q < 0) return 4 // 不限量：装饰性细条
  return Math.min(100, Math.round((session.user?.usedBytes || 0) / (q * 1048576) * 100))
})
const quotaText = computed(() => {
  const used = fmtBytes(session.user?.usedBytes || 0)
  const q = session.group?.quotaMB ?? 0
  return q && q > 0 ? `${used} / ${q} GB` : `${used} · 不限量`
})

function fmtBytes(n: number) {
  if (!n) return '0 B'
  if (n > 1073741824) return (n / 1073741824).toFixed(1) + ' GB'
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}

function taskState(s: string) {
  return ({ queued: '排队中', hashing: '校验中', uploading: '上传中', merging: '合并中', paused: '已暂停', done: '已完成', error: '失败', instant: '秒传' } as Record<string, string>)[s] || s
}

// 收藏
const stars = ref<any[]>([])
function openStar(s: any) {
  const parent = s.path.slice(0, s.path.lastIndexOf('/')) || '/'
  store.open('explorer', { policyId: s.policyId, path: parent }, { title: s.name, icon: 'explorer', w: 1000, h: 640 })
  emit('close')
}
function openTasks() {
  store.open('tasks', null, { title: '任务中心', icon: 'tasks', w: 780, h: 580 })
  emit('close')
}
function openGithub() {
  window.open('https://github.com/johngko/cloudpan', '_blank', 'noopener')
  emit('close')
}

onMounted(async () => {
  if (termAllowed.value) {
    try { sshs.value = (await termApi.conns()) || [] } catch { /* 无权限/离线 */ }
  }
  try {
    const pols = await fsApi.policies()
    const max = Math.max(1, ...pols.map(p => p.usageBytes || 0))
    drives.value = pols.map(p => ({ ...p, _pct: Math.max(3, Math.round((p.usageBytes || 0) / max * 100)) }))
  } catch { /* 忽略 */ }
  try { stars.value = (await fsApi.starList()) || [] } catch { /* 忽略 */ }
})
</script>

<style scoped>
.wg-scroll { overflow: auto; display: flex; flex-direction: column; gap: 10px }
.wg-card {
  background: rgba(255, 255, 255, 0.72); border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(20px);
}
.wg-click { cursor: pointer }
.wg-click:hover { background: rgba(255, 255, 255, 0.92) }
.wg-tit { font-size: 13px; font-weight: 600; color: #1b1b1f; margin-bottom: 8px; display: flex; align-items: center; gap: 8px }
.wg-badge {
  font-size: 11px; font-weight: 500; color: #fff; background: #2f86d6;
  border-radius: 999px; padding: 1px 8px;
}
.wg-drive { margin-bottom: 8px }
.wg-drive:last-child { margin-bottom: 0 }
.wg-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px }
.wg-name { font-size: 12px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 78% }
.wg-val { font-size: 11px; color: #889; flex: none }
.wg-track { height: 6px; border-radius: 3px; background: rgba(0, 0, 0, 0.08); overflow: hidden }
.wg-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #4aa8ff, #2f86d6) }
.wg-fill.quota { background: linear-gradient(90deg, #7ec97e, #3f9e3f) }
.wg-fill.trans { background: linear-gradient(90deg, #ffb457, #f08c2e) }
.wg-fill.trans.err { background: #e05252 }
.wg-more { font-size: 11px; color: #99a; margin-top: 6px }
.wg-empty { font-size: 12px; color: #99a }
.wg-star {
  display: flex; align-items: center; gap: 7px; padding: 5px 6px; border-radius: 7px;
  cursor: pointer; font-size: 12px; color: #333;
}
.wg-star:hover { background: rgba(47, 134, 214, 0.1) }
.wg-starico { color: #f7c948; font-size: 12px }
</style>
