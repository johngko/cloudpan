<template>
  <div class="launchpad" @click.self="close">
    <div class="lp-search">
      <input ref="searchEl" class="input" placeholder="搜索" v-model="kw" @click.stop />
    </div>
    <div class="lp-grid" @click.stop>
      <div v-for="(a, i) in filtered" :key="a.id" class="lp-app" :style="{ '--i': i }" @click="open(a)">
        <AppIcon :name="a.icon" :size="74" class="ico" />
        <div class="lbl">{{ a.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useWindows } from '../../stores/windows'
import { visibleApps, type AppDef } from '../../stores/apps'
import AppIcon from '../../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useWindows()
const kw = ref('')
const searchEl = ref<HTMLInputElement>()

const all = computed(() => visibleApps().filter(a => a.id !== 'recycle'))
const filtered = computed(() => all.value.filter(a => !kw.value || a.name.includes(kw.value)))

onMounted(() => {
  nextTick(() => searchEl.value?.focus())
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
function close() { emit('close') }
function open(a: AppDef) {
  if (a.id === 'thispc') store.open('explorer', { thispc: true }, { title: '访达', icon: 'explorer', w: 1000, h: 640 })
  else if (a.id === 'explorer') store.open('explorer')
  else store.open(a.id)
  close()
}
</script>
