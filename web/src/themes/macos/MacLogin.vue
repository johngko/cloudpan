<template>
  <!-- 真实 macOS 登录：壁纸上直接放 大时钟 + 头像 + 胶囊输入（无卡片）。
       默认游客登录（不暴露任何账号名）；「使用账号登录」切换账号密码模式 -->
  <div class="login-screen mac-login" :class="wallpaperClass(session.wallpaper)">
    <div class="mac-clock">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>
    <div class="mac-login-form" :class="{ shake: shaking }" v-if="stage === 'form'">
      <template v-if="mode === 'guest' && session.site.guestLogin">
        <div class="avatar">{{ initial }}</div>
        <div class="mac-login-name">游客</div>
        <button class="mac-login-go mac-login-go-text" :disabled="loading" @click="doGuestLogin">
          {{ loading ? '进入中…' : '游客登录' }}
        </button>
        <div class="mac-login-switch">
          <a @click="mode = 'account'">使用账号登录 →</a>
        </div>
      </template>
      <template v-else>
        <div class="avatar">{{ initial }}</div>
        <div class="mac-login-name">{{ session.site.siteName }}</div>
        <form @submit.prevent="doLogin">
          <input class="mac-login-input" type="text" placeholder="用户名" v-model="username" autofocus />
          <input class="mac-login-input" type="password" placeholder="密码" v-model="password" />
          <button class="mac-login-go" type="submit" :disabled="loading" title="登录">
            <AppIcon name="fwd" :size="15" />
          </button>
        </form>
        <div class="mac-login-switch" v-if="session.site.guestLogin">
          <a @click="mode = 'guest'">← 以游客身份进入</a>
        </div>
      </template>
      <div v-if="errMsg" class="mac-login-err">{{ errMsg }}</div>
      <div v-if="session.site.registerOpen" class="mac-login-reg">
        <a href="#/register">创建新账号</a>
      </div>
    </div>
    <div v-if="session.site.announcement && stage === 'form'" class="mac-login-notice" v-html="noticeHtml"></div>
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
.mac-login-go-text {
  width: 100%;
  padding: 9px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--theme-1, #0a84ff), var(--theme-2, #5ac8fa));
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  margin-top: 4px;
}
.mac-login-go-text:disabled { opacity: 0.6; cursor: default; }
.mac-login-switch {
  margin-top: 12px;
  text-align: center;
}
.mac-login-switch a {
  color: #ffffffb0;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
  transition: color 150ms;
}
.mac-login-switch a:hover {
  color: #fff;
  text-decoration: underline;
}
</style>
