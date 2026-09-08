<template>
  <!-- 38px 标题栏（22px 图标 + 15px 标题），右侧 min/max/close（close hover #d80d1c） -->
  <div class="window" :class="{ minimized: w.minimized, foc: store.activeId === w.id, entering: entering && !w.minimizing && !w.restoring, minimizing: w.minimizing, restoring: w.restoring }" :style="style" @mousedown="focusWin">
    <div class="win-titlebar" @mousedown="onTitlebarDown" @dblclick="toggleMax">
      <span class="t-ico"><AppIcon :name="w.icon" :size="22" /></span>
      <span class="t-txt">{{ w.title }}</span>
      <div class="win-controls" @mousedown.stop>
        <button class="win-ctrl" @click="minimize" title="最小化">
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 8.2h8" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
        </button>
        <button class="win-ctrl" @click="toggleMax" :title="w.maximized ? '还原' : '最大化'">
          <!-- bi-app：四小方格；还原态 = 双叠层方格 -->
          <svg v-if="!w.maximized" width="14" height="14" viewBox="0 0 16 16">
            <rect x="3.4" y="3.4" width="4.6" height="4.6" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <rect x="8" y="3.4" width="4.6" height="4.6" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <rect x="3.4" y="8" width="4.6" height="4.6" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <rect x="8" y="8" width="4.6" height="4.6" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.2"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 16 16">
            <path d="M5.5 4.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <path d="M4 7.2H3.2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V3" fill="none" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </button>
        <button class="win-ctrl close" @click="close" title="关闭">
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <div class="win-body">
      <component :is="comp" :win-id="w.id" :props="w.props" />
    </div>
    <template v-if="!w.maximized">
      <div v-for="dir in dirs" :key="dir" class="win-resize" :class="dir" @mousedown="onResizeDown(dir, $event)"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useWindows, type WinState } from '../../stores/windows'
import { appComponent } from '../registry'
import { useWindowChrome } from '../../shell/useWindowChrome'
import AppIcon from '../../components/AppIcon.vue'

const props = defineProps<{ win: WinState }>()
const w = props.win
const store = useWindows()
const { style, focusWin, minimize, toggleMax, close, onTitlebarDown, onResizeDown } = useWindowChrome(w)

const comp = computed(() => appComponent(w.app))
const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

// 入场动画只播一次：播完摘掉 .entering，之后最小化/恢复的动画类切换才不会重放入场
const entering = ref(true)
const enterTimer = window.setTimeout(() => { entering.value = false }, 340)
onBeforeUnmount(() => window.clearTimeout(enterTimer))
</script>
