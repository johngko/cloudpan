<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" @click="reload" title="重新加载">
        <AppIcon name="refresh" :size="15" />
      </button>
      <button class="tool-btn" @click="openTab" title="在新标签页打开（可全屏/打印）">
        <AppIcon name="expand" :size="15" />
      </button>
      <div class="tool-sep"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ fileName }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ status }}</span>
    </div>
    <div v-if="!loaded" style="flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-3); font-size: 13px">
      正在加载 PDF 阅读器…
    </div>
    <iframe v-show="loaded" ref="frame" style="flex: 1; width: 100%; border: none; background: #525659"
      :src="viewerSrc" @load="onLoad"></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { rawUrl } from '../api/modules'
import AppIcon from '../components/AppIcon.vue'

// PDF 阅读器（pdf.js，vendored 到 /vendor/pdfjs/）：
// 同源 iframe 加载官方 viewer，?file=<raw 直链> 同域直读，零胶水代码，
// 自带目录/搜索/缩放/旋转/打印/全屏。
const props = defineProps<{ winId: number; props: any }>()

const policyId = ref(props.props?.policyId || 0)
const path = ref(props.props?.path || '')
const fileName = computed(() => (path.value || '未命名').split('/').pop() || '未命名')
const bust = ref(0)
const loaded = ref(false)
const status = ref('加载中')

const frame = ref<HTMLIFrameElement>()
const viewerSrc = computed(() =>
  '/vendor/pdfjs/web/viewer.html?file=' + encodeURIComponent(rawUrl(policyId.value, path.value)) + (bust.value ? `&_r=${bust.value}` : ''))

function onLoad() {
  // pdf.js 渲染是异步的：iframe load 只表示 viewer 壳加载完，
  // 用短延时标记就绪（canvas 出现即已可用，无需精确探测）
  status.value = '已就绪'
  loaded.value = true
}
function reload() {
  loaded.value = false
  status.value = '加载中'
  bust.value++
}
function openTab() {
  window.open(viewerSrc.value, '_blank')
}
</script>
