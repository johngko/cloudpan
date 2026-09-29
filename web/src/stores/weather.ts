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

/** Open-Meteo 预报端点：只声明用到的那几项字段（字段名来自接口返回，非猜测）。
 *  外层可选（请求参数不同可能整块缺省），内层数组必给；缺省一律有兜底值。 */
interface MeteoForecast {
  current?: {
    temperature_2m?: number; apparent_temperature?: number; weather_code?: number
    wind_speed_10m?: number; wind_direction_10m?: number; relative_humidity_2m?: number
  }
  hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] }
  daily?: {
    time: string[]; weather_code: number[]
    temperature_2m_max: number[]; temperature_2m_min: number[]
    precipitation_probability_max?: (number | null)[]
  }
}
/** Open-Meteo 空气质量端点：只用 current.us_aqi */
interface MeteoAir { current?: { us_aqi?: number } }

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
      const j = (await r.json()) as MeteoForecast
      if (seq !== reqSeq) return
      const cur: MeteoForecast['current'] = j.current ?? {}
      const code = Number(cur.weather_code ?? -1)
      // 逐时：从当前整点起取 8 格
      const hNow = new Date().getHours()
      const hourly = j.hourly
      const hTimes: string[] = hourly?.time || []
      const start = hTimes.findIndex(t => Number((t.split('T')[1] || '0:0').split(':')[0]) >= hNow)
      const hs: WxHour[] = []
      for (let i = Math.max(0, start); i < Math.max(0, start) + 8 && i < hTimes.length; i++) {
        const hh = Number((hTimes[i].split('T')[1] || '0:0').split(':')[0])
        hs.push({ t: String(hh).padStart(2, '0') + ':00', d: Math.round(Number(hourly?.temperature_2m[i] ?? 0)), icon: wmoIcon(Number(hourly?.weather_code[i] ?? -1), hh) })
      }
      // 15 天：今天/明天/周X
      const ds: WxDay[] = []
      const daily = j.daily
      const dTimes: string[] = daily?.time || []
      for (let i = 0; i < dTimes.length; i++) {
        const dt = new Date(dTimes[i] + 'T12:00:00')
        const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()]
        const p = daily?.precipitation_probability_max?.[i]
        ds.push({
          date: dTimes[i],
          label: i === 0 ? '今天' : i === 1 ? '明天' : wd,
          icon: wmoIcon(Number(daily?.weather_code[i] ?? -1)),
          p: p != null ? Math.round(Number(p)) : null,
          lo: Math.round(Number(daily?.temperature_2m_min[i] ?? 0)),
          hi: Math.round(Number(daily?.temperature_2m_max[i] ?? 0))
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
        const aj = (await ar.json()) as MeteoAir
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
