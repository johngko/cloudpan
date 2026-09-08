<template>
  <!-- 全局对话框 -->
  <div class="dlg-host-mask" v-if="dlg.d" @click.self="dlg.cancel()">
    <div class="dlg-host" :class="{ danger: dlg.d.danger }">
      <div class="dlg-title">{{ dlg.d.title }}</div>
      <div class="dlg-msg" v-if="dlg.d.message">{{ dlg.d.message }}</div>
      <input v-if="dlg.d.kind === 'prompt'" class="input dlg-input" v-model="dlg.d.inputValue"
        ref="inputEl" @keyup.enter="dlg.ok()" @keyup.esc="dlg.cancel()" />
      <div class="dlg-btns">
        <button v-if="dlg.d.kind !== 'alert'" class="btn" @click="dlg.cancel()">{{ dlg.d.cancelText }}</button>
        <button class="btn" :class="dlg.d.danger ? 'danger' : 'primary'" @click="dlg.ok()">{{ dlg.d.okText }}</button>
      </div>
    </div>
  </div>
  <!-- 全局 Toast -->
  <div class="toast-wrap">
    <div v-for="t in toast.list" :key="t.id" class="toast-item" :class="t.kind">
      <AppIcon :name="t.kind === 'error' ? 'close' : t.kind === 'success' ? 'check' : 'info'" :size="15" />
      <span>{{ t.text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useUiDialog, useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

const dlg = useUiDialog()
const toast = useToast()
const inputEl = ref<HTMLInputElement>()

watch(() => dlg.d, async d => {
  if (d?.kind === 'prompt') {
    await nextTick()
    inputEl.value?.focus()
    inputEl.value?.select()
  }
})
</script>

<style scoped>
.dlg-host-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.28); z-index: 9500;
  display: flex; align-items: center; justify-content: center;
}
.dlg-host {
  width: 400px; max-width: 90vw; border-radius: var(--radius-2xl); padding: 22px 24px;
  background: var(--bg50); backdrop-filter: blur(48px) saturate(2);
  border: 1px solid var(--stroke); box-shadow: var(--shadow);
  animation: rise 0.16s ease;
}
.dlg-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.dlg-msg { font-size: 13px; color: var(--text-2); line-height: 1.6; margin-bottom: 6px; }
.dlg-input { width: 100%; margin-top: 8px; }
.dlg-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.toast-wrap {
  position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 9800;
  display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none;
}
.toast-item {
  display: flex; align-items: center; gap: 8px; padding: 9px 18px;
  border-radius: var(--radius-2xl); font-size: 13px; color: var(--text);
  background: var(--bg70); backdrop-filter: blur(32px) saturate(2);
  border: 1px solid var(--stroke); box-shadow: var(--shadow);
  animation: rise 0.2s ease;
}
.toast-item.error { color: var(--danger); }
.toast-item.success { color: #2e9e5b; }
</style>
