<template>
  <!-- DDE 25 锁屏：左 40% 大时钟 / 右 60% 用户区（锁形+头像+密码）/ 右下注销 / 左下 logo -->
  <div class="login-screen lock-screen" :class="wallpaperClass(session.wallpaper)">
    <div class="dde-login-clock">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>

    <div class="dde-login-user" :class="{ shake: wrong }">
      <AppIcon name="lock" :size="22" style="color: rgba(255,255,255,0.85)" />
      <div class="avatar">{{ initial }}</div>
      <div class="uname">{{ session.user?.nickname || session.user?.username }}</div>
      <form style="display: flex; flex-direction: column; gap: 10px" @submit.prevent="unlock">
        <input class="input" type="password" placeholder="输入密码解锁" v-model="pwd" autofocus />
        <button class="btn primary" type="submit">解 锁</button>
      </form>
      <div v-if="wrong" class="dde-login-err">密码错误，请重试</div>
    </div>

    <div class="dde-ctrls-br">
      <button class="dde-round-btn" title="注销" @click="logout"><AppIcon name="logout" :size="15" /></button>
      <button class="dde-round-btn" title="关机" @click="session.logout()"><AppIcon name="power" :size="15" /></button>
    </div>
    <div class="dde-logo-bl">
      <AppIcon name="cloud" :size="24" class="lg" />
      <span>CloudPan 25</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { authApi } from '../../api/modules'
import AppIcon from '../../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'unlock'): void }>()
const session = useSession()
const pwd = ref('')
const wrong = ref(false)
const clock = ref('')
const dateStr = ref('')
let timer: number

const initial = computed(() => (session.user?.nickname || session.user?.username || 'C').charAt(0).toUpperCase())

function tick() {
  const d = new Date()
  clock.value = d.toTimeString().slice(0, 5)
  dateStr.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`
}
onMounted(() => { tick(); timer = setInterval(tick, 10000) })
onBeforeUnmount(() => clearInterval(timer))

async function unlock() {
  if (!pwd.value) return
  try {
    await authApi.login(session.user!.username, pwd.value)
    wrong.value = false
    pwd.value = ''
    emit('unlock')
  } catch {
    wrong.value = true
    setTimeout(() => (wrong.value = false), 1200)
  }
}

function logout() { session.logout() }
</script>

<style scoped>
.lock-screen { z-index: 9600; }
</style>
