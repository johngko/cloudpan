<template>
  <div class="ctx-menu" :style="{ left: x + 'px', top: y + 'px' }" v-if="store.visible"
    @click.stop @mousedown.stop @contextmenu.prevent>
    <template v-for="(item, i) in store.items" :key="i">
      <div v-if="item.separator" class="ctx-sep"></div>
      <div v-else class="ctx-item" :class="{ danger: item.danger, disabled: item.disabled, 'has-sub': !!item.children?.length }"
        @mouseenter="hovered = i" @click="run(item)">
        <span class="ci-ico"><AppIcon v-if="item.icon" :name="item.icon" :size="16" /></span>
        <span class="ci-label">{{ item.checked ? '✓ ' : '' }}{{ item.label }}</span>
        <span v-if="item.children?.length" class="ci-arrow"><AppIcon name="fwd" :size="10" /></span>
        <div v-if="item.children?.length && hovered === i" class="ctx-menu ctx-sub">
          <template v-for="(c, j) in item.children" :key="j">
            <div v-if="c.separator" class="ctx-sep"></div>
            <div v-else class="ctx-item" :class="{ danger: c.danger, disabled: c.disabled }" @click="runSub(c)">
              <span class="ci-ico"><AppIcon v-if="c.icon" :name="c.icon" :size="16" /></span>
              <span class="ci-label">{{ c.checked ? '✓ ' : '' }}{{ c.label }}</span>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useContextMenu, type MenuItem } from '../stores/ui'
import AppIcon from '../components/AppIcon.vue'

const store = useContextMenu()
const hovered = ref(-1)
const x = computed(() => Math.min(store.x, window.innerWidth - 230))
const y = computed(() => Math.min(store.y, window.innerHeight - store.items.length * 34 - 20))

watch(() => store.visible, v => { if (v) hovered.value = -1 })

function run(item: MenuItem) {
  if (item.disabled) return // 禁用项不可点（与 Windows 一致）
  if (item.children?.length) return // 父项仅展开子菜单（悬停展开）
  store.hide()
  item.onClick?.()
}
function runSub(c: MenuItem) {
  if (c.disabled) return
  store.hide()
  hovered.value = -1
  c.onClick?.()
}

function onDown() { store.hide() }
onMounted(() => document.addEventListener('mousedown', onDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDown))
</script>
