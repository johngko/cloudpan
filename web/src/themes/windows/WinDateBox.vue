<template>
  <!-- win12-online #datebox 1:1：350×450，35px 时钟 + 日期 + 周一始日历（今日渐变高亮） -->
  <div class="w12-panel w12-datebox show-begin" :class="{ show: shown }" :style="{ left: left + 'px' }" @click.stop>
    <div class="w12-db-tit">
      <p class="w12-db-time">{{ time }}</p>
      <p class="w12-db-date">{{ dateFull }}</p>
      <hr class="w12-db-hr" />
    </div>
    <div class="w12-db-cont">
      <div class="w12-db-head"><p>一</p><p>二</p><p>三</p><p>四</p><p>五</p><p>六</p><p>日</p></div>
      <div class="w12-db-body">
        <span v-for="i in offset" :key="'e' + i"></span>
        <p v-for="d in days" :key="d" :class="{ today: d === today }">{{ d }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps<{ shown: boolean; left?: number }>()
const now = ref(new Date())
const timer = window.setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => window.clearInterval(timer))

const time = computed(() => now.value.toTimeString().slice(0, 8))
const dateFull = computed(() => {
  const d = now.value
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${'日一二三四五六'[d.getDay()]}`
})
const today = computed(() => now.value.getDate())
const days = computed(() => new Date(now.value.getFullYear(), now.value.getMonth() + 1, 0).getDate())
// 周一始偏移（标准公式；演示站的公式在 JS 负取模下某些月份会错位）
const offset = computed(() => (new Date(now.value.getFullYear(), now.value.getMonth(), 1).getDay() + 6) % 7)
</script>
