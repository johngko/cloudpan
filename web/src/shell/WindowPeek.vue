<template>
  <!-- 任务栏/Dock 悬停预览卡（简化版=标题列表）：行点击聚焦/还原，× 关闭 -->
  <div class="win-peek" @click.stop @mousedown.stop>
    <div v-for="w in wins" :key="w.id" class="win-peek-row" @click="store.focus(w.id)">
      <AppIcon :name="w.icon" :size="15" />
      <span class="wp-title" :title="w.title">{{ w.title }}</span>
      <span class="wp-min" v-if="w.minimized" title="已最小化">⌄</span>
      <button class="wp-close" title="关闭窗口" @click.stop="store.close(w.id)">
        <svg width="10" height="10" viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { useWindows } from '../stores/windows'
import type { WinState } from '../stores/windows'

defineProps<{ wins: WinState[] }>()
const store = useWindows()
</script>
