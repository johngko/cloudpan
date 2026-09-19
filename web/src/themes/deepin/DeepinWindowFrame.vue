<template>
  <div class="window" :class="{ minimized: w.minimized, foc: store.activeId === w.id, entering: entering && !w.minimizing && !w.restoring, minimizing: w.minimizing, restoring: w.restoring }" :style="style" @mousedown="focusWin">
    <!-- DDE 25 标题栏：标题居中、无左侧图标，右侧细线按钮（close hover 纯红见 css） -->
    <div class="dde-titlebar" @mousedown="onTitlebarDown" @dblclick="toggleMax">
      <span class="dde-title">{{ w.title }}</span>
      <div class="dde-ctrls" @mousedown.stop>
        <button class="dde-ctrl" @click="minimize" title="最小化"><AppIcon name="min" :size="13" /></button>
        <button class="dde-ctrl" @click="toggleMax" :title="w.maximized ? '还原' : '最大化'"><AppIcon name="max" :size="12" /></button>
        <button class="dde-ctrl close" @click="close" title="关闭"><AppIcon name="close" :size="13" /></button>
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

// 入场动画只播一次（同 WinWindowFrame）
const entering = ref(true)
const enterTimer = window.setTimeout(() => { entering.value = false }, 340)
onBeforeUnmount(() => window.clearTimeout(enterTimer))
</script>
