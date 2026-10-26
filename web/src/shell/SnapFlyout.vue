<template>
  <!-- Snap Layouts 面板（Win11 风格）：悬停最大化按钮唤出；点选半屏/四象限分区 -->
  <div class="win-snapfly" @mouseenter="emit('keep')" @mouseleave="emit('leave')">
    <div class="snapfly-row">
      <button class="snapfly-cell" title="左半屏" @click="pick('L')">
        <span class="sf-prev"><i class="sf-fill" style="left:0;top:0;width:50%;height:100%"></i></span>
      </button>
      <button class="snapfly-cell" title="右半屏" @click="pick('R')">
        <span class="sf-prev"><i class="sf-fill" style="left:50%;top:0;width:50%;height:100%"></i></span>
      </button>
    </div>
    <div class="snapfly-grid">
      <button v-for="z in (['TL', 'TR', 'BL', 'BR'] as SnapZone[])" :key="z" class="snapfly-cell" :title="zoneTitle(z)" @click="pick(z)">
        <span class="sf-prev">
          <i class="sf-fill" :style="{
            left: z[1] === 'L' ? '0' : '50%', top: z[0] === 'T' ? '0' : '50%',
            width: '50%', height: '50%'
          }"></i>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWindows, type SnapZone } from '../stores/windows'

const props = defineProps<{ winId: number }>()
const emit = defineEmits<{ (e: 'keep'): void; (e: 'leave'): void }>()
const store = useWindows()

const ZT: Record<string, string> = { TL: '左上象限', TR: '右上象限', BL: '左下象限', BR: '右下象限' }
function zoneTitle(z: string) { return ZT[z] || z }
function pick(z: SnapZone) {
  store.snapTo(props.winId, z)
  emit('leave')
}
</script>
