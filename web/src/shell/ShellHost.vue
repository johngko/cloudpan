<template>
  <component :is="theme[screen]" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSession } from '../stores/session'
import { resolveTheme } from '../themes/registry'
import { settingsApi } from '../api/modules'

// 外壳宿主：路由只挂载本组件，具体外壳（开机/登录/注册/桌面）按当前主题动态解析。
// 切换主题时组件热替换，窗口等状态保存在 Pinia stores 中不丢失。
const props = defineProps<{ screen: 'Boot' | 'Login' | 'Register' | 'Desktop' }>()
const session = useSession()
const theme = computed(() => resolveTheme(session.osTheme))

// ---- 壁纸定时轮换（壁纸中心配置，用户 KV wallpaper_rotate_min，0=关闭）----
// 仅桌面激活时计时；每次到点从「当前主题内置 + 管理员目录 + 我的壁纸」中随机挑一张
let rotateTimer: number | undefined
async function startRotate() {
  stopRotate()
  let min = 0
  let mine: { name: string; url: string }[] = []
  try {
    const d = await settingsApi.get(['wallpaper_rotate_min', 'wallpaper_my'])
    min = Number(d.wallpaper_rotate_min || 0)
    try { mine = JSON.parse(d.wallpaper_my || '[]') } catch { mine = [] }
  } catch { return }
  if (!min || min <= 0) return
  rotateTimer = window.setInterval(() => {
    const pool: string[] = [
      ...resolveTheme(session.osTheme).wallpapers.map(w => w.key),
      ...(session.site.wallpaperCatalog || []).map((w: any) => 'ext:' + w.url),
      ...mine.map(w => 'ext:' + w.url)
    ]
    const rest = pool.filter(k => k && k !== session.wallpaper)
    if (!rest.length) return
    session.setWallpaper(rest[Math.floor(Math.random() * rest.length)])
  }, min * 60000)
}
function stopRotate() {
  if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = undefined }
}
watch(() => props.screen, (s) => {
  if (s === 'Desktop') startRotate()
  else stopRotate()
}, { immediate: true })
</script>
