<template>
  <div class="boot-screen">
    <AppIcon name="cloud" :size="78" class="dde-boot-logo" />
    <div class="dde-boot-bar"><div class="dde-boot-fill" :style="{ width: pct + '%' }"></div></div>
    <div class="boot-text">{{ stageText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'

const router = useRouter()
const stageText = ref('')
const pct = ref(0)

// 卸载后停止流程，防止残留的 replace('/login') 把已登录用户踢回登录页
let alive = true
onMounted(async () => {
  if (!alive) return
  stageText.value = 'Deepin CloudPan'
  await sleep(350)
  if (!alive) return
  stageText.value = '正在启动…'
  for (const p of [8, 22, 40, 58, 74, 88]) {
    if (!alive) return
    pct.value = p
    await sleep(260)
  }
  stageText.value = '准备就绪'
  pct.value = 100
  await sleep(500)
  if (alive) router.replace('/login')
})
onUnmounted(() => { alive = false })

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
</script>
