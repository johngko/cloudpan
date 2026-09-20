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
