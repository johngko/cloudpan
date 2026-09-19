<template>
  <div class="webapp-host">
    <iframe ref="frameEl" :src="src" style="flex:1;width:100%;height:100%;border:none;background:#fff" @load="onFrameLoad" />
  </div>
</template>

<script setup lang="ts">
// 通用 webapp 容器：承载移植的 v9os 商店插件（自包含静态 web 应用，/webapps/<code>/）。
// 与 OfficeEditor 的 PDF iframe 同先例：第一方代码，同源无 sandbox。
// 文件打开走 URL 契约（?action=open&url=<rawUrl>&ext=&name=&path=&pid=），
// 应用侧桥见 web/public/webapps/_bridge/cloudpan.js。
import { computed, ref } from 'vue'
import { rawUrl } from '../api/modules'
import { webAppSrc } from '../webapp/bridge'

const props = defineProps<{ winId: number; props: any; webapp: string }>()
const frameEl = ref<HTMLIFrameElement | null>(null)

const primary = computed(() => {
  const f = props.props || null
  return f && f.policyId && f.path ? f : null
})
// 同类文件列表（picasa 灯箱左右翻页用）：URL 契约只装得下单文件，
// 列表改走 iframe load 后的 addOpenFiles 消息通道（picasa 侧 buildItems 支持 expandFiles）
const hasList = computed(() => props.webapp === 'picasa' && Array.isArray(props.props?.list) && props.props.list.length > 0)
const src = computed(() => webAppSrc(props.webapp, props.winId, hasList.value ? null : primary.value))

function onFrameLoad() {
  if (!hasList.value || !frameEl.value?.contentWindow) return
  const list: any[] = props.props.list
  const items = list
    .filter(x => x && x.policyId && x.path)
    .map(x => ({ policyId: x.policyId, path: x.path, name: x.name, ext: (x.ext || '').toLowerCase(), url: rawUrl(x.policyId, x.path) }))
  if (!items.length) return
  const p = primary.value
  const cur = p ? items.find(x => x.path === p.path) : null
  const expand = cur ? items.map(x => ({ ...x, default: x === cur })) : items
  frameEl.value.contentWindow.postMessage({ action: 'addOpenFiles', files: [cur ? { ...cur, expandFiles: expand } : { expandFiles: expand }] }, '*')
}
</script>

<style scoped>
.webapp-host { display: flex; flex: 1; min-height: 0; background: #fff }
</style>
