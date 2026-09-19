<template>
  <router-view />
  <!-- v9os 商店 webapp 的选文件/保存文件对话框宿主（bridge.ts 的 pickQueue 驱动） -->
  <FilePickerHost />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useSession } from './stores/session'
import { ensureBootData } from './stores/boot'
import FilePickerHost from './webapp/FilePickerHost.vue'
import { installHostBridge } from './webapp/bridge'

// 安装 $v9os 宿主桥（window.$v9os），供 /webapps/* 静态应用经同源 iframe 调用
installHostBridge()

// 登录/切换账号后补拉功能清单：启动时的 load() 发生在登录前（无令牌，401），
// 而 /apps 的 allowed 与当前用户相关——身份确定后必须重新拉取，
// 否则无权限的功能（如被用户组禁用的终端）入口不会隐藏
const session = useSession()
watch(() => session.user ? `${session.user.id}:${session.user.role}` : '', (id) => {
  // 身份确定/切换后补拉功能清单：ensureBootData 内部按 loadedFor 身份戳判断，
  // 同一身份幂等跳过、跨身份重拉（去重并发），不再裸调 apps.load() 造成重复请求
  if (id) ensureBootData()
})
</script>
