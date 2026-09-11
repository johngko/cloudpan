<template>
  <!-- 注册：与登录同款 1:1 外壳（壁纸 + 头像 + 幽灵输入，无卡片） -->
  <div class="w12-login" :class="wallpaperClass(session.wallpaper)">
    <div class="w12-login-user"></div>
    <div class="w12-login-name">注册新账号</div>
    <div style="display: flex; flex-direction: column; align-items: center; width: 260px">
      <input class="w12-login-pwd" style="margin-bottom: 8px" placeholder="用户名（2-32位）" v-model="reg.username" @keyup.enter="focusNext(0)" />
      <input class="w12-login-pwd" style="margin-bottom: 8px" type="password" placeholder="密码（至少6位）" v-model="reg.password" @keyup.enter="focusNext(1)" />
      <input class="w12-login-pwd" style="margin-bottom: 8px" placeholder="昵称（可选）" v-model="reg.nickname" @keyup.enter="focusNext(2)" />
      <input v-if="session.site.needInviteCode" class="w12-login-pwd" style="margin-bottom: 8px" placeholder="邀请码" v-model="reg.inviteCode" @keyup.enter="doReg" />
      <div class="w12-login-err">{{ errMsg }}</div>
      <button class="w12-login-btn" style="width: 130px" @click="doReg">注册并登录</button>
    </div>
    <div class="w12-login-reg" style="bottom: 40px"><a href="#/login">返回登录</a></div>
    <div class="w12-login-site">{{ session.site.siteName }} · CloudPan</div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useSession } from '../../stores/session'
import { wallpaperClass } from '../../assets/wallpapers'
import { authApi } from '../../api/modules'
import { setToken } from '../../api/http'

const session = useSession()
const reg = reactive({ username: '', password: '', nickname: '', inviteCode: '' })
const errMsg = ref('')

onMounted(() => session.loadSite())

function focusNext(i: number) {
  const els = document.querySelectorAll<HTMLInputElement>('.w12-login .w12-login-pwd')
  els[i + 1]?.focus()
}

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
