<template>
  <!-- DDE 25 登录同构：左时钟 / 右注册表单 -->
  <div class="login-screen" :class="wallpaperClass(session.wallpaper)">
    <div class="dde-login-clock">
      <div class="t">{{ clock }}</div>
      <div class="d">{{ dateStr }}</div>
    </div>

    <div class="dde-login-user">
      <div class="avatar">{{ reg.username.charAt(0).toUpperCase() || 'C' }}</div>
      <div class="uname">注册新账号</div>
      <form style="display: flex; flex-direction: column; gap: 10px" @submit.prevent="doReg">
        <input class="input" placeholder="用户名（2-32位）" v-model="reg.username" />
        <input class="input" type="password" placeholder="密码（至少6位）" v-model="reg.password" />
        <input class="input" placeholder="昵称（可选）" v-model="reg.nickname" />
        <input v-if="session.site.needInviteCode" class="input" placeholder="邀请码" v-model="reg.inviteCode" />
        <div v-if="errMsg" class="dde-login-err">{{ errMsg }}</div>
        <button class="btn primary" type="submit">注册并登录</button>
      </form>
      <div class="dde-login-reg"><a href="#/login">返回登录</a></div>
    </div>

    <div class="dde-logo-bl">
      <AppIcon name="cloud" :size="24" class="lg" />
      <span>CloudPan 25</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { authApi } from '../../api/modules'
import { setToken } from '../../api/http'
import AppIcon from '../../components/AppIcon.vue'

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
    setToken(d.token)
    await session.loadMe()
    location.hash = '#/desktop'
  } catch (e: any) {
    errMsg.value = e.message || '注册失败'
  }
}
</script>
