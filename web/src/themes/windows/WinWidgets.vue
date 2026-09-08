<template>
  <!-- win12-online #widgets 1:1：1000×600 双栏（左=小组件计算器，右=新闻/关于） -->
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
        <p class="tit">新闻</p>
        <span style="color: #7f7f7f; font-size: 12px">我们不对新闻内容负责</span>
      </div>
      <div class="w12-wg-content">
        <div class="w12-news-card">
          <div class="bg"><img src="/icons/win12/logo.svg" style="object-fit: contain; background: radial-gradient(circle at 50% 40%, #24304d, #0a0e1a 75%)" /></div>
          <p class="tit">CloudPan · 私有云存储</p>
          <p class="sub">Go + Vue 全栈，三主题 Web 桌面</p>
          <a class="a" href="https://github.com/win12-online/win12" target="_blank" rel="noopener">此主题 1:1 仿制自 win12-online/win12（EPL-2.0）</a>
        </div>
        <div class="w12-news-card">
          <div class="bg"><img src="/icons/win12/windows12.svg" style="object-fit: contain; background: radial-gradient(circle at 50% 40%, #3a2450, #0d0a18 75%)" /></div>
          <p class="tit">Windows 12 风格外壳</p>
          <p class="sub">浮动 Dock · 双栏开始菜单 · 控制中心 · 小组件</p>
          <a class="a" @click="emit('close')">关闭面板</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const props = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

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
