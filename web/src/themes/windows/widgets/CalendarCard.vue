<template>
  <div class="wg-card wg-item wg-cal">
    <div class="cal-head">
      <span class="cal-title">{{ ym.y }}年{{ ym.m }}月</span>
      <span class="cal-nav">
        <button @click="shift(-1)" title="上个月">‹</button>
        <button @click="goToday">今天</button>
        <button @click="shift(1)" title="下个月">›</button>
      </span>
    </div>
    <div class="cal-grid cal-week">
      <span v-for="wd in ['日', '一', '二', '三', '四', '五', '六']" :key="wd" :class="{ we: wd === '日' || wd === '六' }">{{ wd }}</span>
    </div>
    <div class="cal-grid" :key="ym.y * 12 + ym.m">
      <div v-for="(c, i) in cells" :key="i" class="cal-cell"
        :class="{ out: c.out, today: c.isToday, weekend: c.info.isWeekend && !c.out }"
        :title="c.isToday ? '今天' : c.info.label ? (c.info.label + (c.info.labelKind === 'work' ? '（调休上班）' : '')) : '农历' + c.info.lunarShort">
        <span class="cal-solar">{{ c.d }}</span>
        <span class="cal-lunar" :class="{ [c.info.labelKind]: !!c.info.labelKind }">{{
          c.out ? c.info.lunarShort
          : c.info.labelKind === 'work' ? '班'
          : c.info.label || (c.info.d === 1 ? '初一' : c.info.lunarShort)
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { dayInfo, type DayInfo } from '../../../utils/lunar'

const t = new Date()
const ym = ref({ y: t.getFullYear(), m: t.getMonth() + 1 })
function shift(delta: number) {
  const d = new Date(ym.value.y, ym.value.m - 1 + delta, 1)
  ym.value = { y: d.getFullYear(), m: d.getMonth() + 1 }
}
function goToday() {
  const d = new Date()
  ym.value = { y: d.getFullYear(), m: d.getMonth() + 1 }
}

const cells = computed(() => {
  const { y, m } = ym.value
  const first = new Date(y, m - 1, 1)
  const startWd = first.getDay()
  const daysIn = new Date(y, m, 0).getDate()
  const prevDays = new Date(y, m - 1, 0).getDate()
  const ty = t.getFullYear(), tm = t.getMonth() + 1, td = t.getDate()
  const out: { out: boolean; d: number; info: DayInfo; isToday: boolean }[] = []
  for (let i = startWd; i >= 1; i--) {
    const d = prevDays - i + 1
    out.push({ out: true, d, info: dayInfo(new Date(y, m - 2, d)), isToday: false })
  }
  for (let d = 1; d <= daysIn; d++) {
    const info = dayInfo(new Date(y, m - 1, d))
    out.push({ out: false, d, info, isToday: d === td && m === tm && y === ty })
  }
  let nd = 1
  while (out.length < 42) {
    out.push({ out: true, d: nd, info: dayInfo(new Date(y, m, nd)), isToday: false })
    nd++
  }
  return out
})
</script>

<style scoped>
.cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px }
.cal-title { font-size: 13px; font-weight: 600; color: #1b1b1f }
.cal-nav { display: flex; gap: 4px }
.cal-nav button {
  border: none; background: rgba(0, 0, 0, 0.06); color: #445; border-radius: 6px;
  font-size: 11px; padding: 2px 8px; cursor: pointer; transition: background 0.15s;
}
.cal-nav button:hover { background: rgba(47, 134, 214, 0.18) }
.cal-nav button:active { transform: scale(0.95) }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px }
.cal-week { margin-bottom: 3px }
.cal-week span {
  text-align: center; font-size: 11px; color: #889; padding: 2px 0;
}
.cal-week span.we { color: #d65a4a }
.cal-grid > .cal-cell { animation: cal-in 0.2s ease both }
@keyframes cal-in { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: none } }
.cal-cell {
  border-radius: 8px; padding: 3px 2px 2px; text-align: center; cursor: default;
  transition: background 0.15s;
}
.cal-cell:hover { background: rgba(47, 134, 214, 0.1) }
.cal-solar { display: block; font-size: 12.5px; color: #2b2b30; font-weight: 500; line-height: 1.25 }
.cal-cell.weekend .cal-solar { color: #d65a4a }
.cal-cell.out { opacity: 0.38 }
.cal-lunar {
  display: block; font-size: 10px; color: #889; line-height: 1.25;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cal-lunar.holiday { color: #d65a4a; font-weight: 600 }
.cal-lunar.work { color: #4a7fd6; font-weight: 600 }
.cal-lunar.fest { color: #d69a4a; font-weight: 600 }
.cal-lunar.jieqi { color: #5a9a5a; font-weight: 600 }
.cal-cell.today { background: #2f86d6 }
.cal-cell.today .cal-solar { color: #fff }
.cal-cell.today .cal-lunar { color: #dceeff }
.cal-cell.today:hover { background: #2f86d6 }
</style>
