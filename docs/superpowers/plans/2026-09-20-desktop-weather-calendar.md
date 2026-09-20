# 日历增强 + 桌面天气组件 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 任务栏日历（WinDateBox）增加天气条/农历/法定节假日副标签；win12、macOS、Deepin 三主题桌面右上角新增共享数据源的天气卡片。

**Architecture:** 新增共享 Pinia store（`stores/weather.ts`，Open-Meteo 一次请求 + 30 分钟 TTL）与共享工具（`utils/weather.ts`，从 WxCard 抽出城市表/WMO 映射）；WinDateBox 用 `utils/lunar.ts` 的 `dayInfo()` 渲染农历/节假日；新增跨主题共享组件 `shell/WeatherWidget.vue` 挂到三个桌面右上角；小组件面板 WxCard 重构为消费同一 store（城市全局同步）。

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vite；数据源 Open-Meteo（免费无 key，CSP `connect-src` 已放行 `api.open-meteo.com` / `air-quality-api.open-meteo.com`，后端零改动）。

## Global Constraints

- 前端产物必须经 `./build.sh` 同步进 `server/internal/web/dist` 再 `go build`；重启只能用 `./start.sh`（加载 env.local，`CP_DB=mysql`）。
- 后端零改动：不改 `server/internal/middleware/security.go` 的 CSP，不加任何新路由/接口。
- 不新增第三方 npm 依赖；不引入测试框架（项目现状无单测基建，验证 = `npm run build` + browser-use GUI 实测 + 截图）。
- 城市列表 = 现有 8 城（北京/上海/广州/深圳/成都/杭州/西安/哈尔滨）；城市持久化 key 固定 `cp_wx_city`（与现 WxCard 兼容）。
- 天气卡 DOM 位置：各主题 `.desktop` 内、`.desktop-icons` 之后、窗口 `TransitionGroup` 之前；**不得**给天气卡或窗口设 z-index（三主题窗口均无 z-index，按 DOM 顺序叠放）。
- 仓库与文档中禁止出现任何密码/密钥（含临时 admin 密码，只能用 shell 变量传递）。
- GUI 证据截图存 `docs/test-evidence/tNN-*.png`，NN 从 **39** 起（现最大 t38）。
- 设计文档：`docs/superpowers/specs/2026-09-20-desktop-weather-calendar-design.md`（行为基准，有冲突以它为准）。

**2026-09 日历预期值（GUI 验证基准，已用 lunar-typescript 预计算）：**
- 今天 9/20（周日）：国庆节调休上班 → 副标签蓝"班"；日期行农历 = 丙午（马）年 八月初十
- 9/25（五）、9/26（六）、9/27（日）：中秋节 → 副标签红"中秋"
- 9/11 = 八月初一（灰色农历）

---

### Task 1: 共享天气工具 `web/src/utils/weather.ts`

**Files:**
- Create: `web/src/utils/weather.ts`

**Interfaces:**
- Consumes: 无（从 `web/src/themes/windows/widgets/WxCard.vue` L50-73 抽取，行为必须 1:1 一致）。
- Produces（后续任务依赖的精确签名）:
  - `export interface City { name: string; lat: number; lon: number }`
  - `export const CITIES: City[]`（8 城，顺序/经纬度与 WxCard 现值一致）
  - `export const WMO: Record<number, string>`
  - `export function wmoIcon(code: number, hour?: number): string`
  - `export const WIND8: string[]`
  - `export function windDir(deg: number): string`（= `WIND8[Math.round(deg / 45) % 8]`）

- [ ] **Step 1: 写文件（完整内容）**

```ts
// 天气共享工具：城市表 + WMO 码映射 + 风向（从 WxCard 抽出，桌面卡/日历天气条/小组件共用）
export interface City { name: string; lat: number; lon: number }

export const CITIES: City[] = [
  { name: '北京', lat: 39.9042, lon: 116.4074 },
  { name: '上海', lat: 31.2304, lon: 121.4737 },
  { name: '广州', lat: 23.1291, lon: 113.2644 },
  { name: '深圳', lat: 22.5431, lon: 114.0579 },
  { name: '成都', lat: 30.5728, lon: 104.0668 },
  { name: '杭州', lat: 30.2741, lon: 120.1551 },
  { name: '西安', lat: 34.3416, lon: 108.9398 },
  { name: '哈尔滨', lat: 45.8038, lon: 126.535 }
]

// WMO 天气码 → 中文（Open-Meteo weather_code）
export const WMO: Record<number, string> = { 0: '晴', 1: '大致晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪', 95: '雷雨', 96: '雷雨冰雹', 99: '雷雨冰雹' }

export function wmoIcon(code: number, hour?: number): string {
  const night = hour != null && (hour < 6 || hour >= 19)
  if (code === 0) return night ? '🌙' : '☀️'
  if (code <= 2) return code === 1 ? '🌤️' : '⛅'
  if (code === 3) return '☁️'
  if (code >= 45 && code <= 48) return '🌫️'
  if (code >= 71 && code <= 77) return '🌨️'
  if (code >= 80 && code <= 86) return '🌦️'
  if (code >= 95) return '⛈️'
  return '🌧️'
}

export const WIND8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

export function windDir(deg: number): string {
  return WIND8[Math.round(deg / 45) % 8]
}
```

- [ ] **Step 2: 构建验证**

Run: `cd /www/wwwhdd/cloudpan/web && npm run build`
Expected: 构建成功（无新报错；此文件尚无人引用，vite 不会打包它，但 TS 语法错误会在后续任务引用时暴露——本任务以文件创建为准）。

- [ ] **Step 3: Commit**

```bash
cd /www/wwwhdd/cloudpan && git add web/src/utils/weather.ts && git commit -m "feat(web): 抽出天气共享工具 utils/weather（城市表/WMO 映射/风向）"
```

---

### Task 2: 共享天气 store `web/src/stores/weather.ts`

**Files:**
- Create: `web/src/stores/weather.ts`

**Interfaces:**
- Consumes: `utils/weather.ts` 的 `CITIES` / `WMO` / `wmoIcon` / `windDir`（Task 1）。
- Produces:

```ts
export interface WxCurrent { temp: number; feels: number; desc: string; icon: string; wind: number; windDir: string; humidity: number; aqi: number; high: number | null; low: number | null }
export interface WxHour { t: string; d: number; icon: string }
export interface WxDay { date: string; label: string; icon: string; p: number | null; lo: number; hi: number }
// store: useWeatherStore() → { city, status: 'idle'|'loading'|'ok'|'error', err, current: WxCurrent, hours: WxHour[], days: WxDay[], updatedAt, load(force?), setCity(name), refresh() }
```

- [ ] **Step 1: 写文件（完整内容）**

```ts
// 天气数据 store：桌面天气卡 / 日历天气条 / 小组件天气卡的单一数据源。
// Open-Meteo 免费无 key（CSP connect-src 已放行 api.open-meteo.com / air-quality-api.open-meteo.com）；
// 一次请求取回当前+逐时+15 天，AQI 走独立端点（失败仅隐藏）；30 分钟 TTL 内复用缓存。
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CITIES, WMO, wmoIcon, windDir } from '../utils/weather'

export interface WxCurrent {
  temp: number; feels: number; desc: string; icon: string
  wind: number; windDir: string; humidity: number
  aqi: number // -1 = 不可用（UI 隐藏徽章）
  high: number | null; low: number | null
}
export interface WxHour { t: string; d: number; icon: string }
export interface WxDay { date: string; label: string; icon: string; p: number | null; lo: number; hi: number }

const TTL = 30 * 60 * 1000
const CITY_KEY = 'cp_wx_city'

export const useWeatherStore = defineStore('weather', () => {
  const city = ref(localStorage.getItem(CITY_KEY) || CITIES[0].name)
  const status = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const err = ref('')
  const current = ref<WxCurrent>({ temp: 0, feels: 0, desc: '', icon: '', wind: 0, windDir: '', humidity: 0, aqi: -1, high: null, low: null })
  const hours = ref<WxHour[]>([])
  const days = ref<WxDay[]>([])
  const updatedAt = ref(0)

  let reqSeq = 0 // 请求序号防竞态：仅最新一次响应可落地

  async function load(force = false) {
    if (!force && status.value === 'ok' && Date.now() - updatedAt.value < TTL) return
    const c = CITIES.find(x => x.name === city.value) || CITIES[0]
    const seq = ++reqSeq
    if (status.value !== 'ok') { status.value = 'loading'; err.value = '' } // ok 状态下刷新保留旧数据直到新数据落地
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&timezone=auto`
        + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m'
        + '&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=15'
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const j: any = await r.json()
      if (seq !== reqSeq) return
      const cur = j.current || {}
      const code = Number(cur.weather_code ?? -1)
      // 逐时：从当前整点起取 8 格
      const hNow = new Date().getHours()
      const hTimes: string[] = j.hourly?.time || []
      const start = hTimes.findIndex(t => Number((t.split('T')[1] || '0:0').split(':')[0]) >= hNow)
      const hs: WxHour[] = []
      for (let i = Math.max(0, start); i < Math.max(0, start) + 8 && i < hTimes.length; i++) {
        const hh = Number((hTimes[i].split('T')[1] || '0:0').split(':')[0])
        hs.push({ t: String(hh).padStart(2, '0') + ':00', d: Math.round(Number(j.hourly.temperature_2m[i])), icon: wmoIcon(Number(j.hourly.weather_code[i]), hh) })
      }
      // 15 天：今天/明天/周X
      const ds: WxDay[] = []
      const dTimes: string[] = j.daily?.time || []
      for (let i = 0; i < dTimes.length; i++) {
        const dt = new Date(dTimes[i] + 'T12:00:00')
        const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()]
        ds.push({
          date: dTimes[i],
          label: i === 0 ? '今天' : i === 1 ? '明天' : wd,
          icon: wmoIcon(Number(j.daily.weather_code[i])),
          p: j.daily.precipitation_probability_max?.[i] != null ? Math.round(Number(j.daily.precipitation_probability_max[i])) : null,
          lo: Math.round(Number(j.daily.temperature_2m_min[i])),
          hi: Math.round(Number(j.daily.temperature_2m_max[i]))
        })
      }
      current.value = {
        temp: Math.round(Number(cur.temperature_2m ?? 0)),
        feels: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)),
        desc: WMO[code] ?? '未知',
        icon: wmoIcon(code),
        wind: Math.round(Number(cur.wind_speed_10m ?? 0)),
        windDir: windDir(Number(cur.wind_direction_10m ?? 0)),
        humidity: Math.round(Number(cur.relative_humidity_2m ?? 0)),
        aqi: -1,
        high: ds.length ? ds[0].hi : null,
        low: ds.length ? ds[0].lo : null
      }
      hours.value = hs
      days.value = ds
      status.value = 'ok'
      updatedAt.value = Date.now()
      // 空气质量：独立端点，失败仅隐藏（不阻塞主数据）
      try {
        const ar = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&current=us_aqi`, { signal: AbortSignal.timeout(8000) })
        const aj: any = await ar.json()
        if (seq === reqSeq && aj.current?.us_aqi != null) current.value.aqi = Math.round(Number(aj.current.us_aqi))
      } catch { /* AQI 不可用则隐藏 */ }
    } catch {
      if (seq === reqSeq) { status.value = 'error'; err.value = '暂无法获取天气（离线或网络不可达）' }
    }
  }

  function setCity(name: string) {
    if (name === city.value) return
    city.value = name
    localStorage.setItem(CITY_KEY, name)
    void load(true)
  }
  function refresh() { void load(true) }

  return { city, status, err, current, hours, days, updatedAt, load, setCity, refresh }
})
```

- [ ] **Step 2: 构建验证**

Run: `cd /www/wwwhdd/cloudpan/web && npm run build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
cd /www/wwwhdd/cloudpan && git add web/src/stores/weather.ts && git commit -m "feat(web): 天气共享 store（Open-Meteo 30min TTL，城市 cp_wx_city 持久化）"
```

---

### Task 3: 日历增强（WinDateBox 天气条 + 农历 + 节假日副标签）

**Files:**
- Rewrite: `web/src/themes/windows/WinDateBox.vue`（整体替换）
- Modify: `web/src/themes/windows/win.css:643-659`（datebox 宽度/高度、副标签与天气条样式）
- Modify: `web/src/themes/windows/WinTaskBar.vue:163-171`（`positionPanel` 宽度按面板区分）

**Interfaces:**
- Consumes: `utils/lunar.ts` 的 `dayInfo(dt: Date): DayInfo` 与 `DayInfo`（`lunarShort`/`ganzhi`/`label`/`labelKind`）；`stores/weather.ts`（Task 2）。
- Produces: 无（叶子 UI）。

- [ ] **Step 1: 重写 WinDateBox.vue（完整新文件）**

```vue
<template>
  <!-- #datebox：380×500，35px 时钟 + 日期(农历) + 天气条 + 周一始日历（农历/节假日副标签，今日渐变高亮） -->
  <div class="w12-panel w12-datebox show-begin" :class="{ show: shown }" :style="{ left: left + 'px' }" @click.stop>
    <div class="w12-db-tit">
      <p class="w12-db-time">{{ time }}</p>
      <p class="w12-db-date">{{ dateFull }}</p>
      <p class="w12-db-lunar">{{ todayInfo.ganzhi }} {{ todayInfo.lunarShort }}<span v-if="todayInfo.label" class="w12-db-fest" :class="todayInfo.labelKind">{{ todayInfo.label }}</span></p>
      <p class="w12-db-wx" v-if="wxText">{{ wxText }}</p>
      <hr class="w12-db-hr" />
    </div>
    <div class="w12-db-cont">
      <div class="w12-db-head"><p>一</p><p>二</p><p>三</p><p>四</p><p>五</p><p>六</p><p>日</p></div>
      <div class="w12-db-body">
        <span v-for="i in offset" :key="'e' + i"></span>
        <p v-for="c in cells" :key="c.d" :class="{ today: c.d === today }"
          :title="c.info.label ? c.info.label + (c.info.labelKind === 'work' ? '（调休上班）' : '') : '农历' + c.info.lunarShort">
          <b>{{ c.d }}</b><i :class="c.sub.cls">{{ c.sub.text }}</i>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { dayInfo, type DayInfo } from '../../utils/lunar'
import { useWeatherStore } from '../../stores/weather'

defineProps<{ shown: boolean; left?: number }>()

const now = ref(new Date())
const timer = window.setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => window.clearInterval(timer))

const time = computed(() => now.value.toTimeString().slice(0, 8))
const dateFull = computed(() => {
  const d = now.value
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${'日一二三四五六'[d.getDay()]}`
})
const today = computed(() => now.value.getDate())
const todayInfo = computed(() => dayInfo(now.value))

// 周一始偏移（标准公式；演示站的公式在 JS 负取模下某些月份会错位）
const offset = computed(() => (new Date(now.value.getFullYear(), now.value.getMonth(), 1).getDay() + 6) % 7)

// 副标签规则与小组件 CalendarCard 一致：调休"班" > 节日名(红/橙/绿) > 农历灰
function subOf(info: DayInfo): { text: string; cls: string } {
  if (info.labelKind === 'work') return { text: '班', cls: 'work' }
  if (info.label) return { text: info.label, cls: info.labelKind }
  return { text: info.lunarShort, cls: '' }
}

// 当月每日信息：只依赖 ymKey（月份翻转才重算），避免每秒 tick 触发 31 次农历计算
const ymKey = computed(() => now.value.getFullYear() * 12 + now.value.getMonth())
const cells = computed(() => {
  const k = ymKey.value
  const y = Math.floor(k / 12), m = k % 12
  const n = new Date(y, m + 1, 0).getDate()
  const arr: { d: number; info: DayInfo; sub: { text: string; cls: string } }[] = []
  for (let d = 1; d <= n; d++) {
    const info = dayInfo(new Date(y, m, d))
    arr.push({ d, info, sub: subOf(info) })
  }
  return arr
})

// 天气条（共享 store；面板打开=组件挂载，load() 带 30min TTL）
const weather = useWeatherStore()
const wxText = computed(() => {
  if (weather.status === 'loading') return '获取天气中…'
  if (weather.status === 'error') return '天气暂不可用'
  if (weather.status !== 'ok') return ''
  const c = weather.current
  const hl = c.high != null && c.low != null ? `  ${c.low}~${c.high}°` : ''
  return `${c.icon} ${c.temp}° ${c.desc}${hl} · ${weather.city}`
})
onMounted(() => { weather.load() })
</script>
```

- [ ] **Step 2: 改 win.css datebox 区块（L643-659 整体替换为）**

```css
.w12-datebox { width: 380px; height: 500px; padding: 10px; transform: translateY(600px); flex-direction: column; }
.w12-db-tit { padding: 3px 5px; }
.w12-db-time { font-size: 35px; line-height: 50px; height: 50px; color: var(--w12-text); font-weight: 400; font-variant-numeric: tabular-nums; }
.w12-db-date { margin-left: 5px; font-size: 13.5px; color: var(--w12-text); }
.w12-db-lunar { margin: 2px 0 0 5px; font-size: 12px; color: var(--w12-text2); }
.w12-db-fest { margin-left: 6px; font-weight: 600; }
.w12-db-fest.holiday { color: #d65a4a; }
.w12-db-fest.work { color: #4a7fd6; }
.w12-db-fest.fest { color: #d69a4a; }
.w12-db-fest.jieqi { color: #5a9a5a; }
.w12-db-wx { margin: 7px 0 0 5px; font-size: 12.5px; color: var(--w12-text2); }
.w12-db-hr { width: 100%; height: 1px; background: #afafaf50; margin: 8px 0; border: none; }
.w12-db-cont { width: 100%; flex-grow: 1; }
.w12-db-head { width: 100%; display: flex; }
.w12-db-head p { width: calc(100% / 7); text-align: center; font-size: 13px; color: var(--w12-text2); }
.w12-db-body { display: flex; flex-wrap: wrap; margin-top: 5px; }
.w12-db-body p, .w12-db-body span {
  width: calc(100% / 7); height: 46.5px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 13.5px; color: var(--w12-text);
}
.w12-db-body b { font-weight: 400; line-height: 1.25; }
.w12-db-body i {
  font-style: normal; font-size: 9.5px; line-height: 1.2; color: var(--w12-text2);
  max-width: 96%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.w12-db-body i.holiday { color: #d65a4a; font-weight: 600; }
.w12-db-body i.work { color: #4a7fd6; font-weight: 600; }
.w12-db-body i.fest { color: #d69a4a; font-weight: 600; }
.w12-db-body i.jieqi { color: #5a9a5a; font-weight: 600; }
.w12-db-body p:hover { background-color: var(--w12-hover); }
.w12-db-body p:active { opacity: 0.7; }
.w12-db-body p { cursor: default; transition: 80ms; }
.w12-db-body p.today { background: linear-gradient(120deg, var(--theme-1), var(--theme-2)); color: #eeeeee; }
.w12-db-body p.today i { color: #dceeff; }
```

注意：原 L652-659 中 `padding-top: 10px` 的单行布局被 flex 两行布局取代；`.w12-db-head p` 的 `width: 46.5px` 改为 `calc(100% / 7)`（380px 面板适配）；`transform: translateY(520px)` 改为 `600px`（高度增大后保证隐藏态完全移出视口：面板 bottom:60px + 高 500px，需下移 ≥560px）。

- [ ] **Step 3: 改 WinTaskBar.vue positionPanel（L167 一行替换）**

```ts
  const W = p === 'datebox' ? 380 : 350
```

（`const W = 350` 所在行；ctrl 面板保持 350。）

- [ ] **Step 4: 构建验证**

Run: `cd /www/wwwhdd/cloudpan/web && npm run build`
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
cd /www/wwwhdd/cloudpan && git add web/src/themes/windows/WinDateBox.vue web/src/themes/windows/win.css web/src/themes/windows/WinTaskBar.vue && git commit -m "feat(web): 任务栏日历增强——天气条+农历+法定节假日/调休副标签（380px）"
```

---

### Task 4: 桌面天气卡组件 `web/src/shell/WeatherWidget.vue`

**Files:**
- Create: `web/src/shell/WeatherWidget.vue`

**Interfaces:**
- Consumes: `stores/weather.ts`（Task 2）：`store.city/status/err/current/hours/days/refresh/setCity/load`；`utils/weather.ts` 的 `CITIES`（Task 1）；`web/src/components/AppIcon.vue`（`name`/`size` props）。
- Produces: 根元素 class `wx-widget`（主题 CSS 覆写选择器依赖它）；无 props/emit（自包含）。

- [ ] **Step 1: 写文件（完整内容）**

```vue
<template>
  <!-- 桌面天气卡：各主题桌面右上角（中等卡片：当前天气 + 体感/风/湿度 + 5 天预报）；
       数据走共享 weather store（与日历天气条/小组件 WxCard 城市同步，30min TTL） -->
  <div class="wx-widget" @mousedown.stop @contextmenu.stop @click.stop>
    <div class="wxw-head">
      <span class="wxw-city">{{ store.city }}</span>
      <span class="wxw-actions">
        <button class="wxw-refresh" title="刷新" @click="store.refresh()">
          <AppIcon name="refresh" :size="12" />
        </button>
        <select class="wxw-sel" :value="store.city" title="选择城市"
          @change="store.setCity(($event.target as HTMLSelectElement).value)">
          <option v-for="c in CITIES" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
      </span>
    </div>
    <div v-if="store.status === 'ok'" class="wxw-body">
      <div class="wxw-now">
        <span class="wxw-icon">{{ store.current.icon }}</span>
        <div class="wxw-nowmain">
          <div class="wxw-temp">{{ store.current.temp }}°<span v-if="store.current.high != null"> / {{ store.current.low }}~{{ store.current.high }}°</span></div>
          <div class="wxw-cond">{{ store.current.desc }}
            <span v-if="store.current.aqi >= 0" class="wxw-aqi" :style="{ background: aqiColor }">AQI {{ store.current.aqi }} {{ aqiLabel }}</span>
          </div>
          <div class="wxw-sub">体感 {{ store.current.feels }}° · 风{{ store.current.windDir }} {{ store.current.wind }}km/h · 湿度 {{ store.current.humidity }}%</div>
        </div>
      </div>
      <div class="wxw-days">
        <div v-for="day in store.days.slice(0, 5)" :key="day.date" class="wxw-day">
          <span class="wxw-dl">{{ day.label }}</span>
          <span class="wxw-di">{{ day.icon }}</span>
          <span class="wxw-dp" v-if="day.p != null">{{ day.p }}%</span>
          <span class="wxw-dt"><span class="lo">{{ day.lo }}°</span>~{{ day.hi }}°</span>
        </div>
      </div>
    </div>
    <div v-else class="wxw-fallback">
      <p>{{ store.status === 'error' ? store.err : '获取中…' }}</p>
      <button v-if="store.status === 'error'" @click="store.refresh()">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useWeatherStore } from '../stores/weather'
import { CITIES } from '../utils/weather'

const store = useWeatherStore()
// 城市双向：外部改（如 WxCard）→ 同步下拉；本组件改 → setCity 落库
const picked = ref(store.city)
watch(picked, v => store.setCity(v))
watch(() => store.city, v => (picked.value = v))

const aqiLabel = computed(() => {
  const a = store.current.aqi
  if (a < 0) return ''
  if (a <= 50) return '优'
  if (a <= 100) return '良'
  if (a <= 150) return '轻度'
  if (a <= 200) return '中度'
  if (a <= 300) return '重度'
  return '严重'
})
const aqiColor = computed(() => {
  const a = store.current.aqi
  if (a < 0) return 'transparent'
  if (a <= 50) return '#34c759'
  if (a <= 100) return '#ffd60a'
  if (a <= 150) return '#ff9500'
  if (a <= 200) return '#ff3b30'
  if (a <= 300) return '#af52de'
  return '#7d2a2a'
})
onMounted(() => { store.load() })
</script>

<style scoped>
/* 基础玻璃拟态（默认深色玻璃，适配 macOS/Deepin）；win12 的浅色玻璃覆写见 win.css */
.wx-widget {
  position: absolute; top: calc(var(--shell-top) + 12px); right: 12px;
  width: 300px; border-radius: 14px; padding: 10px 12px 8px;
  background: rgba(24, 26, 32, 0.55);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
  color: #e8eaed; user-select: none; font-size: 12px;
}
.wxw-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.wxw-city { font-size: 13px; font-weight: 600; }
.wxw-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.wxw-refresh {
  border: none; background: rgba(255, 255, 255, 0.12); color: #dfe3e8; border-radius: 6px;
  width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s, transform 0.3s;
}
.wxw-refresh:hover { background: rgba(255, 255, 255, 0.22); }
.wxw-refresh:active { transform: rotate(180deg); }
.wxw-sel {
  border: none; background: rgba(255, 255, 255, 0.12); color: #dfe3e8; border-radius: 6px;
  font-size: 11px; padding: 2px 4px; cursor: pointer; max-width: 76px;
}
.wxw-sel option { color: #1b1b1f; }
.wxw-now { display: flex; align-items: center; gap: 10px; }
.wxw-icon { font-size: 38px; line-height: 1; }
.wxw-temp { font-size: 28px; font-weight: 250; line-height: 1.15; }
.wxw-temp span { font-size: 12px; opacity: 0.75; font-weight: 400; }
.wxw-cond { font-size: 12px; opacity: 0.9; margin-top: 2px; display: flex; align-items: center; gap: 6px; }
.wxw-aqi { font-size: 10px; color: #fff; border-radius: 999px; padding: 1px 8px; font-weight: 600; }
.wxw-sub { font-size: 11px; opacity: 0.65; margin-top: 3px; }
.wxw-days { margin-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.12); padding-top: 6px; display: flex; flex-direction: column; gap: 2px; }
.wxw-day { display: grid; grid-template-columns: 40px 24px 38px 1fr; align-items: center; gap: 6px; padding: 2px 4px; border-radius: 6px; transition: background 0.12s; }
.wxw-day:hover { background: rgba(255, 255, 255, 0.08); }
.wxw-dl { font-size: 12px; }
.wxw-di { font-size: 15px; text-align: center; }
.wxw-dp { font-size: 10.5px; opacity: 0.7; text-align: center; }
.wxw-dt { font-size: 12px; text-align: right; }
.wxw-dt .lo { opacity: 0.6; }
.wxw-fallback { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 42px 0; opacity: 0.85; }
.wxw-fallback button {
  border: none; background: rgba(255, 255, 255, 0.15); color: #e8eaed; border-radius: 6px;
  font-size: 11px; padding: 4px 14px; cursor: pointer;
}
.wxw-fallback button:hover { background: rgba(255, 255, 255, 0.25); }
</style>
```

（上面代码块即最终文件全文：template + script + style 各一份，照抄即可。）

- [ ] **Step 2: 构建验证**

Run: `cd /www/wwwhdd/cloudpan/web && npm run build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
cd /www/wwwhdd/cloudpan && git add web/src/shell/WeatherWidget.vue && git commit -m "feat(web): 桌面天气卡组件 WeatherWidget（中等卡片，共享 store，三主题共用）"
```

---

### Task 5: 挂载到三个桌面 + 主题样式覆写

**Files:**
- Modify: `web/src/themes/windows/WinDesktop.vue`（模板 L10-12 之间 + import）
- Modify: `web/src/themes/macos/MacDesktop.vue`（模板 `.desktop-icons` 之后 + import）
- Modify: `web/src/themes/deepin/DeepinDesktop.vue`（模板 `.desktop-icons` 之后 + import）
- Modify: `web/src/themes/windows/win.css`（win12 浅色玻璃覆写；追加在 `.w12-datebox` 区块后）
- macOS / Deepin 不覆写（组件基础深色玻璃已适配）

**Interfaces:**
- Consumes: `shell/WeatherWidget.vue`（Task 4，无 props）。
- Produces: 无。

- [ ] **Step 1: WinDesktop.vue 挂载**

模板中，在 `</div>`（`.desktop-icons` 结束，现 L10）与 `<!-- 窗口层 -->` 注释（现 L12）之间插入：

```vue
    <!-- 桌面天气卡（右上角；DOM 先于窗口层 → 被窗口盖住，盖住图标） -->
    <WeatherWidget />
```

script 中 import（与 `import WinTaskBar from './WinTaskBar.vue'` 相邻）：

```ts
import WeatherWidget from '../../shell/WeatherWidget.vue'
```

- [ ] **Step 2: MacDesktop.vue 挂载**

同样位置（`.desktop-icons` 结束与 `<!-- 窗口层 -->` 之间）插入：

```vue
    <!-- 桌面天气卡（右上角，mac.css --shell-top:24px 使其落在菜单栏下方） -->
    <WeatherWidget />
```

import（相对路径同为 `../../shell/WeatherWidget.vue`）。

- [ ] **Step 3: DeepinDesktop.vue 挂载**

同 Step 2（注释写 Deepin 即可）。

- [ ] **Step 4: win.css 追加 win12 覆写**

在 `.w12-datebox` 区块（Task 3 改后的 L643 起）之后追加：

```css
/* 桌面天气卡（win12）：与 w12-panel 同源的浅色玻璃（变量已含 dark 适配） */
.theme-win12 .wx-widget {
  background: var(--w12-bg50);
  -webkit-backdrop-filter: saturate(4) contrast(0.8) blur(70px);
  backdrop-filter: saturate(4) contrast(0.8) blur(70px);
  border: 1.5px solid #99999950;
  box-shadow: 3px 3px 20px 1px var(--w12-shadow);
  color: var(--w12-text);
}
.theme-win12 .wxw-refresh { background: var(--w12-hover); color: var(--w12-text); }
.theme-win12 .wxw-refresh:hover { background: var(--w12-hover-half); }
.theme-win12 .wxw-sel { background: var(--w12-hover); color: var(--w12-text); }
.theme-win12 .wxw-sel option { color: var(--w12-text); }
.theme-win12 .wxw-fallback button { background: var(--w12-hover); color: var(--w12-text); }
```

- [ ] **Step 5: 构建验证**

Run: `cd /www/wwwhdd/cloudpan/web && npm run build`
Expected: 构建成功。

- [ ] **Step 6: Commit**

```bash
cd /www/wwwhdd/cloudpan && git add web/src/themes/windows/WinDesktop.vue web/src/themes/macos/MacDesktop.vue web/src/themes/deepin/DeepinDesktop.vue web/src/themes/windows/win.css && git commit -m "feat(web): 三主题桌面右上角挂载天气卡（win12 浅色玻璃覆写）"
```

---

### Task 6: 小组件 WxCard 接入共享 store

**Files:**
- Rewrite: `web/src/themes/windows/widgets/WxCard.vue`（template + script 整体替换；`<style scoped>` 原样保留）

**Interfaces:**
- Consumes: `stores/weather.ts`（Task 2）；`utils/weather.ts` 的 `CITIES`（Task 1）；`AppIcon`。
- Produces: 无（叶子 UI）。

- [ ] **Step 1: 替换 template + script（完整新内容，style 块不动）**

```vue
<template>
  <div class="wg-card wg-item wg-wx">
    <p class="wg-tit">天气
      <span class="wx-right">
        <button class="wx-refresh" title="刷新" @click="store.refresh()"><AppIcon name="refresh" :size="12" /></button>
        <select class="wg-city" :value="store.city" title="选择城市"
          @change="store.setCity(($event.target as HTMLSelectElement).value)">
          <option v-for="c in CITIES" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
      </span>
    </p>
    <!-- 当前：大字号温度 + 状况 + 空气质量（iOS 天气卡片式） -->
    <template v-if="store.status === 'ok'">
      <div class="wx-now">
        <span class="wx-icon">{{ store.current.icon }}</span>
        <div class="wx-nowmain">
          <div class="wx-temp">{{ store.current.temp }}°<span v-if="store.current.high != null"> / {{ store.current.low }}~{{ store.current.high }}°</span></div>
          <div class="wx-cond">{{ store.current.desc }}
            <span v-if="store.current.aqi >= 0" class="wx-aqi" :style="{ background: aqiColor }">AQI {{ store.current.aqi }} {{ aqiLabel }}</span>
          </div>
          <div class="wx-sub">体感 {{ store.current.feels }}° · 风{{ store.current.windDir }} {{ store.current.wind }} km/h · 湿度 {{ store.current.humidity }}%</div>
        </div>
      </div>
      <!-- 逐时（未来 8 小时） -->
      <div class="wx-hourly">
        <div v-for="h in store.hours" :key="h.t" class="wx-h">
          <span class="wx-ht">{{ h.t }}</span>
          <span class="wx-hi">{{ h.icon }}</span>
          <span class="wx-hd">{{ h.d }}°</span>
        </div>
      </div>
      <!-- 15 天预报 -->
      <div class="wx-days">
        <div v-for="day in store.days" :key="day.date" class="wx-day">
          <span class="wx-dl">{{ day.label }}</span>
          <span class="wx-di">{{ day.icon }}</span>
          <span class="wx-dp" v-if="day.p != null">{{ day.p }}%</span>
          <span class="wx-dt"><span class="lo">{{ day.lo }}°</span>~{{ day.hi }}°</span>
        </div>
      </div>
    </template>
    <p class="wg-empty" v-else>{{ store.status === 'error' ? store.err : '获取中…' }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AppIcon from '../../../components/AppIcon.vue'
import { useWeatherStore } from '../../../stores/weather'
import { CITIES } from '../../../utils/weather'

// 数据源 = 共享 weather store（城市与桌面天气卡/日历天气条全局同步，30min TTL）
const store = useWeatherStore()

const aqiLabel = computed(() => {
  const a = store.current.aqi
  if (a < 0) return ''
  if (a <= 50) return '优'
  if (a <= 100) return '良'
  if (a <= 150) return '轻度'
  if (a <= 200) return '中度'
  if (a <= 300) return '重度'
  return '严重'
})
const aqiColor = computed(() => {
  const a = store.current.aqi
  if (a < 0) return 'transparent'
  if (a <= 50) return '#34c759'
  if (a <= 100) return '#ffd60a'
  if (a <= 150) return '#ff9500'
  if (a <= 200) return '#ff3b30'
  if (a <= 300) return '#af52de'
  return '#7d2a2a'
})
onMounted(() => { store.load() })
</script>
```

（原文件 `<style scoped>` 块 L174-206 全部保留不动。）

- [ ] **Step 2: 构建验证**

Run: `cd /www/wwwhdd/cloudpan/web && npm run build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
cd /www/wwwhdd/cloudpan && git add web/src/themes/windows/widgets/WxCard.vue && git commit -m "refactor(web): 小组件天气卡接入共享 weather store（城市全局同步，去重复请求）"
```

---

### Task 7: 完整构建 + 部署 + browser-use GUI 验证

**Files:**
- 无代码改动；产出 `docs/test-evidence/t39*.png … t43*.png` 与验证结论。

**Interfaces:**
- Consumes: Task 1-6 全部产物。

- [ ] **Step 1: 完整构建（前端 → 嵌入 → 后端）**

```bash
cd /www/wwwhdd/cloudpan && ./build.sh
```
Expected: 末尾 `BUILD OK: server/cloudpan`。

- [ ] **Step 2: 重启 + 健康检查**

```bash
cd /www/wwwhdd/cloudpan && ./start.sh restart
sleep 3 && curl -s -o /dev/null -w "up:%{http_code}\n" https://yun.johngko.com/
grep -a "数据库类型" /tmp/cloudpan-native.log | tail -1
```
Expected: `up:200`；日志首行 `数据库类型: mysql`。

- [ ] **Step 3: 准备登录**

若当前会话没有可用的 admin 登录凭据：

```bash
cd /www/wwwhdd/cloudpan && PW=$(openssl rand -hex 8) && ./start.sh reset-admin "$PW" && echo "$PW" > /tmp/cp_admin_pw
```

⚠️ 临时密码只存在 `/tmp/cp_admin_pw` 与 shell 变量中，**不得**写入仓库文件/截图/日志汇报；验证完成后 Step 8 更换。

- [ ] **Step 4: browser-use 验证 win12 日历（t39）**

打开 `https://yun.johngko.com/`，admin 登录进入桌面。点击任务栏右侧日期胶囊（时间+日期），等待日历面板弹出。核对（对照计划头部的 2026-09 预期值）：
1. 天气条：`{emoji} {温度}° {状况} {低}~{高}° · {城市}`（北京为默认）；
2. 农历行：`丙午（马）年 八月初十`；
3. 日历格副标签：20 日蓝"班"、25/26/27 日红"中秋"、11 日灰"八月初一"、其余灰农历；
4. 20 日渐变高亮、副标签浅蓝。

截图 → `docs/test-evidence/t39-win12-datebox.png`。任一不符 → 修代码回 Task 3/4 重走 Step 1-4。

- [ ] **Step 5: browser-use 验证桌面天气卡（t40）**

关闭日历面板。核对桌面右上角 300px 中等卡片：城市"北京"、当前温度/图标/高低温、体感/风/湿度行、5 天预报（今天/明天/周三…）。然后把城市下拉切到"杭州"：
1. 卡片温度/数据应刷新为杭州；
2. 城市持久化验证：刷新页面后重新进入桌面，天气卡城市仍为"杭州"（localStorage `cp_wx_city` 生效）。
3. 点刷新按钮：图标旋转、数据保持。

截图 → `docs/test-evidence/t40-win12-wx-widget.png`（含杭州态）。

- [ ] **Step 6: 验证小组件城市同步（t41）**

点任务栏"小组件"按钮（dock 第三个）打开小组件面板。核对右栏天气卡城市 = 杭州（与桌面卡同步），逐时 8 格 + 15 天列表正常。截图 → `docs/test-evidence/t41-win12-widgets-sync.png`。把小组件里城市切回"北京"，桌面卡应同步回北京（反向同步）。

- [ ] **Step 7: 验证 macOS / Deepin 主题（t42/t43）**

打开桌面"设置"应用（SettingsApp）切换主题：
1. macOS：天气卡应位于菜单栏（24px）下方右上角、深色玻璃；截图 `t42-macos-wx-widget.png`；
2. Deepin：天气卡右上角（底部 dock 上方）、深色玻璃；截图 `t43-deepin-wx-widget.png`；
3. 各主题点开一个窗口（如文件资源管理器）拖动到右上角，确认窗口盖住天气卡（层级正确），再最小化。
切回 win12。

- [ ] **Step 8: 收尾**

1. 更换临时 admin 密码（不留后门）：`cd /www/wwwhdd/cloudpan && ./start.sh reset-admin "$(openssl rand -hex 8)" && rm -f /tmp/cp_admin_pw`；
2. 提交截图：`cd /www/wwwhdd/cloudpan && git add docs/test-evidence/t39*.png docs/test-evidence/t40*.png docs/test-evidence/t41*.png docs/test-evidence/t42*.png docs/test-evidence/t43*.png && git commit -m "test: 日历增强+桌面天气卡 GUI 证据（t39-t43，win12/macos/deepin）"`；
3. 汇报：列出验证矩阵（日历三要素/天气卡三主题/城市双向同步/层级/降级）与截图路径。

**降级验证（可选，时间允许时）**：把 `CP_TRUSTED_PROXIES` 之外的断网模拟不可行（服务器必须可达），改为在浏览器 DevTools 把 `api.open-meteo.com` 请求 block 后刷新页面：日历天气条显示"天气暂不可用"、桌面卡显示"暂无法获取天气（离线或网络不可达）+ 重试"。通过则截图 `t44-wx-offline.png`。

---

## 完成判据（对照 spec 自检）

- [ ] WinDateBox：天气条 ✓、农历行 ✓、节假日/调休/节气/传统副标签 ✓（spec §3.3）
- [ ] 天气卡：win12/macOS/deepin 三桌面右上角 ✓、中等卡片内容 ✓、城市下拉+刷新 ✓（spec §3.4）
- [ ] WxCard 与桌面卡城市双向同步、TTL 内不重复请求 ✓（spec §3.5）
- [ ] 后端/CSP 零改动 ✓（spec §4）
- [ ] 构建/重启/健康检查通过 + t39-t43 截图入库 ✓（spec §6）
