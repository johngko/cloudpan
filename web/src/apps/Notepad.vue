<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" @click="save" :disabled="!canSave"><AppIcon name="check" :size="15" />保存</button>
      <div class="tool-sep"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ path || '未命名' }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ canSave ? (dirty ? '未保存' : '已保存') : '只读' }} · {{ content.length }} 字符</span>
    </div>
    <textarea v-model="content" spellcheck="false"
      style="flex: 1; background: transparent; border: none; resize: none; padding: 14px 18px; font-family: Consolas, 'Courier New', monospace; font-size: 13.5px; line-height: 1.6; color: var(--text); user-select: text"
      @keydown.ctrl.s.prevent="save"></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fsApi } from '../api/modules'
import { useWindows } from '../stores/windows'
import { useSession } from '../stores/session'
import { useToast } from '../stores/dialog'

const props = defineProps<{ winId: number; props: any }>()
const store = useWindows()
const session = useSession()
const toast = useToast()
const path = ref(props.props?.path || '')
const policyId = ref(props.props?.policyId || 0)
const content = ref('')
const dirty = ref(false)
const editable = ref(!!path.value && !!policyId.value)
// 游客为共享只读身份：可打开查看，但不可保存（后端 GuestReadOnly 兜底拦截）
const canSave = computed(() => editable.value && !session.isGuest)

onMounted(async () => {
  if (editable.value) {
    try {
      const d = await fsApi.readText(policyId.value, path.value)
      content.value = d.content
    } catch (e: any) {
      content.value = ''
      editable.value = false
    }
  }
})

async function save() {
  if (!canSave.value) return
  try {
    await fsApi.writeText(policyId.value, path.value, content.value)
    dirty.value = false
    window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId: policyId.value, path: path.value.slice(0, path.value.lastIndexOf('/')) || '/' } }))
  } catch (e: any) { toast.error('保存失败：' + e.message) }
}
</script>
