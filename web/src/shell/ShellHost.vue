<template>
  <!-- 桌面屏在身份/权限数据就绪前渲染过渡幕：避免 visibleApps() 在 /me、/apps
       未返回时把功能应用/自装应用全部隐藏造成图标"先缺后补"的闪现 -->
  <div v-if="veil" class="shell-veil"><div class="shell-veil-spin"></div></div>
  <component v-else :is="theme[screen]" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session'
import { ensureBootData, isBootDataReady } from '../stores/boot'
import { getToken } from '../api/http'
import { resolveTheme, preloadApps } from '../themes/registry'
import { settingsApi } from '../api/modules'

// 外壳宿主：路由只挂载本组件，具体外壳（开机/登录/注册/桌面）按当前主题动态解析。
// 切换主题时组件热替换，窗口等状态保存在 Pinia stores 中不丢失。
const props = defineProps<{ screen: 'Boot' | 'Login' | 'Register' | 'Desktop' }>()
const session = useSession()
const router = useRouter()
const theme = computed(() => resolveTheme(session.osTheme))
const veil = ref(false)

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

watch(() => props.screen, async (s) => {
  if (s === 'Desktop') {
    // 有令牌：等数据门就绪再挂桌面（含无令牌/身份失效时踢回登录页）；
    // 无令牌（登出后直接访问 #/desktop）：交给桌面自身的 loadMe 兜底跳登录
    if (getToken()) {
      if (!isBootDataReady()) {
        veil.value = true
        const ok = await ensureBootData()
        if (!ok) { veil.value = false; router.replace('/login'); return }
      }
    }
    veil.value = false
    startRotate()
    preloadApps() // 空闲预热应用 chunk：之后打开应用不再等网络拉取
  }
  else { veil.value = false; stopRotate() }
}, { immediate: true })
</script>

<style scoped>
.shell-veil { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; background: #0b0c12; }
.shell-veil-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,.15); border-top-color: rgba(255,255,255,.75); animation: shell-veil-rot .8s linear infinite; }
@keyframes shell-veil-rot { to { transform: rotate(360deg) } }
</style>
