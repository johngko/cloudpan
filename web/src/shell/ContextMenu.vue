<template>
  <div class="ctx-menu" ref="menuEl" role="menu" tabindex="-1" v-if="store.visible"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop @mousedown.stop @contextmenu.prevent @keydown="onKey">
    <template v-for="(item, i) in store.items" :key="i">
      <div v-if="item.separator" class="ctx-sep" role="separator"></div>
      <div v-else class="ctx-item" role="menuitem" tabindex="-1"
        :aria-disabled="item.disabled ? 'true' : undefined"
        :aria-haspopup="item.children?.length ? 'menu' : undefined"
        :class="{ danger: item.danger, disabled: item.disabled, 'has-sub': !!item.children?.length }"
        @mouseenter="hovered = i" @click="run(item)">
        <span class="ci-ico"><AppIcon v-if="item.icon" :name="item.icon" :size="16" /></span>
        <span class="ci-label">{{ item.checked ? '✓ ' : '' }}{{ item.label }}</span>
        <span v-if="item.children?.length" class="ci-arrow"><AppIcon name="fwd" :size="10" /></span>
        <div v-if="item.children?.length && hovered === i" class="ctx-menu ctx-sub" role="menu">
          <template v-for="(c, j) in item.children" :key="j">
            <div v-if="c.separator" class="ctx-sep" role="separator"></div>
            <div v-else class="ctx-item" role="menuitem" tabindex="-1"
              :aria-disabled="c.disabled ? 'true' : undefined"
              :class="{ danger: c.danger, disabled: c.disabled }" @click="runSub(c)">
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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useContextMenu, type MenuItem } from '../stores/ui'
import AppIcon from '../components/AppIcon.vue'

const store = useContextMenu()
const hovered = ref(-1)
const menuEl = ref<HTMLElement | null>(null)
const x = computed(() => Math.min(store.x, window.innerWidth - 230))
const y = computed(() => Math.min(store.y, window.innerHeight - store.items.length * 34 - 20))

watch(() => store.visible, async v => {
  hovered.value = -1
  // 无障碍：显示后把焦点移进菜单，方向键/Enter/Esc 才能生效
  if (v) { await nextTick(); menuEl.value?.focus() }
})

// 可交互项（跳过分隔线与禁用项）在 store.items 中的下标
function selectableIndexes(): number[] {
  return store.items.map((it, i) => ({ it, i }))
    .filter(o => !o.it.separator && !o.it.disabled)
    .map(o => o.i)
}

// 键盘导航：↑/↓ 移动、Home/End 首尾、Enter 触发、Esc 关闭（role=menu 的标准交互）
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); store.hide(); return }
  const idxs = selectableIndexes()
  if (!idxs.length) return
  const cur = idxs.indexOf(hovered.value)
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      hovered.value = cur < 0 ? idxs[0] : idxs[(cur + 1) % idxs.length]
      break
    case 'ArrowUp':
      e.preventDefault()
      hovered.value = cur < 0 ? idxs[idxs.length - 1] : idxs[(cur - 1 + idxs.length) % idxs.length]
      break
    case 'Home':
      e.preventDefault(); hovered.value = idxs[0]
      break
    case 'End':
      e.preventDefault(); hovered.value = idxs[idxs.length - 1]
      break
    case 'Enter': {
      e.preventDefault()
      const it = store.items[hovered.value]
      if (it) run(it)
      break
    }
    default:
      break
  }
}

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