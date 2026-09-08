<template>
  <div class="boot-screen">
    <AppIcon name="cloud" :size="84" class="mac-boot-logo" />
    <div class="mac-boot-bar"><div class="fill" :style="{ width: pct + '%' }"></div></div>
    <div class="boot-text">CloudPan</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'

const router = useRouter()
const pct = ref(0)

onMounted(async () => {
  // 进度条推进（macOS 风格）
  for (const p of [8, 22, 40, 58, 74, 88, 100]) {
    pct.value = p
    await sleep(220)
  }
  await sleep(350)
  router.replace('/login')
})

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
</script>
