<template>
  <!-- Alt+Tab 切换器覆盖层：三主题共用（半透明卡片行，选中项高亮 + 标题） -->
  <div class="alttab-mask" @click.self="$emit('close')" @contextmenu.prevent>
    <div class="alttab-row" role="listbox" aria-label="切换窗口">
      <button v-for="(w, i) in wins" :key="w.id" class="alttab-cell" :class="{ sel: i === idx }"
        role="option" :aria-selected="i === idx" @click="$emit('pick', w.id)">
        <AppIcon :name="w.icon" :size="34" />
        <span class="alttab-name">{{ w.title }}</span>
        <span v-if="w.minimized" class="alttab-min" title="已最小化"></span>
      </button>
    </div>
    <div class="alttab-hint">Tab / ← → 切换 · 松开 Alt 确认 · Esc 取消</div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import type { WinState } from '../stores/windows'

defineProps<{ wins: WinState[]; idx: number }>()
defineEmits<{ (e: 'pick', id: number): void; (e: 'close'): void }>()
</script>
