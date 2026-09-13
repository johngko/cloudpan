<template>
  <!-- #widgets：1000×600 双栏（左=小组件计算器，右=新闻/关于） -->
  <div class="w12-panel w12-widgets show-begin" :class="{ show: shown }" @click.stop>
    <div class="w12-wg-half">
      <div class="w12-wg-bar"><p class="tit">小组件</p><button class="btn" title="占位">＋</button></div>
      <div class="w12-wg-content">
        <!-- 计算器小组件（1:1 网格：input 横跨 + 5×4 键位） -->
        <div class="w12-calc">
          <div class="content">
            <div class="container"><input readonly :value="cur" /></div>
            <button class="b" style="--ga: pow" @click="square">𝑥²</button>
            <button class="b" style="--ga: sqrt" @click="sqrt">√𝑥</button>
            <button class="b" style="--ga: c" @click="clearAll">C</button>
            <button class="b" style="--ga: jia" @click="func('+')">+</button>
            <button class="b" style="--ga: n7" @click="num('7')">7</button>
            <button class="b" style="--ga: n8" @click="num('8')">8</button>
            <button class="b" style="--ga: n9" @click="num('9')">9</button>
            <button class="b" style="--ga: jian" @click="func('−')">−</button>
            <button class="b" style="--ga: n4" @click="num('4')">4</button>
            <button class="b" style="--ga: n5" @click="num('5')">5</button>
            <button class="b" style="--ga: n6" @click="num('6')">6</button>
            <button class="b" style="--ga: cheng" @click="func('×')">×</button>
            <button class="b" style="--ga: n1" @click="num('1')">1</button>
            <button class="b" style="--ga: n2" @click="num('2')">2</button>
            <button class="b" style="--ga: n3" @click="num('3')">3</button>
            <button class="b" style="--ga: chu" @click="func('÷')">÷</button>
            <button class="b" style="--ga: dot" @click="dot()">.</button>
            <button class="b" style="--ga: n0" @click="num('0')">0</button>
            <button class="b" style="--ga: back" @click="back()">⌫</button>
            <button class="b ans" style="--ga: ans" @click="eq">=</button>
          </div>
        </div>
      </div>
    </div>
    <span class="hr"></span>
    <div class="w12-wg-half">
      <div class="w12-wg-bar">
        <p class="tit">网盘动态</p>
        <span style="color: #7f7f7f; font-size: 12px">实时</span>
      </div>
      <div class="w12-wg-content wg-scroll">
        <!-- 天气：Open-Meteo（免费无 key），离线优雅降级 -->
        <div class="wg-card">
          <p class="wg-tit">天气
            <select class="wg-city" v-model="city" title="选择城市">
              <option v-for="c in cities" :key="c.name" :value="c.name">{{ c.name }}</option>
            </select>
          </p>
          <template v-if="wx.ok">
            <div class="wg-wx">
              <span class="wg-wxico">{{ wx.icon }}</span>
              <span class="wg-wxt">{{ wx.temp }}°C</span>
              <span class="wg-wxd">{{ wx.desc }} · 风 {{ wx.wind }} km/h</span>
            </div>
          </template>
          <p class="wg-empty" v-else>{{ wx.err || '获取中…' }}</p>
        </div>
        <!-- 存储空间：各盘用量 + 个人配额 -->
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
        <div class="wg-card">
          <p class="wg-tit">收藏</p>
          <template v-if="stars.length">
            <div v-for="s in stars.slice(0, 5)" :key="s.id" class="wg-star" :title="s.path" @click="openStar(s)">
              <span class="wg-starico">★</span><span class="wg-name">{{ s.name }}</span>
            </div>
          </template>
          <p class="wg-empty" v-else>暂无收藏（资源管理器右键「收藏到快速访问」）</p>
        </div>
        <!-- SSH 快捷连接：有终端权限才显示 -->
        <div class="wg-card" v-if="termAllowed">
          <p class="wg-tit">SSH 快捷连接</p>
          <template v-if="sshs.length">
            <div v-for="c in sshs.slice(0, 5)" :key="c.id" class="wg-star" :title="c.username + '@' + c.host" @click="openSsh(c)">
              <span class="wg-starico">⇄</span><span class="wg-name">{{ c.name }}</span>
              <span class="wg-val" style="margin-left: auto">{{ c.host }}</span>
            </div>
          </template>
          <p class="wg-empty" v-else>暂无 SSH 连接（终端应用中添加）</p>
        </div>
        <div class="wg-card wg-click" @click="openGithub">
          <p class="wg-tit">CloudPan · 私有云存储</p>
          <p class="wg-empty">Go + Vue 全栈 · 三主题 Web 桌面 · GitHub 开源</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fsApi, termApi, appsApi, type Policy } from '../../api/modules'
import { useAppState } from '../../stores/appstate'
import { useTransfer } from '../../stores/transfer'
import { useSession } from '../../stores/session'
import { useWindows } from '../../stores/windows'
const props = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const transfer = useTransfer()
const session = useSession()
const store = useWindows()
const appstate = useAppState()
const termAllowed = computed(() => appstate.isAvailable('terminal'))

// ---- 天气（Open-Meteo 免费无 key；离线时优雅降级）----
const cities = [
  { name: '北京', lat: 39.9042, lon: 116.4074 },
  { name: '上海', lat: 31.2304, lon: 121.4737 },
  { name: '广州', lat: 23.1291, lon: 113.2644 },
  { name: '深圳', lat: 22.5431, lon: 114.0579 },
  { name: '成都', lat: 30.5728, lon: 104.0668 },
  { name: '杭州', lat: 30.2741, lon: 120.1551 },
  { name: '西安', lat: 34.3416, lon: 108.9398 },
  { name: '哈尔滨', lat: 45.8038, lon: 126.535 }
]
const city = ref(localStorage.getItem('cp_wx_city') || '北京')
const wx = ref<{ ok: boolean; temp: string; desc: string; wind: string; icon: string; err: string }>({ ok: false, temp: '', desc: '', wind: '', icon: '', err: '' })
const WMO: Record<number, string> = { 0: '晴', 1: '大致晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪', 95: '雷雨', 96: '雷雨冰雹', 99: '雷雨冰雹' }
async function loadWx() {
  const c = cities.find(x => x.name === city.value) || cities[0]
  wx.value = { ok: false, temp: '', desc: '', wind: '', icon: '', err: '获取中…' }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const j: any = await r.json()
    const cur = j.current || {}
    const code = Number(cur.weather_code ?? -1)
    wx.value = {
      ok: true,
      temp: String(Math.round(cur.temperature_2m ?? '')),
      desc: WMO[code] ?? '未知',
      wind: String(Math.round(cur.wind_speed_10m ?? 0)),
      icon: code === 0 ? '☀️' : code <= 2 ? '⛅' : code === 3 ? '☁️' : code >= 71 && code <= 86 ? '🌨️' : code >= 95 ? '⛈️' : code >= 45 && code <= 48 ? '🌫️' : '🌧️',
      err: ''
    }
  } catch {
    wx.value = { ok: false, temp: '', desc: '', wind: '', icon: '', err: '暂无法获取天气（离线或网络不可达）' }
  }
}
watch(city, (v) => { localStorage.setItem('cp_wx_city', v); loadWx() })

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
  return ({ hashing: '校验中', uploading: '上传中', paused: '已暂停', done: '已完成', error: '失败', instant: '秒传' } as Record<string, string>)[s] || s
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
  loadWx()
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

// 计算器状态（与演示站 widgetCalculator 同行为）
const cur = ref('0')
let prev: number | null = null
let op: string | null = null
let fresh = true

function num(k: string) {
  if (fresh) { cur.value = k === '.' ? '0.' : k; fresh = false }
  else cur.value = cur.value === '0' ? k : cur.value + k
}
function dot() {
  if (fresh) { cur.value = '0.'; fresh = false; return }
  if (!cur.value.includes('.')) cur.value += '.'
}
function func(o: string) {
  prev = parseFloat(cur.value)
  op = o
  fresh = true
}
function eq() {
  if (op === null || prev === null) return
  const b = parseFloat(cur.value)
  let r = 0
  if (op === '+') r = prev + b
  else if (op === '−') r = prev - b
  else if (op === '×') r = prev * b
  else if (op === '÷') r = b === 0 ? NaN : prev / b
  cur.value = Number.isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : '错误'
  prev = null; op = null; fresh = true
}
function clearAll() { cur.value = '0'; prev = null; op = null; fresh = true }
function back() { cur.value = cur.value.length > 1 ? cur.value.slice(0, -1) : '0' }
function square() { cur.value = String(Math.pow(parseFloat(cur.value), 2)); fresh = true }
function sqrt() { const v = parseFloat(cur.value); cur.value = v < 0 ? '错误' : String(Math.sqrt(v)); fresh = true }
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
.wg-city {
  margin-left: auto; font-size: 11px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px;
  background: rgba(255,255,255,0.7); padding: 1px 4px; color: #333; outline: none;
}
.wg-wx { display: flex; align-items: center; gap: 10px }
.wg-wxico { font-size: 26px }
.wg-wxt { font-size: 22px; font-weight: 300; color: #1b1b1f }
.wg-wxd { font-size: 12px; color: #667 }
</style>
