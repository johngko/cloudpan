<template>
  <component :is="theme[screen]" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '../stores/session'
import { resolveTheme } from '../themes/registry'

// 外壳宿主：路由只挂载本组件，具体外壳（开机/登录/注册/桌面）按当前主题动态解析。
// 切换主题时组件热替换，窗口等状态保存在 Pinia stores 中不丢失。
const props = defineProps<{ screen: 'Boot' | 'Login' | 'Register' | 'Desktop' }>()
const session = useSession()
const theme = computed(() => resolveTheme(session.osTheme))
</script>
