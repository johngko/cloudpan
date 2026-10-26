<template>
  <!-- 全局对话框（A8：原生 <dialog> showModal —— 顶层堆叠、原生焦点陷阱/Esc/焦点归还，
       遮罩用 ::backdrop，入口动画用 @starting-style） -->
  <dialog class="dlg-host-mask" ref="dlgEl" v-if="dlg.d" :aria-label="dlg.d.title"
    @close="onNativeClose" @click="onBackdrop">
    <div class="dlg-host" :class="{ danger: dlg.d.danger }">
      <div class="dlg-title">{{ dlg.d.title }}</div>
      <div class="dlg-msg" v-if="dlg.d.message">{{ dlg.d.message }}</div>
      <input v-if="dlg.d.kind === 'prompt'" class="input dlg-input" v-model="dlg.d.inputValue"
        ref="inputEl" @keyup.enter="dlg.ok()" />
      <div class="dlg-btns">
        <button v-if="dlg.d.kind !== 'alert'" class="btn" @click="dlg.cancel()">{{ dlg.d.cancelText }}</button>
        <button class="btn" :class="dlg.d.danger ? 'danger' : 'primary'" @click="dlg.ok()">{{ dlg.d.okText }}</button>
      </div>
    </div>
  </dialog>
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
const dlgEl = ref<HTMLDialogElement | null>(null)

// Esc / backdrop-cancel 走原生 close：把未决对话框按「取消」落定
function onNativeClose() {
  if (dlg.d) dlg.cancel()
}
// 点遮罩（事件 target 落在 dialog 自身而非卡片）= 取消
function onBackdrop(e: MouseEvent) {
  if (e.target === dlgEl.value) dlg.cancel()
}

// 焦点陷阱/Esc/焦点归还原生由 <dialog> 负责，这里只管开合与输入聚焦
watch(() => dlg.d, async d => {
  if (!d) {
    if (dlgEl.value?.open) dlgEl.value.close()
    return
  }
  await nextTick()
  try { dlgEl.value?.showModal() } catch { /* 已在 open 状态时重复调用会抛，忽略 */ }
  if (d.kind === 'prompt') {
    inputEl.value?.focus()
    inputEl.value?.select()
  }
}, { immediate: true })
</script>

<style scoped>
.dlg-host-mask {
  /* 原生 <dialog>：撑满视口做居中容器，遮罩色放 ::backdrop（A8 顶层浮层写法） */
  position: fixed; inset: 0; margin: 0; width: 100vw; height: 100vh;
  max-width: 100vw; max-height: 100vh; padding: 0; border: 0; background: transparent;
  display: grid; place-items: center;
}
.dlg-host-mask::backdrop {
  background: rgba(0,0,0,0.28);
  transition: opacity 0.16s ease, overlay 0.16s allow-discrete;
}
@starting-style {
  .dlg-host-mask::backdrop { opacity: 0; }
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
