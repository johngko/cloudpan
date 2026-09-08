<template>
  <!-- 锁屏：壁纸模糊 + 顶部大细时钟 + 居中头像/密码（登录同款 1:1 形态）+ 右下电源 -->
  <div class="w12-login w12-lock" :class="wallpaperClass(session.wallpaper)">
    <div class="w12-lock-time">
      <div class="w12-lock-clock">{{ clock }}</div>
      <div class="w12-lock-date">{{ dateStr }}</div>
    </div>
    <div class="w12-lock-user" :class="{ shake: wrong }">
      <div class="w12-login-user"></div>
      <div class="w12-login-name">{{ name }}</div>
      <input class="w12-login-pwd" type="password" placeholder="输入密码解锁" v-model="pwd" @keyup.enter="unlock" ref="pwdEl" />
      <div class="w12-login-err">{{ wrong ? '密码错误，请重试' : '' }}</div>
      <button class="w12-login-btn" @click="unlock">解锁</button>
    </div>
    <div class="w12-login-power">
      <button title="注销" @click="logout">
        <svg width="22" height="22" viewBox="0 0 16 16"><path d="M6.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 0 0 1.5 1.5h2.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M10 5l3 3-3 3M13 8H6.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button title="重启" @click="reboot">
        <svg width="22" height="22" viewBox="0 0 16 16"><path d="M3.6 5.4A5 5 0 1 1 3.2 9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M3.4 2.4v3.2h3.2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { authApi } from '../../api/modules'

const emit = defineEmits<{ (e: 'unlock'): void }>()
const session = useSession()
const pwd = ref('')
const wrong = ref(false)
const clock = ref('')
const dateStr = ref('')
const pwdEl = ref<HTMLInputElement>()
let timer: number

const name = computed(() => session.user?.nickname || session.user?.username || '用户')

function tick() {
  const d = new Date()
  clock.value = d.toTimeString().slice(0, 5)
  dateStr.value = `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`
}
onMounted(() => {
  tick()
  timer = window.setInterval(tick, 10000)
  nextTick(() => pwdEl.value?.focus())
})
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
    setTimeout(() => (wrong.value = false), 1400)
  }
}

function logout() { session.logout() }
function reboot() { location.reload() }
</script>
