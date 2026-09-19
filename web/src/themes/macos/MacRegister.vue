<template>
  <div class="login-screen" :class="wallpaperClass(session.wallpaper)">
    <div class="mac-clock">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>
    <div class="mac-login-card">
      <div class="avatar">{{ reg.username.charAt(0).toUpperCase() || 'C' }}</div>
      <div style="font-size: 16px; font-weight: 600">创建新账号</div>
      <form style="display: flex; flex-direction: column; gap: 10px" @submit.prevent="doReg">
        <input class="input" placeholder="用户名（2-32位）" v-model="reg.username" />
        <input class="input" type="password" placeholder="密码（至少6位）" v-model="reg.password" />
        <input class="input" placeholder="昵称（可选）" v-model="reg.nickname" />
        <input v-if="session.site.needInviteCode" class="input" placeholder="邀请码" v-model="reg.inviteCode" />
        <div v-if="errMsg" style="color: var(--danger); font-size: 12px">{{ errMsg }}</div>
        <button class="btn primary" type="submit">注册并登录</button>
      </form>
      <div style="font-size: 12px"><a href="#/login" style="color: var(--theme-1)">返回登录</a></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { authApi } from '../../api/modules'
import { setToken } from '../../api/http'

const session = useSession()
const reg = reactive({ username: '', password: '', nickname: '', inviteCode: '' })
const errMsg = ref('')
const clock = ref('')
const dateStr = ref('')
let timer: number

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

async function doReg() {
  errMsg.value = ''
  try {
    const d = await authApi.register(reg.username, reg.password, reg.nickname, reg.inviteCode)
    setToken(d.token, d.refreshToken)
    await session.loadMe()
    location.hash = '#/desktop'
  } catch (e: any) {
    errMsg.value = e.message || '注册失败'
  }
}
</script>
