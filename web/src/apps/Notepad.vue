<template>
  <div class="app-root">
    <div class="app-toolbar">
      <button class="tool-btn" @click="save" :disabled="!canSave"><AppIcon name="check" :size="15" />保存</button>
      <button class="tool-btn" @click="openShare" :disabled="!canSave || shareBusy" title="生成公开分享链接，任何人打开链接即可在线阅读（Markdown 自动渲染）">
        <AppIcon name="share2" :size="15" />分享
      </button>
      <div class="tool-sep"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ path || '未命名' }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">{{ canSave ? (dirty ? '未保存' : '已保存') : '只读' }} · {{ content.length }} 字符</span>
    </div>
    <textarea v-model="content" spellcheck="false"
      style="flex: 1; background: transparent; border: none; resize: none; padding: 14px 18px; font-family: Consolas, 'Courier New', monospace; font-size: 13.5px; line-height: 1.6; color: var(--text); user-select: text"
      @keydown.ctrl.s.prevent="save"></textarea>

    <!-- 分享对话框：公开链接在线阅读（.md 渲染 / .txt 原文） -->
    <div class="dialog-mask" v-if="shareShow" @click.self="shareShow = false">
      <div class="dialog" style="width: 400px">
        <h3>分享「{{ fileName }}」</h3>
        <div v-if="!shareLink">
          <div class="row">
            <label>提取码（留空则公开）</label>
            <input class="input" v-model="sharePwd" placeholder="4-6 位" style="width: 100%" />
          </div>
          <div class="row">
            <label>有效期</label>
            <select class="input" v-model.number="shareExpire" style="width: 100%">
              <option :value="0">永久有效</option>
              <option :value="1">1 天</option>
              <option :value="7">7 天</option>
              <option :value="30">30 天</option>
            </select>
          </div>
          <div class="row" style="font-size: 12px; color: var(--text-3)">
            对方打开链接即可在线阅读（无需登录）；.md 文件将渲染为 Markdown
          </div>
          <div v-if="shareMsg" style="font-size: 12.5px; color: #ff8a80; margin-bottom: 8px">{{ shareMsg }}</div>
          <div class="actions">
            <button class="btn" @click="shareShow = false">取消</button>
            <button class="btn primary" :disabled="shareBusy" @click="doShare">{{ shareBusy ? '创建中…' : '创建链接' }}</button>
          </div>
        </div>
        <div v-else>
          <div class="row" style="background: #3b91d818; border-radius: 6px; padding: 10px; font-size: 12.5px; word-break: break-all; user-select: text; cursor: text" title="点选后可手动复制">
            {{ shareLink }}
          </div>
          <div v-if="shareMsg" style="font-size: 12.5px; color: #ff8a80; margin-bottom: 8px">{{ shareMsg }}</div>
          <div class="actions">
            <button class="btn" @click="shareShow = false">关闭</button>
            <button class="btn primary" @click="copyShare">复制链接</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fsApi, shareApi } from '../api/modules'
import { useWindows } from '../stores/windows'
import { useToast } from '../stores/dialog'
import { copyText } from '../utils/clipboard'

const props = defineProps<{ winId: number; props: any }>()
const store = useWindows()
const toast = useToast()
const path = ref(props.props?.path || '')
const policyId = ref(props.props?.policyId || 0)
const content = ref('')
const dirty = ref(false)
const editable = ref(!!path.value && !!policyId.value)
// 保存 = 往自己盘写文本文件（/api/fs/text 在游客白名单内，受 24h TTL 管理）
const canSave = computed(() => editable.value)
const fileName = computed(() => (path.value || '未命名').split('/').pop() || '未命名')

// ---- 在线分享：公开链接在线阅读（复用公开分享体系，分享页对 .md 渲染 Markdown）----
const shareShow = ref(false)
const sharePwd = ref('')
const shareExpire = ref(0)
const shareLink = ref('')
const shareBusy = ref(false)
const shareMsg = ref('')
function openShare() {
  sharePwd.value = ''; shareExpire.value = 0; shareLink.value = ''; shareMsg.value = ''
  shareShow.value = true
}
async function doShare() {
  shareBusy.value = true; shareMsg.value = ''
  try {
    const s = await shareApi.create({
      policyId: policyId.value, path: path.value,
      password: sharePwd.value || undefined, expireDays: shareExpire.value,
      remainDownloads: 0, allowDownload: true, previewEnabled: true, allowEdit: false
    })
    shareLink.value = location.origin + location.pathname + '#/s/' + s.token
  } catch (e: any) {
    shareMsg.value = e?.message || '创建失败'
  } finally {
    shareBusy.value = false
  }
}
// HTTP 非安全上下文下 navigator.clipboard 不可用，copyText 内部回退 execCommand
async function copyShare() {
  const ok = await copyText(shareLink.value)
  if (ok) toast.success('链接已复制')
  else shareMsg.value = '复制失败，请选中上方链接后按 Ctrl+C 复制'
}

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
