<template>
  <!-- DDE 25 登录：左 40% 大时钟 / 右 60% 用户区 / 右下圆形按钮 / 左下 logo -->
  <div class="login-screen" :class="wallpaperClass(session.wallpaper)">
    <div class="dde-login-clock">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>

    <!-- 默认游客登录（不暴露任何账号名）；「使用账号登录」切换账号密码模式 -->
    <div class="dde-login-user" :class="{ shake: shaking }" v-if="stage === 'form'">
      <template v-if="mode === 'guest' && session.site.guestLogin">
        <div class="avatar">{{ initial }}</div>
        <div class="uname">游客</div>
        <button class="btn primary" style="margin-top: 12px" :disabled="loading" @click="doGuestLogin">{{ loading ? '进入中…' : '游客登录' }}</button>
        <div class="dde-login-switch">
          <a @click="mode = 'account'">使用账号登录 →</a>
        </div>
      </template>
      <template v-else>
        <div class="avatar">{{ initial }}</div>
        <div class="uname">{{ session.site.siteName }}</div>
        <form style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px" @submit.prevent="doLogin">
          <input class="input" type="text" placeholder="用户名" v-model="username" autofocus />
          <input class="input" type="password" placeholder="密码" v-model="password" />
          <button class="btn primary" type="submit" :disabled="loading">{{ loading ? '登录中…' : '登 录' }}</button>
        </form>
        <div class="dde-login-switch" v-if="session.site.guestLogin">
          <a @click="mode = 'guest'">← 以游客身份进入</a>
        </div>
      </template>
      <div v-if="errMsg" class="dde-login-err">{{ errMsg }}</div>
      <div v-if="session.site.registerOpen" class="dde-login-reg">
        <a href="#/register">注册新账号</a>
      </div>
      <div v-if="session.site.announcement" class="dde-login-notice" v-html="noticeHtml"></div>
    </div>
    <div v-else-if="stage === 'welcome'" class="dde-login-user">
      <div class="avatar">{{ initial }}</div>
      <div class="uname">欢迎，{{ session.user?.nickname || session.user?.username }}</div>
    </div>

    <div class="dde-ctrls-br">
      <button class="dde-round-btn" title="关机" @click="router.replace('/boot')"><AppIcon name="power" :size="15" /></button>
    </div>
    <div class="dde-logo-bl">
      <AppIcon name="cloud" :size="24" class="lg" />
      <span>CloudPan 25</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { setToken } from '../../api/http'
import AppIcon from '../../components/AppIcon.vue'
import { renderMD } from '../../utils/markdown'

const router = useRouter()
const session = useSession()
// 公告支持 Markdown（管理台站点设置编写，DOMPurify 消毒后渲染）
const noticeHtml = computed(() => renderMD(session.site.announcement || ''))
// 登录模式：guest=游客登录（默认）/ account=账号密码。站点关闭游客登录后强制账号模式
const mode = ref<'guest' | 'account'>('guest')
const username = ref('')
const password = ref('')
const loading = ref(false)
const shaking = ref(false)
const stage = ref<'form' | 'welcome'>('form')
const errMsg = ref('')
const clock = ref('')
const dateStr = ref('')
let timer: number

const initial = computed(() => (mode.value === 'guest' ? '游' : ((username.value || '用').charAt(0).toUpperCase())))

watch(() => session.site.guestLogin, (ok) => { if (!ok) mode.value = 'account' })

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

async function doGuestLogin() {
  if (loading.value) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = await import('../../api/modules').then(m => m.authApi.guest())
    setToken(res.token, res.refreshToken)
    await session.loadMe()
    stage.value = 'welcome'
    setTimeout(() => router.replace('/desktop'), 900)
  } catch (e: any) {
    errMsg.value = e.message
    shaking.value = true
    setTimeout(() => (shaking.value = false), 450)
    mode.value = 'account'
  } finally {
    loading.value = false
  }
}

async function doLogin() {
  if (!username.value || !password.value || loading.value) return
  loading.value = true
  try {
    const res = await import('../../api/modules').then(m => m.authApi.login(username.value, password.value))
    setToken(res.token, res.refreshToken)
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

<style scoped>
.dde-login-switch {
  margin-top: 14px;
  text-align: center;
}
.dde-login-switch a {
  color: #ffffffb0;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
  transition: color 150ms;
}
.dde-login-switch a:hover {
  color: #fff;
  text-decoration: underline;
}
</style>
