<template>
  <div class="login-screen" :class="wpClass" style="display: flex; align-items: center; justify-content: center">
    <!-- 拦截页：独立应用模式停用 / 应用不存在 / 未安装 / 功能未开启 -->
    <div v-if="blockReason" class="glass" style="width: 420px; max-width: 90vw; padding: 40px 36px; text-align: center">
      <AppIcon name="lock" :size="40" />
      <div style="font-size: 15px; font-weight: 600; margin-top: 14px; color: var(--text-1)">{{ blockReason }}</div>
      <div style="font-size: 12.5px; color: var(--text-3); margin-top: 8px">
        {{ blockHint }}
      </div>
      <div style="margin-top: 22px">
        <button class="btn" @click="goHash('#/login')">前往登录页</button>
      </div>
    </div>

    <!-- 极简登录（独立应用模式专用，无桌面外壳） -->
    <div v-else-if="!authed" class="glass" style="width: 360px; max-width: 90vw; padding: 30px 28px">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px">
        <AppIcon :name="app?.icon || 'app'" :size="26" />
        <div style="font-size: 15px; font-weight: 600">{{ app?.name || '应用' }} · 独立模式</div>
      </div>
      <div v-if="site.guestLogin" style="margin-bottom: 14px">
        <button class="btn primary" style="width: 100%" :disabled="busy" @click="doGuest">游客登录</button>
      </div>
      <div v-if="site.guestLogin" style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 11px; color: var(--text-3)">
        <div style="flex: 1; height: 1px; background: var(--stroke)"></div>或账号登录<div style="flex: 1; height: 1px; background: var(--stroke)"></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px">
        <input class="input" v-model="username" placeholder="用户名" @keyup.enter="doLogin" />
        <input class="input" type="password" v-model="password" placeholder="密码" :disabled="busy" @keyup.enter="doLogin" />
        <div v-if="errMsg" style="font-size: 12px; color: #e5534b">{{ errMsg }}</div>
        <button class="btn primary" :disabled="busy" @click="doLogin">{{ busy ? '登录中…' : '登录' }}</button>
      </div>
    </div>

    <!-- 全屏应用（无桌面/任务栏外壳） -->
    <div v-else-if="appComp" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg1)">
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--stroke); flex: none; background: var(--card)">
        <AppIcon :name="app?.icon || 'app'" :size="17" />
        <b style="font-size: 13px">{{ app?.name }}</b>
        <span style="font-size: 11px; color: var(--text-3)">独立模式</span>
        <div style="flex: 1"></div>
        <button class="tool-btn" title="返回桌面" @click="goHash('#/desktop')">
          <AppIcon name="grid" :size="14" /> 桌面
        </button>
        <button class="tool-btn" title="退出登录" @click="logout">
          <AppIcon name="close" :size="14" /> 退出
        </button>
      </div>
      <div style="flex: 1; overflow: hidden; display: flex">
        <component :is="appComp" :winId="'standalone'" :props="{}" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 独立应用模式（#/app/<app>）：不经过桌面外壳，直接全屏打开单个应用。
// 开关：站点设置 standalone_apps（默认开；关闭后访问显示拦截页）。
// 鉴权：未登录显示极简登录（账号 / 游客），登录后按功能门控校验再渲染。
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import AppIcon from '../components/AppIcon.vue'
import { appDef } from '../stores/apps'
import { useAppState } from '../stores/appstate'
import { appComponent } from '../themes/registry'
import { wallpaperClass } from '../assets/wallpapers'
import { useSession } from '../stores/session'
import { authApi, appsApi } from '../api/modules'
import { getToken, setToken, clearToken } from '../api/http'

const route = useRoute()
const session = useSession()
const appstate = useAppState()
const appId = computed(() => (route.params.app as string) || '')
const app = computed(() => appDef(appId.value))
const appComp = computed(() => {
  if (!ready.value || !app.value) return null
  try { return appComponent(app.value.id) } catch { return null }
})

const ready = ref(false)
const authed = ref(false)
const blockReason = ref('')
const blockHint = ref('')
const busy = ref(false)
const errMsg = ref('')
const username = ref('')
const password = ref('')
const site = ref<any>({ guestLogin: false, standaloneApps: true, theme: 'win12' })

const wpClass = computed(() => wallpaperClass(session.wallpaper))

function blocked(reason: string, hint: string) {
  blockReason.value = reason
  blockHint.value = hint
}

async function loadPublic() {
  try {
    const r: any = (await axios.get('/api/site/public')).data
    if (r.code === 0) site.value = { ...site.value, ...r.data }
  } catch { /* 离线 */ }
}

async function checkAuth() {
  if (!getToken()) {
    authed.value = false
    return
  }
  try {
    await session.loadMe()
    authed.value = true
  } catch {
    clearToken()
    authed.value = false
    return
  }
  // 功能门控：应用声明了 feature 且当前用户不可用 → 拦截页
  if (app.value?.feature) {
    try {
      const list: any[] = await appsApi.list()
      const f = list.find((x: any) => x.key === app.value!.feature)
      if (f && !f.allowed) {
        blocked('功能未开启', `「${app.value.name}」对应的系统功能未对你开启，请联系管理员`)
        return
      }
    } catch { /* 查询失败不拦截 */ }
  }
  blockReason.value = ''
}

async function init() {
  blockReason.value = ''
  await loadPublic()
  if (site.value.standaloneApps === false) {
    blocked('独立应用模式已停用', '管理员已在站点设置中关闭「独立应用模式」，请通过完整系统访问')
    ready.value = true
    return
  }
  if (!app.value) {
    blocked('应用不存在', '该应用未注册或已被移除（#/app/<应用ID>）')
    ready.value = true
    return
  }
  if (app.value.installable && !appstate.isInstalled(app.value.id)) {
    blocked('应用未安装', `「${app.value.name}」是可选应用，请先在应用中心安装`)
    ready.value = true
    return
  }
  await checkAuth()
  ready.value = true
}

async function doLogin() {
  busy.value = true; errMsg.value = ''
  try {
    const d = await authApi.login(username.value, password.value)
    setToken(d.token, d.refreshToken)
    await session.loadMe()
    authed.value = true
    await checkAuth()
  } catch (e: any) {
    errMsg.value = e.message || '登录失败'
  } finally {
    busy.value = false
  }
}
async function doGuest() {
  busy.value = true; errMsg.value = ''
  try {
    const d = await authApi.guest()
    setToken(d.token, d.refreshToken)
    await session.loadMe()
    authed.value = true
    await checkAuth()
  } catch (e: any) {
    errMsg.value = e.message || '游客登录失败'
  } finally {
    busy.value = false
  }
}
function logout() {
  clearToken()
  session.user = null
  authed.value = false
}
// 模板内联表达式里的裸 location 会被 SFC 编译器当作 setup 绑定解析（得到 undefined），
// 故导航统一走脚本内的全局 location
function goHash(h: string) { location.hash = h }

// SPA 内切换 /app/a → /app/b 时重新校验
watch(appId, () => { init() })

onMounted(() => {
  session.initTheme()
  session.loadSite()
  init()
})
onBeforeUnmount(() => { /* 无定时器 */ })
</script>

<style scoped>
/* 复用登录页毛玻璃卡片风格（.glass/.btn/.input 为全局类） */
</style>
