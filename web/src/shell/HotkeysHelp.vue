<template>
  <div class="hotkeys-mask" @click.self="$emit('close')">
    <div class="hotkeys-card">
      <div class="hk-head">
        <span class="hk-title">键盘快捷键</span>
        <button class="hk-close" @click="$emit('close')"><AppIcon name="close" :size="13" /></button>
      </div>
      <div class="hk-cols">
        <div v-for="g in groups" :key="g.title" class="hk-group">
          <div class="hk-gtitle">{{ g.title }}</div>
          <div v-for="r in g.rows" :key="r.desc" class="hk-row">
            <span class="hk-keys"><kbd v-for="k in r.keys" :key="k">{{ k }}</kbd></span>
            <span class="hk-desc">{{ r.desc }}</span>
          </div>
        </div>
      </div>
      <div class="hk-foot">按 ? 或 Esc 关闭</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { hotkeyGroups, type HotkeyGroup } from './hotkeys'
import AppIcon from '../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'close'): void }>()

// 资源管理器键位在 Explorer.vue 内部处理（仅激活窗口响应），不在 shell 注册表里，
// 速查表用静态数据补一组（与 apps/Explorer.vue onKey 保持一致）
const EXPLORER_GROUP: HotkeyGroup = {
  title: '资源管理器（列表焦点时）',
  rows: [
    { keys: ['F2'], desc: '重命名选中项' },
    { keys: ['Delete / Ctrl+D'], desc: '删除选中项（进回收站）' },
    { keys: ['Ctrl', 'C / X / V'], desc: '复制 / 剪切 / 粘贴' },
    { keys: ['Ctrl', 'A'], desc: '全选' },
    { keys: ['Ctrl', 'F'], desc: '当前文件夹内过滤' },
    { keys: ['Ctrl+Shift', 'N'], desc: '新建文件夹' },
    { keys: ['Alt', '← / →'], desc: '后退 / 前进' },
    { keys: ['Backspace'], desc: '返回上级目录' },
    { keys: ['Enter'], desc: '打开选中项' },
    { keys: ['Alt+Enter'], desc: '查看属性' },
    { keys: ['Alt', 'P'], desc: '开关预览窗格' },
    { keys: ['F5'], desc: '刷新' },
  ],
}
const groups = computed(() => [...hotkeyGroups(), EXPLORER_GROUP])

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
