<template>
  <div class="login-screen lock-screen" :class="wallpaperClass(session.wallpaper)">
    <div class="mac-clock" style="top: 22%">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>
    <div class="mac-login-card" :class="{ shake: wrong }" style="padding: 26px 40px 22px">
      <div class="avatar">{{ initial }}</div>
      <div style="font-size: 15px; font-weight: 600">{{ session.user?.nickname || session.user?.username }}</div>
      <form style="display: flex; flex-direction: column; gap: 10px" @submit.prevent="unlock">
        <input class="input" type="password" placeholder="输入密码解锁" v-model="pwd" autofocus style="width: 240px" />
        <button class="btn primary" style="border-radius: 8px">解锁</button>
      </form>
      <div v-if="wrong" style="color: var(--danger); font-size: 12px">密码错误，请重试</div>
    </div>
    <button class="btn mac-lock-logout" @click="logout">
      <AppIcon name="logout" :size="14" /> 注销
    </button>
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
  dateStr.value = `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`
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
