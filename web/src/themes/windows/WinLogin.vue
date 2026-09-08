<template>
  <!-- #loginback：壁纸上居中 150px 头像 + 用户名 + 幽灵输入 + 登录钮；
       成功后 #login-welc（转环+欢迎）→ .close（整体压暗）→ 淡出进桌面 -->
  <div class="w12-login" :class="wallpaperClass(session.wallpaper)" :style="{ backgroundColor: 'transparent' }">
    <div class="w12-login-user"></div>
    <div class="w12-login-name">{{ displayName }}</div>

    <template v-if="stage === 'form'">
      <input class="w12-login-pwd" type="text" placeholder="用户名（默认 admin）" v-model="username" @keyup.enter="doLogin" />
      <input class="w12-login-pwd" type="password" placeholder="密码" v-model="password" :disabled="loading"
        @keyup.enter="doLogin" ref="pwdEl" :style="{ opacity: stage === 'form' ? 1 : 0, transition: 'opacity 300ms' }" />
      <div class="w12-login-err">{{ errMsg }}</div>
      <button class="w12-login-btn" :disabled="loading" @click="doLogin">{{ loading ? '登录中' : '登录' }}</button>
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
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { setToken } from '../../api/http'

const router = useRouter()
const session = useSession()
const username = ref('admin')
const password = ref('')
const loading = ref(false)
const stage = ref<'form' | 'welcome'>('form')
const errMsg = ref('')
const pwdEl = ref<HTMLInputElement>()

// 用户名框常显（预填 admin 便于管理员登录；注册用户可清空后输入自己的账号）
const displayName = computed(() => username.value || 'Administrator')

onMounted(() => {
  session.loadSite()
  nextTick(() => pwdEl.value?.focus())
})

async function doLogin() {
  if (!username.value || !password.value || loading.value) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = await import('../../api/modules').then(m => m.authApi.login(username.value, password.value))
    setToken(res.token)
    await session.loadMe()
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
