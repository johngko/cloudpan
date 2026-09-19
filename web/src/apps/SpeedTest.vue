<template>
  <!-- 网络测速（界面仿 LibreSpeed）：环形仪表 + 大数字 + 下载/上传，三主题通用（只用 token） -->
  <div class="app-root st-root">
    <div class="st-head">
      <p class="st-site">CloudPan · 本地服务器</p>
      <p class="st-sub">测量本机到服务器的网络速度</p>
    </div>

    <div class="st-body">
      <div class="st-gauge">
        <svg viewBox="0 0 220 220">
          <defs>
            <linearGradient :id="gid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="var(--theme-1)" />
              <stop offset="1" stop-color="var(--theme-2)" />
            </linearGradient>
          </defs>
          <!-- 外圈刻度（48 格，每 4 格加粗） -->
          <g v-for="i in 48" :key="i" :transform="`rotate(${(i - 0.5) * 7.5} 110 110)`">
            <line x1="110" y1="7" x2="110" :y2="i % 4 === 0 ? 15 : 12"
              :stroke="i % 4 === 0 ? 'var(--text-2)' : 'var(--text-3)'"
              :stroke-width="i % 4 === 0 ? 2 : 1" opacity="0.55" />
          </g>
          <circle cx="110" cy="110" r="88" fill="none" stroke="rgba(127,127,127,0.22)" stroke-width="9" />
          <circle v-if="prog > 0.004" cx="110" cy="110" r="88" fill="none" :stroke="`url(#${gid})`"
            stroke-width="9" stroke-linecap="round" :stroke-dasharray="CIRC"
            :stroke-dashoffset="CIRC * (1 - prog)" transform="rotate(-90 110 110)" />
        </svg>
        <div class="st-center">
          <p class="st-num">{{ numText }}</p>
          <p class="st-unit">Mbps</p>
          <p v-if="ms != null" class="st-ms">延迟 {{ ms }} ms</p>
        </div>
      </div>
    </div>

    <div class="st-btns">
      <button class="st-btn st-main" :disabled="running" @click="runFull">完整测试</button>
      <div class="st-pair">
        <button class="st-btn" :disabled="running" @click="runDown">⬇ 下载</button>
        <button class="st-btn" :disabled="running" @click="runUp">⬆ 上传</button>
      </div>
    </div>
    <p class="st-status">{{ status }}</p>
    <p class="st-foot">界面仿 LibreSpeed（librespeed/speedtest）</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance, onBeforeUnmount } from 'vue'
import { speedtestApi } from '../api/modules'

const gid = 'stg' + String(getCurrentInstance()?.uid ?? 0)
const CIRC = 2 * Math.PI * 88

const num = ref(0)
const prog = ref(0)
const ms = ref<number | null>(null)
const status = ref('点击「完整测试」开始')
const running = ref(false)

let aborters: AbortController[] = []
let tickTimer: number | undefined

const numText = computed(() => {
  const v = num.value
  if (v >= 100) return String(Math.round(v))
  if (v >= 10) return v.toFixed(1)
  return v.toFixed(2)
})
const fmt = (v: number) => (v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2))

function stopTickers() {
  aborters.forEach(a => a.abort())
  aborters = []
  if (tickTimer !== undefined) { clearInterval(tickTimer); tickTimer = undefined }
}

/** RTT 中位数（10 次取中位，丢弃首次连接预热） */
async function measurePing() {
  const rts: number[] = []
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now()
    try { await fetch(speedtestApi.pingUrl(), { cache: 'no-store' }) } catch { /* 忽略单次失败 */ }
    rts.push(performance.now() - t0)
  }
  rts.shift()
  rts.sort((a, b) => a - b)
  const med = Math.round(rts[Math.floor(rts.length / 2)])
  ms.value = med
  return med
}

async function streamDownload(bytes: { v: number }, signal: AbortSignal) {
  try {
    const res = await fetch(speedtestApi.downloadUrl(40 << 20), { cache: 'no-store', signal })
    const rd = res.body?.getReader()
    if (!rd) return
    for (;;) {
      const { done, value } = await rd.read()
      if (done) return
      if (value) bytes.v += value.byteLength
    }
  } catch { /* abort：正常停止 */ }
}

async function streamUpload(bytes: { v: number }, signal: AbortSignal) {
  const buf = makeRandom(8 << 20)
  try {
    for (;;) {
      const res = await fetch(speedtestApi.uploadUrl(), { method: 'POST', body: buf, signal })
      if (!res.ok) break
      bytes.v += buf.byteLength
    }
  } catch { /* abort：正常停止 */ }
}

function makeRandom(n: number): ArrayBuffer {
  const u8 = new Uint8Array(n)
  const CHUNK = 65536
  for (let off = 0; off < n; off += CHUNK) {
    crypto.getRandomValues(u8.subarray(off, Math.min(n, off + CHUNK)))
  }
  return u8.buffer
}

/** 并发流测速：下载 3 连接 / 上传 2 连接，固定 8s，滚动速率上仪表 */
async function measure(dir: 'down' | 'up'): Promise<number> {
  const conns = dir === 'down' ? 3 : 2
  const dur = 8000
  const acs = Array.from({ length: conns }, () => new AbortController())
  aborters = acs
  const bytes = { v: 0 }
  const t0 = performance.now()
  let ema = 0
  let lastBytes = 0
  let lastT = t0
  tickTimer = window.setInterval(() => {
    const t = performance.now()
    const dt = Math.max(1, t - lastT) / 1000
    const rate = (bytes.v - lastBytes) * 8 / dt / 1e6
    lastBytes = bytes.v; lastT = t
    ema = ema === 0 ? rate : ema * 0.75 + rate * 0.25
    num.value = Math.max(0, ema)
    prog.value = Math.min(1, (t - t0) / dur)
  }, 150)

  const jobs = acs.map(ac => dir === 'down' ? streamDownload(bytes, ac.signal) : streamUpload(bytes, ac.signal))
  await Promise.race([
    Promise.allSettled(jobs),
    new Promise(r => setTimeout(r, dur))
  ])
  stopTickers()
  const elapsed = (performance.now() - t0) / 1000
  const final = bytes.v > 0 ? bytes.v * 8 / elapsed / 1e6 : 0
  num.value = final
  prog.value = 1
  return final
}

async function guard(fn: () => Promise<void>) {
  if (running.value) return
  running.value = true
  try { await fn() } catch { status.value = '测试失败，请检查网络' } finally {
    stopTickers()
    running.value = false
  }
}

function runDown() {
  guard(async () => {
    status.value = '正在测试下载速度…'
    await measure('down')
    status.value = `下载 ${fmt(num.value)} Mbps`
  })
}
function runUp() {
  guard(async () => {
    status.value = '正在测试上传速度…'
    await measure('up')
    status.value = `上传 ${fmt(num.value)} Mbps`
  })
}
function runFull() {
  guard(async () => {
    status.value = '正在测量延迟…'
    prog.value = 0
    await measurePing()
    status.value = '正在测试下载速度…'
    const down = await measure('down')
    status.value = '正在测试上传速度…'
    const up = await measure('up')
    status.value = `下载 ${fmt(down)} Mbps · 上传 ${fmt(up)} Mbps · 延迟 ${ms.value} ms`
  })
}

onBeforeUnmount(stopTickers)
</script>

<style scoped>
.st-root { overflow: hidden; align-items: center; }
.st-head { flex: none; text-align: center; padding: 18px 16px 0; }
.st-site { font-size: 15px; font-weight: 600; margin: 0; }
.st-sub { font-size: 12px; color: var(--text-3); margin: 4px 0 0; }
.st-body { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.st-gauge { position: relative; width: min(280px, 72vw); height: min(280px, 72vw); flex: none; }
.st-gauge svg { width: 100%; height: 100%; display: block; }
.st-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.st-num { font-size: 54px; font-weight: 250; line-height: 1; letter-spacing: -1.5px; font-variant-numeric: tabular-nums; margin: 0; }
.st-unit { font-size: 14px; color: var(--text-3); margin: 6px 0 0; }
.st-ms { font-size: 13px; color: var(--text-2); margin: 12px 0 0; }
.st-btns { flex: none; display: flex; flex-direction: column; gap: 10px; width: min(280px, 80vw); padding: 0 16px; }
.st-btn {
  border: none; border-radius: 999px; padding: 11px 0; font-size: 14px; cursor: pointer;
  background: transparent; color: var(--text); border: 1px solid var(--stroke);
  font-family: inherit; transition: background 0.15s, filter 0.15s;
}
.st-btn:hover { background: var(--hover-b); }
.st-btn:disabled { opacity: 0.45; cursor: default; }
.st-main { background: var(--theme-2); border-color: transparent; color: #fff; font-weight: 600; }
.st-main:hover { background: var(--theme-2); filter: brightness(1.08); }
.st-pair { display: flex; gap: 10px; }
.st-pair .st-btn { flex: 1; }
.st-status { flex: none; text-align: center; font-size: 12.5px; color: var(--text-2); padding: 12px 20px 0; min-height: 18px; }
.st-foot { flex: none; text-align: center; font-size: 11px; color: var(--text-3); padding: 8px 16px 14px; opacity: 0.75; }
</style>
