<template>
  <div class="window" :class="{ minimized: w.minimized, foc: store.activeId === w.id, entering: entering && !w.minimizing && !w.restoring, minimizing: w.minimizing, restoring: w.restoring }" :style="style" @mousedown="focusWin">
    <div class="mac-titlebar" @mousedown="onTitlebarDown" @dblclick="toggleMax">
      <div class="traffic" @mousedown.stop>
        <button class="tl close" @click="close" title="关闭"><span class="g">×</span></button>
        <button class="tl min" @click="minimize" title="最小化"><span class="g">−</span></button>
        <button class="tl zoom" @click="toggleMax" :title="w.maximized ? '还原' : '全屏幕'"><span class="g">+</span></button>
      </div>
      <span class="mac-title">{{ w.title }}</span>
      <span class="mac-tb-spacer"></span>
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
