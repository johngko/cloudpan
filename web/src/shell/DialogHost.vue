<template>
  <!-- 全局对话框 -->
  <div class="dlg-host-mask" v-if="dlg.d" @click.self="dlg.cancel()">
    <div class="dlg-host" ref="dlgEl" role="dialog" aria-modal="true" :aria-label="dlg.d.title" tabindex="-1"
      :class="{ danger: dlg.d.danger }">
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
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useUiDialog, useToast } from '../stores/dialog'
import AppIcon from '../components/AppIcon.vue'

const dlg = useUiDialog()
const toast = useToast()
const inputEl = ref<HTMLInputElement>()
const dlgEl = ref<HTMLElement | null>(null)
// 打开前的焦点元素：关闭时归还焦点（无障碍）
let prevFocus: HTMLElement | null = null

// 模态键盘行为：Esc 取消；Tab 焦点陷阱（只在对话框内循环，不逃逸到背后的桌面）
function onDocKey(e: KeyboardEvent) {
  if (!dlg.d) return
  if (e.key === 'Escape') { e.preventDefault(); dlg.cancel(); return }
  if (e.key !== 'Tab') return
  const root = dlgEl.value
  if (!root) return
  const focusables = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const act = document.activeElement as HTMLElement | null
  if (e.shiftKey && (act === first || !act || !root.contains(act))) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus() }
}

watch(() => dlg.d, async d => {
  if (!d) {
    document.removeEventListener('keydown', onDocKey, true)
    const p = prevFocus
    prevFocus = null
    p?.focus?.() // 归还焦点
    return
  }
  prevFocus = document.activeElement as HTMLElement | null
  document.addEventListener('keydown', onDocKey, true)
  await nextTick()
  if (d.kind === 'prompt') {
    inputEl.value?.focus()
    inputEl.value?.select()
  } else {
    dlgEl.value?.focus() // 非输入型对话框：焦点进对话框，Tab/Esc 才生效
  }
})

onBeforeUnmount(() => document.removeEventListener('keydown', onDocKey, true))
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
.dlg-host { outline: none; }
.dlg-host:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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
.toast-item.success { color: var(--success); }
</style>
