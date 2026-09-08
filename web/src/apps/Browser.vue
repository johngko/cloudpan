<template>
  <div class="app-root bsr-root">
    <!-- 标签页条 -->
    <div class="bsr-tabs">
      <div v-for="t in tabs" :key="t.id" class="bsr-tab" :class="{ on: t.id === activeId }"
        @click="activeId = t.id">
        <span class="bsr-tab-url">{{ t.url ? hostOf(t.url) : '新标签页' }}</span>
        <button v-if="tabs.length > 1" class="bsr-tab-x" title="关闭标签页" @click.stop="closeTab(t.id)">
          <svg width="10" height="10" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <button class="bsr-tab-add" title="新建标签页" @click="addTab">
        <svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>

    <!-- 工具栏 -->
    <div class="bsr-toolbar">
      <button class="bsr-nav" :disabled="!canBack(cur)" title="后退" @click="goBack">
        <svg width="15" height="15" viewBox="0 0 16 16"><path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="bsr-nav" :disabled="!canFwd(cur)" title="前进" @click="goFwd">
        <svg width="15" height="15" viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="bsr-nav" title="刷新" @click="reload">
        <svg width="15" height="15" viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.8v2.4h-2.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="bsr-nav" title="主页" @click="goHome">
        <svg width="15" height="15" viewBox="0 0 16 16"><path d="M2.8 8.2L8 3.4l5.2 4.8M4.4 7.4v5h7.2v-5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="bsr-addr">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="bsr-addr-ico"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2"/></svg>
        <input type="text" v-model="cur.input" spellcheck="false" :placeholder="'输入网址或搜索，回车访问（当前经服务端代理加载）'"
          @keydown.enter="go(cur)" />
      </div>
      <button class="bsr-btn" title="在系统浏览器中打开（代理加载失败时可用）" @click="openExternal">
        <svg width="14" height="14" viewBox="0 0 16 16"><path d="M6.5 3.5H3v9.5h9.5V9.5M9.5 3H13v3.5M13 3L7.5 8.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-if="cur.loading" class="bsr-spin"></div>
    </div>

    <!-- 页面区：每个标签页一个 iframe（sandbox 隔离：无 allow-same-origin，
         站点 JS 拿不到本站 Cookie/localStorage；资源经代理 ?pt= 票据鉴权） -->
    <div class="bsr-pages">
      <template v-for="t in tabs" :key="t.id">
        <div v-show="t.id === activeId" class="bsr-page">
          <!-- 主页（新标签页） -->
          <div v-if="!t.url" class="bsr-home">
            <div class="bsr-home-logo">
              <AppIcon name="browser" :size="44" />
            </div>
            <div class="bsr-home-title">CloudPan 浏览器</div>
            <div class="bsr-home-search">
              <input type="text" v-model="t.input" placeholder="输入网址或搜索关键词，回车访问" @keydown.enter="go(t)" />
            </div>
            <div class="bsr-home-links">
              <a v-for="s in quickSites" :key="s.name" class="bsr-home-link" @click.prevent="goUrl(t, s.url)">
                <span class="dot" :style="{ background: s.color }"></span>{{ s.name }}
              </a>
            </div>
            <div class="bsr-home-tip">页面经服务端代理加载（仅 GET）；登录类站点、复杂单页应用可能无法完全工作，可点工具栏「在系统浏览器中打开」</div>
          </div>
          <iframe v-else :key="t.id + ':' + t.srcTick" :src="t.src" class="bsr-frame"
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            referrerpolicy="no-referrer"
            @load="t.loading = false" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { browserApi } from '../api/modules'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()

// ---- 标签页状态 ----
interface BsrTab {
  id: number
  url: string        // 当前显示的绝对 URL（'' = 主页）
  input: string      // 地址栏文本
  src: string        // iframe 实际 src（代理路径）
  srcTick: number    // 变化即重建 iframe（刷新/前进后退）
  hist: string[]     // 历史栈（绝对 URL）
  hi: number         // 历史指针
  loading: boolean
}
let nextTab = 1
const tabs = ref<BsrTab[]>([newTab()])
const activeId = ref(1)
const cur = computed(() => tabs.value.find(t => t.id === activeId.value)!)

function newTab(): BsrTab {
  return { id: nextTab++, url: '', input: '', src: '', srcTick: 0, hist: [], hi: -1, loading: false }
}

// ---- 代理票据 pt（30 分钟有效；iframe 子资源靠它鉴权，不能放真实 JWT） ----
let pt = ''
let ptAt = 0
async function ensurePt(force = false) {
  if (!force && pt && Date.now() - ptAt < 25 * 60 * 1000) return
  const r = await browserApi.session()
  pt = r.pt
  ptAt = Date.now()
}

// 周期刷新票据：临近过期时换新并重载当前页（重写后的链接里带的是旧 pt）
let timer: any
onMounted(async () => {
  try { await ensurePt(true) } catch { /* 未登录/功能停用：页面加载会失败，工具栏按钮兜底 */ }
  timer = setInterval(async () => {
    if (!pt || Date.now() - ptAt < 25 * 60 * 1000) return
    try {
      await ensurePt(true)
      if (cur.value.url) reload()
    } catch { /* 忽略：下次再试 */ }
  }, 60 * 1000)
  // 外部深链：搜索面板「网页」→ store.open('browser', { url })
  if (props.props?.url) navigate(cur.value, props.props.url as string)
})
onBeforeUnmount(() => timer && clearInterval(timer))
watch(() => props.props?.url, v => { if (v) navigate(cur.value, v) })

// ---- 导航 ----
const quickSites = [
  { name: '百度', url: 'https://www.baidu.com', color: '#2478e8' },
  { name: '必应', url: 'https://www.bing.com', color: '#0f7c4d' },
  { name: '维基百科', url: 'https://zh.wikipedia.org', color: '#555' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com', color: '#fb7299' },
  { name: '知乎', url: 'https://www.zhihu.com', color: '#2f6fd0' },
  { name: 'GitHub', url: 'https://github.com', color: '#333' },
  { name: '掘金', url: 'https://juejin.cn', color: '#1e80ff' },
  { name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/blog/', color: '#c0392b' }
]

function normalize(input: string): string {
  const s = input.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  // 带点的裸域名 → 补 https；否则当搜索词
  if (/^[a-zA-Z0-9\u4e00-\u9fa5](?:[a-zA-Z0-9\u4e00-\u9fa5-]*[a-zA-Z0-9\u4e00-\u9fa5])?(?:\.[a-zA-Z0-9\u4e00-\u9fa5-]+)+(:\d+)?(\/.*)?$/.test(s)) {
    return 'https://' + s
  }
  return 'https://www.baidu.com/s?wd=' + encodeURIComponent(s)
}

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function proxyUrl(abs: string): string {
  return `/api/browser/p/${b64url(abs)}?pt=${encodeURIComponent(pt)}`
}

async function navigate(t: BsrTab, input: string) {
  const abs = normalize(input)
  if (!abs) return
  try { await ensurePt() } catch { return /* 票据获取失败（功能停用/未登录）：不导航 */ }
  // 截断前进栈
  t.hist = t.hist.slice(0, t.hi + 1)
  if (t.hist[t.hi] !== abs) t.hist.push(abs)
  t.hi = t.hist.length - 1
  applyNav(t)
  t.input = abs
}
function applyNav(t: BsrTab) {
  t.url = t.hist[t.hi]
  t.src = proxyUrl(t.url)
  t.input = t.url // 地址栏随前进/后退同步
  t.srcTick++
  t.loading = true
}
function go(t: BsrTab) { navigate(t, t.input || t.url) }
function goUrl(t: BsrTab, abs: string) { navigate(t, abs) }
function canBack(t: BsrTab) { return t.hi > 0 }
function canFwd(t: BsrTab) { return t.hi < t.hist.length - 1 }
function goBack() { if (cur.value.hi > 0) { cur.value.hi--; applyNav(cur.value) } }
function goFwd() { if (cur.value.hi < cur.value.hist.length - 1) { cur.value.hi++; applyNav(cur.value) } }
function reload() { const t = cur.value; if (t.url) { t.src = proxyUrl(t.url); t.srcTick++; t.loading = true } }
function goHome() { const t = cur.value; t.url = ''; t.src = ''; t.input = ''; t.srcTick++; t.hist = []; t.hi = -1 }
function openExternal() {
  const t = cur.value
  const target = t.url || normalize(t.input)
  if (target) window.open(target, '_blank')
}

function addTab() { const t = newTab(); tabs.value.push(t); activeId.value = t.id }
function closeTab(id: number) {
  const i = tabs.value.findIndex(t => t.id === id)
  if (i < 0 || tabs.value.length === 1) return
  tabs.value.splice(i, 1)
  if (activeId.value === id) activeId.value = tabs.value[Math.max(0, i - 1)].id
}

function hostOf(u: string): string {
  try { return new URL(u).hostname } catch { return u }
}
</script>

<style scoped>
.bsr-root { display: flex; flex-direction: column; height: 100%; background: var(--card); }
.bsr-tabs { display: flex; align-items: stretch; gap: 4px; padding: 6px 8px 0; flex: none; background: var(--hover-a); }
.bsr-tab { display: flex; align-items: center; gap: 6px; max-width: 190px; min-width: 90px;
  padding: 6px 8px; border-radius: 8px 8px 0 0; font-size: 12px; color: var(--text-2);
  cursor: pointer; background: transparent; border: 1px solid transparent; border-bottom: none; }
.bsr-tab.on { background: var(--card); border-color: var(--stroke); color: var(--text); }
.bsr-tab-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bsr-tab-x { border: none; background: none; color: var(--text-3); cursor: pointer; padding: 2px; border-radius: 4px; line-height: 0; }
.bsr-tab-x:hover { background: var(--hover-b); color: var(--text); }
.bsr-tab-add { border: none; background: none; color: var(--text-3); cursor: pointer; padding: 0 8px; border-radius: 6px; line-height: 0; }
.bsr-tab-add:hover { background: var(--hover-b); color: var(--text); }
.bsr-toolbar { display: flex; align-items: center; gap: 4px; padding: 7px 10px; flex: none;
  border-bottom: 1px solid var(--stroke); background: var(--card); }
.bsr-nav { width: 30px; height: 30px; border: none; border-radius: 6px; background: transparent;
  color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.bsr-nav:hover:not(:disabled) { background: var(--hover-b); color: var(--text); }
.bsr-nav:disabled { opacity: 0.35; cursor: default; }
.bsr-addr { flex: 1; display: flex; align-items: center; gap: 7px; height: 32px; padding: 0 10px;
  border-radius: 16px; background: var(--hover-a); border: 1px solid var(--stroke); }
.bsr-addr:focus-within { border-color: var(--theme-2); background: var(--card); }
.bsr-addr-ico { color: var(--text-3); flex: none; }
.bsr-addr input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: var(--text); }
.bsr-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: transparent;
  color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; flex: none; }
.bsr-btn:hover { background: var(--hover-b); color: var(--text); }
.bsr-spin { width: 14px; height: 14px; flex: none; margin-left: 2px; border-radius: 50%;
  border: 2px solid var(--stroke); border-top-color: var(--theme-2); animation: bsr-rot 0.8s linear infinite; }
@keyframes bsr-rot { to { transform: rotate(360deg); } }
.bsr-pages { flex: 1; position: relative; overflow: hidden; background: #fff; }
.bsr-page { position: absolute; inset: 0; }
.bsr-frame { width: 100%; height: 100%; border: none; display: block; }
/* 主页 */
.bsr-home { height: 100%; overflow: auto; display: flex; flex-direction: column; align-items: center;
  padding-top: 9vh; background: var(--card); }
.bsr-home-title { font-size: 20px; font-weight: 600; margin: 14px 0 18px; color: var(--text); }
.bsr-home-search { width: min(520px, 80%); }
.bsr-home-search input { width: 100%; height: 42px; border-radius: 21px; padding: 0 20px;
  border: 1px solid var(--stroke); background: var(--hover-a); font-size: 14px; color: var(--text); outline: none; }
.bsr-home-search input:focus { border-color: var(--theme-2); background: var(--bg); }
.bsr-home-links { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; width: min(520px, 80%); margin-top: 22px; }
.bsr-home-link { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 6px;
  border-radius: 10px; font-size: 13px; color: var(--text-2); cursor: pointer; border: 1px solid var(--stroke); background: var(--card); }
.bsr-home-link:hover { border-color: var(--theme-2); color: var(--text); background: var(--hover-a); }
.bsr-home-link .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.bsr-home-tip { margin-top: 26px; font-size: 11.5px; color: var(--text-3); max-width: 480px; text-align: center; line-height: 1.7; }
</style>
