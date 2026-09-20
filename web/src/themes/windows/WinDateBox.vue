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
