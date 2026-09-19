<template>
  <div class="app-root" style="padding: 10px">
    <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 14px 16px; text-align: right; margin-bottom: 10px">
      <div style="font-size: 12px; color: var(--text-3); height: 16px">{{ expr || ' ' }}</div>
      <div style="font-size: 30px; font-weight: 300; overflow: hidden">{{ display }}</div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; flex: 1">
      <button v-for="k in keys" :key="k.k" class="btn" :class="k.cls" style="font-size: 16px; padding: 0"
        @click="press(k.k)">{{ k.k }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const display = ref('0')
const expr = ref('')
let cur = '0'
let acc: number | null = null
let op = ''

const keys = [
  { k: 'C', cls: '' }, { k: 'CE', cls: '' }, { k: '←', cls: '' }, { k: '÷', cls: 'primary' },
  { k: '7', cls: '' }, { k: '8', cls: '' }, { k: '9', cls: '' }, { k: '×', cls: 'primary' },
  { k: '4', cls: '' }, { k: '5', cls: '' }, { k: '6', cls: '' }, { k: '−', cls: 'primary' },
  { k: '1', cls: '' }, { k: '2', cls: '' }, { k: '3', cls: '' }, { k: '+', cls: 'primary' },
  { k: '±', cls: '' }, { k: '0', cls: '' }, { k: '.', cls: '' }, { k: '=', cls: 'primary' }
]

function press(k: string) {
  if (k >= '0' && k <= '9') {
    cur = cur === '0' ? k : cur + k
  } else if (k === '.') {
    if (!cur.includes('.')) cur += '.'
  } else if (k === 'C') { cur = '0'; acc = null; op = ''; expr.value = '' }
  else if (k === 'CE') { cur = '0' }
  else if (k === '←') { cur = cur.length > 1 ? cur.slice(0, -1) : '0' }
  else if (k === '±') { cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur }
  else if (['+', '−', '×', '÷'].includes(k)) {
    if (acc !== null && op) apply()
    else acc = parseFloat(cur)
    op = k
    expr.value = `${acc} ${k}`
    cur = '0'
    return
  } else if (k === '=') {
    if (acc !== null && op) { expr.value = ''; apply() }
    return
  }
  display.value = cur
}

function apply() {
  const b = parseFloat(cur)
  let r = 0
  if (op === '+') r = acc! + b
  if (op === '−') r = acc! - b
  if (op === '×') r = acc! * b
  if (op === '÷') r = b === 0 ? NaN : acc! / b
  if (isNaN(r)) { display.value = '无法除以零'; cur = '0'; acc = null; op = ''; return }
  cur = String(+r.toFixed(10))
  display.value = cur
  acc = null
  op = ''
}
</script>
