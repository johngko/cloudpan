<template>
  <!-- #loginback：壁纸上居中 150px 头像 + 用户名 + 幽灵输入 + 登录钮；
       成功后 #login-welc（转环+欢迎）→ .close（整体压暗）→ 淡出进桌面。
       默认游客登录（不暴露任何账号名）；「使用账号登录」切换账号密码模式 -->
  <div class="w12-login" :class="wallpaperClass(session.wallpaper)" :style="{ backgroundColor: 'transparent' }">
    <div class="w12-login-user"></div>
    <div class="w12-login-name">{{ mode === 'guest' ? '游客' : (username || '用户') }}</div>

    <template v-if="stage === 'form'">
      <template v-if="mode === 'guest' && session.site.guestLogin">
        <button class="w12-login-btn" :disabled="loading" @click="doGuestLogin">{{ loading ? '进入中' : '游客登录' }}</button>
        <div class="w12-login-switch">
          <a @click="mode = 'account'">使用账号登录 →</a>
        </div>
      </template>
      <template v-else>
        <input class="w12-login-pwd" type="text" placeholder="用户名" v-model="username" @keyup.enter="doLogin" ref="nameEl"
          :style="{ opacity: stage === 'form' ? 1 : 0, transition: 'opacity 300ms' }" />
        <input class="w12-login-pwd" type="password" placeholder="密码" v-model="password" :disabled="loading"
          @keyup.enter="doLogin" ref="pwdEl" :style="{ opacity: stage === 'form' ? 1 : 0, transition: 'opacity 300ms' }" />
        <div class="w12-login-err">{{ errMsg }}</div>
        <button class="w12-login-btn" :disabled="loading" @click="doLogin">{{ loading ? '登录中' : '登录' }}</button>
        <div class="w12-login-switch" v-if="session.site.guestLogin">
          <a @click="mode = 'guest'">← 以游客身份进入</a>
        </div>
      </template>
    </template>

    <div class="w12-login-welc" :class="{ on: stage === 'welcome' }">
      <svg width="50" height="50" viewBox="0 0 16 16">
        <circle cx="8px" cy="8px" r="6px" style="stroke: #ffffff40; fill: none; stroke-width: 2.5px;"></circle>
        <circle cx="8px" cy="8px" r="6px"></circle>
      </svg>
      <p>欢迎，{{ displayName }}</p>
    </div>

    <div class="w12-login-notice" v-if="session.site.announcement">{{ session.site.announcement }}</div>
    <div class="w12-login-reg" v-if="session.site.registerOpen">
      <a href="#/register">注册新账号</a>
    </div>
    <div class="w12-login-site">{{ session.site.siteName }} · CloudPan</div>

    <div class="w12-login-power">
      <button title="关机" @click="shutdown">
        <svg width="22" height="22" viewBox="0 0 16 16"><path d="M8 1.8v5.4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M4.9 4a5.2 5.2 0 1 0 6.2 0" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
      </button>
      <button title="重启" @click="reboot">
        <svg width="22" height="22" viewBox="0 0 16 16"><path d="M3.6 5.4A5 5 0 1 1 3.2 9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M3.4 2.4v3.2h3.2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { setToken } from '../../api/http'

const router = useRouter()
const session = useSession()
// 登录模式：guest=游客登录（默认）/ account=账号密码。站点关闭游客登录后强制账号模式
const mode = ref<'guest' | 'account'>('guest')
const username = ref('')
const password = ref('')
const loading = ref(false)
const stage = ref<'form' | 'welcome'>('form')
const errMsg = ref('')
const nameEl = ref<HTMLInputElement>()
const pwdEl = ref<HTMLInputElement>()

const displayName = computed(() => session.user?.nickname || session.user?.username || (mode.value === 'guest' ? '游客' : (username.value || '用户')))

watch(() => session.site.guestLogin, (ok) => { if (!ok) mode.value = 'account' })

onMounted(() => {
  session.loadSite()
  nextTick(() => {
    if (mode.value === 'account') nameEl.value?.focus()
  })
})

function focusName() {
  nextTick(() => nameEl.value?.focus())
}
watch(mode, (m) => { if (m === 'account') focusName() })

// 登录成功后的统一收尾：欢迎动画 → 压暗 → 淡出进桌面
function enterDesktop() {
  stage.value = 'welcome'
  // 演示站时序：欢迎 2s → .close 压暗 500ms → 淡出（1.5s）→ 桌面
  setTimeout(() => {
    const el = document.querySelector('.w12-login') as HTMLElement | null
    el?.classList.add('close')
    setTimeout(() => {
      if (el) el.style.opacity = '0'
      setTimeout(() => router.replace('/desktop'), 900)
    }, 550)
  }, 1400)
}

async function doGuestLogin() {
  if (loading.value) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = await import('../../api/modules').then(m => m.authApi.guest())
    setToken(res.token)
    await session.loadMe()
    enterDesktop()
  } catch (e: any) {
    errMsg.value = e.message
    mode.value = 'account'
  } finally {
    loading.value = false
  }
}

async function doLogin() {
  if (!username.value || !password.value || loading.value) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = await import('../../api/modules').then(m => m.authApi.login(username.value, password.value))
    setToken(res.token)
    await session.loadMe()
    enterDesktop()
  } catch (e: any) {
    errMsg.value = e.message
    password.value = ''
  } finally {
    loading.value = false
  }
}

function shutdown() { router.replace('/boot') }
function reboot() { location.reload() }
</script>

<style scoped>
.w12-login-switch {
  margin-top: 14px;
  text-align: center;
}
.w12-login-switch a {
  color: #ffffffb0;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
  transition: color 150ms;
}
.w12-login-switch a:hover {
  color: #ffffff;
  text-decoration: underline;
}
</style>
