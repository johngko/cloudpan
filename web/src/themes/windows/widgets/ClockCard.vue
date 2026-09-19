<template>
  <div class="wg-card wg-item wg-clock">
    <div class="clk-digital">
      <div class="clk-time">
        {{ hh }}:{{ mm }}<span class="clk-sec">{{ ss }}</span>
      </div>
      <div class="clk-date">{{ WEEKDAYS_CN[today.weekday] ? '星期' + WEEKDAYS_CN[today.weekday] : '' }}，{{ today.y }}年{{ today.m }}月{{ today.d }}日</div>
      <div class="clk-lunar">
        <span>{{ today.ganzhi }} · 农历{{ today.lunarShort }}</span>
        <span v-if="today.label" class="clk-fest" :class="today.labelKind">{{ today.label }}</span>
      </div>
    </div>
    <!-- 指针钟：秒针平滑扫动（CSS 过渡对齐到秒边界） -->
    <svg class="clk-analog" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="47" class="ca-face" />
      <g class="ca-ticks">
        <line v-for="i in 12" :key="i" x1="50" y1="6" x2="50" y2="11"
          :transform="`rotate(${i * 30} 50 50)`" class="ca-tick" />
      </g>
      <line x1="50" y1="50" x2="50" y2="28" class="ca-hand ca-hour" :transform="`rotate(${hourDeg} 50 50)`" />
      <line x1="50" y1="50" x2="50" y2="16" class="ca-hand ca-min" :transform="`rotate(${minDeg} 50 50)`" />
      <line x1="50" y1="56" x2="50" y2="14" class="ca-hand ca-sec" :transform="`rotate(${secDeg} 50 50)`" />
      <circle cx="50" cy="50" r="2.4" class="ca-pin" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { dayInfo, WEEKDAYS_CN, type DayInfo } from '../../../utils/lunar'

const now = ref(new Date())
let timer = 0
onMounted(() => {
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const today = computed<DayInfo>(() => dayInfo(now.value))
const pad = (n: number) => String(n).padStart(2, '0')
const hh = computed(() => pad(now.value.getHours()))
const mm = computed(() => pad(now.value.getMinutes()))
const ss = computed(() => pad(now.value.getSeconds()))
const hourDeg = computed(() => (now.value.getHours() % 12) * 30 + now.value.getMinutes() * 0.5)
const minDeg = computed(() => now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1)
const secDeg = computed(() => now.value.getSeconds() * 6)
</script>

<style scoped>
.wg-clock { display: flex; align-items: center; gap: 14px }
.clk-time { font-size: 34px; font-weight: 250; color: #1b1b1f; letter-spacing: 1px; line-height: 1.1 }
.clk-sec { font-size: 15px; color: #889; margin-left: 4px; font-weight: 400 }
.clk-date { font-size: 12px; color: #445; margin-top: 6px }
.clk-lunar { font-size: 12px; color: #667; margin-top: 3px; display: flex; align-items: center; gap: 6px }
.clk-fest { font-size: 11px; padding: 1px 7px; border-radius: 999px; color: #fff; background: #d65a4a }
.clk-fest.work { background: #5a8fd6 }
.clk-fest.fest { background: #d69a4a }
.clk-fest.jieqi { background: #6aa86a }
.clk-analog { width: 74px; height: 74px; flex: none }
.ca-face { fill: rgba(255, 255, 255, 0.85); stroke: rgba(0, 0, 0, 0.12); stroke-width: 1 }
.ca-tick { stroke: rgba(0, 0, 0, 0.35); stroke-width: 1.6 }
.ca-hand { stroke-linecap: round }
.ca-hour { stroke: #2b2b30; stroke-width: 4 }
.ca-min { stroke: #2b2b30; stroke-width: 2.6 }
.ca-sec { stroke: #d65a4a; stroke-width: 1.2 }
.ca-pin { fill: #d65a4a }
</style>
