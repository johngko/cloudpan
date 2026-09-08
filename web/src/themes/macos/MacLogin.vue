<template>
  <!-- 真实 macOS 登录：壁纸上直接放 大时钟 + 头像 + 胶囊输入（无卡片） -->
  <div class="login-screen mac-login" :class="wallpaperClass(session.wallpaper)">
    <div class="mac-clock">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>
    <div class="mac-login-form" :class="{ shake: shaking }" v-if="stage === 'form'">
      <div class="avatar">{{ initial }}</div>
      <div class="mac-login-name">{{ session.site.siteName }}</div>
      <form @submit.prevent="doLogin">
        <input class="mac-login-input" type="text" placeholder="用户名" v-model="username" autofocus />
        <input class="mac-login-input" type="password" placeholder="密码" v-model="password" />
        <button class="mac-login-go" type="submit" :disabled="loading" title="登录">
          <AppIcon name="fwd" :size="15" />
        </button>
      </form>
      <div v-if="errMsg" class="mac-login-err">{{ errMsg }}</div>
      <div v-if="session.site.registerOpen" class="mac-login-reg">
        <a href="#/register">创建新账号</a>
      </div>
    </div>
    <div class="mac-login-welcome" v-else-if="stage === 'welcome'">
      <div class="avatar">{{ initial }}</div>
      <div class="mac-login-name">欢迎，{{ session.user?.nickname || session.user?.username }}</div>
    </div>
    <button class="mac-power" @click="router.replace('/boot')">
      <AppIcon name="power" :size="15" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { setToken } from '../../api/http'
import AppIcon from '../../components/AppIcon.vue'

const router = useRouter()
const session = useSession()
const username = ref('admin')
const password = ref('')
const loading = ref(false)
const shaking = ref(false)
const stage = ref<'form' | 'welcome'>('form')
const errMsg = ref('')
const clock = ref('')
const dateStr = ref('')
let timer: number

const initial = computed(() => (username.value || 'C').charAt(0).toUpperCase())

function tick() {
  const d = new Date()
  clock.value = d.toTimeString().slice(0, 5)
  dateStr.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`
}
onMounted(() => {
  session.loadSite()
  tick(); timer = setInterval(tick, 10000)
})
onBeforeUnmount(() => clearInterval(timer))

async function doLogin() {
  if (!username.value || !password.value || loading.value) return
  loading.value = true
  try {
    const res = await import('../../api/modules').then(m => m.authApi.login(username.value, password.value))
    setToken(res.token)
    await session.loadMe()
    stage.value = 'welcome'
    setTimeout(() => router.replace('/desktop'), 900)
  } catch (e: any) {
    errMsg.value = e.message
    shaking.value = true
    setTimeout(() => (shaking.value = false), 450)
  } finally {
    loading.value = false
  }
}
</script>
