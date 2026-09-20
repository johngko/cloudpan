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
