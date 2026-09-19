<template>
  <div class="wg-card wg-item wg-wx">
    <p class="wg-tit">天气
      <span class="wx-right">
        <button class="wx-refresh" title="刷新" @click="load()"><AppIcon name="refresh" :size="12" /></button>
        <select class="wg-city" v-model="city" title="选择城市">
          <option v-for="c in cities" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
      </span>
    </p>
    <!-- 当前：大字号温度 + 状况 + 空气质量（iOS 天气卡片式） -->
    <template v-if="wx.ok">
      <div class="wx-now">
        <span class="wx-icon">{{ wx.icon }}</span>
        <div class="wx-nowmain">
          <div class="wx-temp">{{ wx.temp }}°<span v-if="wx.high != null"> / {{ wx.low }}~{{ wx.high }}°</span></div>
          <div class="wx-cond">{{ wx.desc }}
            <span v-if="wx.aqi >= 0" class="wx-aqi" :style="{ background: aqiColor }">AQI {{ wx.aqi }} {{ aqiLabel }}</span>
          </div>
          <div class="wx-sub">体感 {{ wx.feels }}° · 风{{ wx.windDir }} {{ wx.wind }} km/h · 湿度 {{ wx.humidity }}%</div>
        </div>
      </div>
      <!-- 逐时（未来 8 小时） -->
      <div class="wx-hourly">
        <div v-for="h in wx.hours" :key="h.t" class="wx-h">
          <span class="wx-ht">{{ h.t }}</span>
          <span class="wx-hi">{{ h.icon }}</span>
          <span class="wx-hd">{{ h.d }}°</span>
        </div>
      </div>
      <!-- 15 天预报 -->
      <div class="wx-days">
        <div v-for="day in wx.days" :key="day.date" class="wx-day">
          <span class="wx-dl">{{ day.label }}</span>
          <span class="wx-di">{{ day.icon }}</span>
          <span class="wx-dp" v-if="day.p != null">{{ day.p }}%</span>
          <span class="wx-dt"><span class="lo">{{ day.lo }}°</span>~{{ day.hi }}°</span>
        </div>
      </div>
    </template>
    <p class="wg-empty" v-else>{{ wx.err || '获取中…' }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AppIcon from '../../../components/AppIcon.vue'

// Open-Meteo 免费无 key：当前 + 逐时 + 15 天一次取回；空气质量走独立端点（失败仅隐藏）
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
const WMO: Record<number, string> = { 0: '晴', 1: '大致晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪', 95: '雷雨', 96: '雷雨冰雹', 99: '雷雨冰雹' }
function wmoIcon(code: number, hour?: number): string {
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
const WIND8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

interface WxState {
  ok: boolean; err: string
  temp: number; feels: number; desc: string; icon: string
  wind: number; windDir: string; humidity: number
  aqi: number; high: number | null; low: number | null
  hours: { t: string; d: number; icon: string }[]
  days: { date: string; label: string; icon: string; p: number | null; lo: number; hi: number }[]
}
const EMPTY: WxState = { ok: false, err: '', temp: 0, feels: 0, desc: '', icon: '', wind: 0, windDir: '', humidity: 0, aqi: -1, high: null, low: null, hours: [], days: [] }
const wx = ref<WxState>({ ...EMPTY, err: '获取中…' })

const aqiLabel = computed(() => {
  const a = wx.value.aqi
  if (a < 0) return ''
  if (a <= 50) return '优'
  if (a <= 100) return '良'
  if (a <= 150) return '轻度'
  if (a <= 200) return '中度'
  if (a <= 300) return '重度'
  return '严重'
})
const aqiColor = computed(() => {
  const a = wx.value.aqi
  if (a < 0) return 'transparent'
  if (a <= 50) return '#34c759'
  if (a <= 100) return '#ffd60a'
  if (a <= 150) return '#ff9500'
  if (a <= 200) return '#ff3b30'
  if (a <= 300) return '#af52de'
  return '#7d2a2a'
})

let reqSeq = 0
async function load() {
  const c = cities.find(x => x.name === city.value) || cities[0]
  const seq = ++reqSeq
  if (!wx.value.err || wx.value.err === '获取中…') wx.value = { ...EMPTY, err: '获取中…' }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&timezone=auto`
      + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m'
      + '&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=15'
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const j: any = await r.json()
    if (seq !== reqSeq) return
    const cur = j.current || {}
    const code = Number(cur.weather_code ?? -1)
    const dirDeg = Number(cur.wind_direction_10m ?? 0)
    // 逐时：从当前整点起取 8 格
    const hNow = new Date().getHours()
    const hTimes: string[] = j.hourly?.time || []
    const start = hTimes.findIndex(t => { const h = Number((t.split('T')[1] || '0:0').split(':')[0]); return h >= hNow })
    const hs: WxState['hours'] = []
    for (let i = (start < 0 ? 0 : start); i < (start < 0 ? 0 : start) + 8 && i < hTimes.length; i++) {
      const hh = Number((hTimes[i].split('T')[1] || '0:0').split(':')[0])
      hs.push({ t: String(hh).padStart(2, '0') + ':00', d: Math.round(Number(j.hourly.temperature_2m[i])), icon: wmoIcon(Number(j.hourly.weather_code[i]), hh) })
    }
    // 15 天：今天/明天/周X
    const ds: WxState['days'] = []
    const dTimes: string[] = j.daily?.time || []
    for (let i = 0; i < dTimes.length; i++) {
      const dt = new Date(dTimes[i] + 'T12:00:00')
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()]
      ds.push({
        date: dTimes[i],
        label: i === 0 ? '今天' : i === 1 ? '明天' : `${wd}`,
        icon: wmoIcon(Number(j.daily.weather_code[i])),
        p: j.daily.precipitation_probability_max?.[i] != null ? Math.round(Number(j.daily.precipitation_probability_max[i])) : null,
        lo: Math.round(Number(j.daily.temperature_2m_min[i])),
        hi: Math.round(Number(j.daily.temperature_2m_max[i]))
      })
    }
    wx.value = {
      ok: true, err: '',
      temp: Math.round(Number(cur.temperature_2m ?? 0)),
      feels: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)),
      desc: WMO[code] ?? '未知',
      icon: wmoIcon(code),
      wind: Math.round(Number(cur.wind_speed_10m ?? 0)),
      windDir: WIND8[Math.round(dirDeg / 45) % 8],
      humidity: Math.round(Number(cur.relative_humidity_2m ?? 0)),
      aqi: -1,
      high: ds.length ? ds[0].hi : null,
      low: ds.length ? ds[0].lo : null,
      hours: hs, days: ds
    }
    // 空气质量：独立端点，失败仅隐藏（不阻塞主数据）
    try {
      const ar = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&current=us_aqi`, { signal: AbortSignal.timeout(8000) })
      const aj: any = await ar.json()
      if (seq === reqSeq && aj.current?.us_aqi != null) wx.value.aqi = Math.round(Number(aj.current.us_aqi))
    } catch { /* AQI 不可用则隐藏 */ }
  } catch {
    if (seq === reqSeq) wx.value = { ...EMPTY, err: '暂无法获取天气（离线或网络不可达）' }
  }
}
watch(city, (v) => { localStorage.setItem('cp_wx_city', v); load() })
onMounted(load)
</script>

<style scoped>
.wx-right { margin-left: auto; display: flex; align-items: center; gap: 6px }
.wx-refresh {
  border: none; background: rgba(0, 0, 0, 0.06); border-radius: 6px; width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #556;
  transition: background 0.15s, transform 0.3s;
}
.wx-refresh:hover { background: rgba(47, 134, 214, 0.18) }
.wx-refresh:active { transform: rotate(180deg) }
.wx-now { display: flex; align-items: center; gap: 12px; margin-bottom: 10px }
.wx-icon { font-size: 40px; line-height: 1 }
.wx-temp { font-size: 30px; font-weight: 250; color: #1b1b1f; line-height: 1.15 }
.wx-temp span { font-size: 13px; color: #778; font-weight: 400 }
.wx-cond { font-size: 12.5px; color: #445; margin-top: 2px; display: flex; align-items: center; gap: 6px }
.wx-aqi { font-size: 10.5px; color: #1b1b1f; border-radius: 999px; padding: 1px 8px; font-weight: 600 }
.wx-sub { font-size: 11.5px; color: #889; margin-top: 3px }
.wx-hourly {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
  border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 8px; margin-bottom: 8px;
}
.wx-h { display: flex; flex-direction: column; align-items: center; gap: 3px }
.wx-ht { font-size: 10.5px; color: #889 }
.wx-hi { font-size: 17px; line-height: 1.1 }
.wx-hd { font-size: 12px; color: #2b2b30; font-weight: 500 }
.wx-days { border-top: 1px solid rgba(0, 0, 0, 0.06); padding-top: 6px; max-height: 236px; overflow: auto }
.wx-day { display: grid; grid-template-columns: 44px 26px 40px 1fr; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 6px; transition: background 0.12s }
.wx-day:hover { background: rgba(47, 134, 214, 0.08) }
.wx-dl { font-size: 12px; color: #2b2b30 }
.wx-di { font-size: 16px; text-align: center }
.wx-dp { font-size: 11px; color: #4a90d9; text-align: center }
.wx-dt { font-size: 12px; color: #2b2b30; text-align: right }
.wx-dt .lo { color: #99a }
</style>
