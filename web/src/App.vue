<template>
  <router-view />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useSession } from './stores/session'
import { useAppState } from './stores/appstate'

// 登录/切换账号后补拉功能清单：启动时的 load() 发生在登录前（无令牌，401），
// 而 /apps 的 allowed 与当前用户相关——身份确定后必须重新拉取，
// 否则无权限的功能（如被用户组禁用的终端）入口不会隐藏
const session = useSession()
const appstate = useAppState()
watch(() => session.user ? `${session.user.id}:${session.user.role}` : '', (id) => {
  if (id) appstate.load()
})
</script>
