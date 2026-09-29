<template>
  <!-- 小组件面板（mac / deepin 共用）：Win11 式「深底 + 亮卡片」。
       时钟/日历/天气三张卡直接复用 themes/windows/widgets 下的组件 —— 三主题同源，
       避免出现第二套实现；本面板只负责外壳与「存储空间/传输任务/收藏」三张卡。 -->
  <div class="wp-mask" @mousedown.self="emit('close')">
    <div class="wp-panel" @click.stop>
      <div class="wp-head">
        <span class="wp-title">小组件</span>
        <button class="wp-x" title="关闭" @click="emit('close')">✕</button>
      </div>
      <div class="wp-body">
        <div class="wp-col">
          <ClockCard />
          <CalendarCard />
        </div>
        <div class="wp-col">
          <WxCard />
          <!-- 存储空间：各盘用量（相对最大盘归一化为条形）+ 个人配额 -->
          <div class="wg-card">
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
          <div class="wg-card wg-click" @click="openTasks">
            <p class="wg-tit">传输任务<span v-if="transfer.activeCount" class="wg-badge">{{ transfer.activeCount }} 进行中</span></p>
            <template v-if="transfer.tasks.length">
              <div v-for="t in transfer.tasks.slice(0, 3)" :key="t.id" class="wg-drive">
                <div class="wg-row"><span class="wg-name">{{ t.name }}</span><span class="wg-val">{{ taskState(t.status) }}</span></div>
                <div class="wg-track"><div class="wg-fill trans" :class="{ err: t.status === 'error' }" :style="{ width: Math.round(t.progress) + '%' }"></div></div>
              </div>
              <p v-if="transfer.tasks.length > 3" class="wg-more">还有 {{ transfer.tasks.length - 3 }} 个任务…</p>
            </template>
            <p v-else class="wg-empty">暂无传输任务</p>
          </div>
          <!-- 收藏：点击打开所在目录 -->
          <div class="wg-card">
            <p class="wg-tit">收藏</p>
            <template v-if="stars.length">
              <div v-for="s in stars.slice(0, 5)" :key="s.id" class="wg-star" :title="s.path" @click="openStar(s)">
                <span class="wg-starico">★</span><span class="wg-name">{{ s.name }}</span>
              </div>
            </template>
            <p v-else class="wg-empty">暂无收藏（资源管理器右键「收藏到快速访问」）</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fsApi, type Policy, type StarItem } from '../api/modules'
import { useTransfer } from '../stores/transfer'
import { useSession } from '../stores/session'
import { useWindows } from '../stores/windows'
import ClockCard from '../themes/windows/widgets/ClockCard.vue'
import CalendarCard from '../themes/windows/widgets/CalendarCard.vue'
import WxCard from '../themes/windows/widgets/WxCard.vue'

const emit = defineEmits<{ (e: 'close'): void }>()

const transfer = useTransfer()
const session = useSession()
const store = useWindows()

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
const stars = ref<StarItem[]>([])
function openStar(s: StarItem) {
  const parent = s.path.slice(0, s.path.lastIndexOf('/')) || '/'
  store.open('explorer', { policyId: s.policyId, path: parent }, { title: s.name, icon: 'explorer', w: 1000, h: 640 })
  emit('close')
}
function openTasks() {
  store.open('tasks', null, { title: '任务中心', icon: 'tasks', w: 780, h: 580 })
  emit('close')
}

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(async () => {
  window.addEventListener('keydown', onKey)
  try {
    const pols = await fsApi.policies()
    const max = Math.max(1, ...pols.map(p => p.usageBytes || 0))
    drives.value = pols.map(p => ({ ...p, _pct: Math.max(3, Math.round((p.usageBytes || 0) / max * 100)) }))
  } catch { /* 离线忽略 */ }
  try { stars.value = (await fsApi.starList()) || [] } catch { /* 离线忽略 */ }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.wp-mask {
  position: fixed; inset: 0; z-index: 7500;
  display: flex; justify-content: center; align-items: center;
  background: rgba(0, 0, 0, 0.28);
}
.wp-panel {
  width: min(900px, 94vw); max-height: 70vh;
  border-radius: var(--radius-3xl); overflow: hidden;
  display: flex; flex-direction: column;
  background: rgba(26, 29, 36, 0.72);
  -webkit-backdrop-filter: blur(30px) saturate(1.5);
  backdrop-filter: blur(30px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation: wp-in 0.16s var(--anim-pop, ease);
}
@keyframes wp-in { from { opacity: 0; transform: translateY(-8px) scale(0.99); } to { opacity: 1; transform: none; } }
.wp-head {
  flex: none; display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 8px; color: #eef1f5; font-size: 14px; font-weight: 600;
}
.wp-x {
  border: none; background: rgba(255, 255, 255, 0.12); color: #eef1f5;
  width: 24px; height: 24px; border-radius: 7px; cursor: pointer; font-size: 12px;
}
.wp-x:hover { background: rgba(255, 255, 255, 0.22); }
.wp-body { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 4px 16px 16px; }
.wp-col { flex: 1 1 0; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 640px) { .wp-body { flex-direction: column; } }

/* 卡片外观：与 win12 的面板保持同一套（亮卡片 + 深底）。
   卡片组件（时钟/日历/天气）的内部样式在各自文件里，其根元素带本组件的 scope，
   所以下面这条 .wg-card 同时作用于「复用的卡片」和「本面板自建的卡片」。 */
.wg-card {
  background: rgba(255, 255, 255, 0.82); border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px; padding: 12px 14px;
}
.wg-click { cursor: pointer; transition: background 0.15s; }
.wg-click:hover { background: rgba(255, 255, 255, 0.95); }
.wg-tit { font-size: 13px; font-weight: 600; color: #1b1b1f; margin-bottom: 8px; display: flex; align-items: center; gap: 8px }
.wg-badge { font-size: 11px; font-weight: 500; color: #fff; background: #2f86d6; border-radius: 999px; padding: 1px 8px }
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
.wg-star { display: flex; align-items: center; gap: 7px; padding: 5px 6px; border-radius: 7px; cursor: pointer; font-size: 12px; color: #333 }
.wg-star:hover { background: rgba(47, 134, 214, 0.1) }
.wg-starico { color: #f7c948; font-size: 12px }
</style>
