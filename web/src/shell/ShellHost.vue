<template>
  <!-- 桌面屏在身份/权限数据就绪前渲染过渡幕：避免 visibleApps() 在 /me、/apps
       未返回时把功能应用/自装应用全部隐藏造成图标"先缺后补"的闪现 -->
  <div v-if="veil" class="shell-veil"><div class="shell-veil-spin"></div></div>
  <component v-else :is="theme[screen]" />
  <!-- 开机/登录/注册屏没有桌面壳可挂 DialogHost：登录页两步验证弹码等 uiDlg
       对话框需要宿主（桌面屏由三主题桌面自行挂载，此处跳过避免双挂） -->
  <DialogHost v-if="screen !== 'Desktop'" />
  <!-- 功能权限拉取失败（网络/服务异常）：不阻塞桌面（入口按放行显示），但明确提示并可一键重试 -->
  <div v-if="!veil && screen === 'Desktop' && appstate.loadFailed" class="shell-degraded" role="alert">
    <span>功能权限加载失败（网络或服务异常），入口显隐可能与实际权限不一致。</span>
    <button class="shell-degraded-btn" :disabled="retrying" @click="retryAppState">{{ retrying ? '重试中…' : '重试' }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session'
import { ensureBootData, isBootDataReady } from '../stores/boot'
import { getToken } from '../api/http'
import { resolveTheme, preloadApps } from '../themes/registry'
import { settingsApi } from '../api/modules'
import { useAppState } from '../stores/appstate'
import { pwaDesktopStart, pwaDesktopStop } from './usePwaShell'
import DialogHost from './DialogHost.vue'

// 外壳宿主：路由只挂载本组件，具体外壳（开机/登录/注册/桌面）按当前主题动态解析。
// 切换主题时组件热替换，窗口等状态保存在 Pinia stores 中不丢失。
const props = defineProps<{ screen: 'Boot' | 'Login' | 'Register' | 'Desktop' }>()
const session = useSession()
const appstate = useAppState()
const router = useRouter()
const theme = computed(() => resolveTheme(session.osTheme))
const veil = ref(false)
const retrying = ref(false)

// 权限清单重试：必须直接调 appstate.load()，不能走 ensureBootData()——
// 后者按身份去重（loadedFor 已置位）会直接返回 true 而不重新请求 /apps
async function retryAppState() {
  if (retrying.value) return
  retrying.value = true
  try { await appstate.load() } finally { retrying.value = false }
}

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
    pwaDesktopStart() // 分享收件箱/推送补订阅/相册备份循环（仅桌面激活期，见 usePwaShell）
    preloadApps() // 空闲预热应用 chunk：之后打开应用不再等网络拉取
  }
  else { veil.value = false; stopRotate(); pwaDesktopStop() }
}, { immediate: true })

// 路由离开/组件卸载时兜底清理：只靠 watch(screen) 在异常卸载路径下可能漏停
onBeforeUnmount(() => { stopRotate(); pwaDesktopStop() })
</script>

<style scoped>
.shell-veil { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; background: #0b0c12; }
.shell-veil-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,.15); border-top-color: rgba(255,255,255,.75); animation: shell-veil-rot .8s linear infinite; }
@keyframes shell-veil-rot { to { transform: rotate(360deg) } }

/* 权限加载失败提示条：浮于外壳之上，避开各主题的顶部保留区（macOS 菜单栏 24px） */
.shell-degraded {
  position: fixed; left: 50%; transform: translateX(-50%);
  top: calc(var(--shell-top, 0px) + 10px);
  z-index: 9600; display: flex; align-items: center; gap: 10px;
  max-width: min(680px, calc(100vw - 24px));
  padding: 8px 14px; border-radius: var(--radius);
  background: var(--warning-bg); color: var(--warning);
  border: 1px solid var(--warning); box-shadow: var(--shadow);
  font-size: 12.5px; line-height: 1.5;
}
.shell-degraded-btn {
  flex: none; padding: 4px 12px; border-radius: var(--radius-sm); cursor: pointer;
  border: 1px solid var(--warning); background: transparent; color: var(--warning); font-size: 12.5px;
}
.shell-degraded-btn:hover:not(:disabled) { background: var(--warning); color: var(--bg); }
.shell-degraded-btn:disabled { opacity: .6; cursor: default; }
</style>
