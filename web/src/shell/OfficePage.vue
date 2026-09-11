<template>
  <div class="office-page">
    <!-- 顶栏：文件图标 + 名称 +（只读徽标）+ 分享 + 关闭（Cloudreve 整页编辑器同款） -->
    <div class="office-topbar">
      <AppIcon :name="isPdf ? 'file' : 'office'" :size="20" />
      <span class="office-title">{{ title || '在线 Office' }}</span>
      <span v-if="mode === 'view'" class="office-badge">只读</span>
      <div style="flex: 1"></div>
      <button v-if="canShare" class="office-btn" @click="openShareDlg">
        <AppIcon name="share2" :size="15" /> 分享
      </button>
      <button class="office-btn" title="关闭" @click="close">
        <AppIcon name="close" :size="16" />
      </button>
    </div>

    <!-- 编辑器主体：ONLYOFFICE DocsAPI 撑满整页 -->
    <div class="office-body">
      <div v-if="loading" class="office-status">
        <AppIcon name="office" :size="44" />
        <div class="office-status-text">正在加载在线编辑器…</div>
      </div>
      <div v-else-if="errorMsg" class="office-status">
        <AppIcon name="info" :size="44" />
        <div class="office-status-text" style="max-width: 420px">{{ errorMsg }}</div>
        <button class="office-btn primary" @click="download">下载文件</button>
      </div>
      <div id="cp-office-page" style="position: absolute; inset: 0"></div>
    </div>

    <!-- 分享对话框（本地盘文件） -->
    <div class="dialog-mask" v-if="shareShow" @click.self="shareShow = false">
      <div class="dialog" style="width: 400px">
        <h3>分享「{{ title }}」</h3>
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
        <div class="row" style="font-size: 12px; color: var(--text-3, #888)">
          打开分享链接即可在线预览与编辑（完整 ONLYOFFICE 编辑器），编辑保存自动归档版本
        </div>
        <div v-if="shareLink" class="row" style="background: #3b91d818; border-radius: 6px; padding: 10px; font-size: 12.5px; word-break: break-all; user-select: text; cursor: text" title="点选后可手动复制">
          {{ shareLink }}
        </div>
        <div v-if="shareMsg" style="font-size: 12.5px; color: #ff8a80; margin-bottom: 8px">{{ shareMsg }}</div>
        <div class="actions">
          <button class="btn" @click="shareShow = false">关闭</button>
          <button v-if="!shareLink" class="btn primary" :disabled="shareBusy" @click="doShare">{{ shareBusy ? '创建中…' : '创建链接' }}</button>
          <button v-else class="btn primary" @click="copyLink">复制链接</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 整页 Office 编辑器（Cloudreve 模式）：
// - /office?policyId=&path= 或 /office?shareId=&rel=（登录态：自己的盘/共享盘文件）
// - /s/:token/office?path=&st=（公开分享链接：任何人可打开，编辑权限由分享者设置决定）
// 编辑器撑满整页，顶栏仅保留文件信息与关闭按钮——与 Cloudreve 的整页编辑器一致
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import AppIcon from '../components/AppIcon.vue'
import { get, getToken } from '../api/http'
import { shareApi, userShareApi, downloadUrl } from '../api/modules'
import { copyText } from '../utils/clipboard'

const route = useRoute()
const q = route.query as Record<string, string>
const isShare = computed(() => String(route.path).startsWith('/s/'))
const shareToken = String(route.params.token || '')
const isLocalAuth = computed(() => !isShare.value && !!q.policyId)
const canShare = computed(() => isLocalAuth.value && !!getToken())
const isPdf = computed(() => (q.path || '').toLowerCase().endsWith('.pdf') || (q.rel || '').toLowerCase().endsWith('.pdf'))

const title = ref(decodeURIComponent(q.path || q.rel || '').split('/').filter(Boolean).pop() || '')
const mode = ref('edit')
const loading = ref(true)
const errorMsg = ref('')
let editor: any = null

async function loadScript(src: string): Promise<void> {
  if ((window as any).DocsAPI) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('无法加载 ONLYOFFICE api.js'))
    document.head.appendChild(s)
  })
}

async function loadConfig(): Promise<any> {
  if (isShare.value) {
    // 匿名端点（公开分享）
    const pub = axios.create({ baseURL: '/api' })
    const r: any = (await pub.get(`/s/${shareToken}/office`, {
      params: { path: q.path || '', st: q.st || '' }
    })).data
    if (r.code !== 0) throw new Error(r.msg || '无法打开在线编辑器')
    return r.data
  }
  const qs = q.shareId
    ? `shareId=${q.shareId}&rel=${encodeURIComponent(q.rel || '')}`
    : `policyId=${q.policyId}&path=${encodeURIComponent(q.path || '')}`
  return get<any>(`/office/config?${qs}&mode=${q.mode || 'edit'}`)
}

async function init(d: any) {
  await loadScript(d.documentServer + '/web-apps/apps/api/documents/api.js')
  if (d.config?.document?.title) title.value = d.config.document.title
  mode.value = d.config?.editorConfig?.mode || 'edit'
  editor = new (window as any).DocsAPI.DocEditor('cp-office-page', {
    ...d.config,
    width: '100%',
    height: '100%',
    events: {
      onError: () => {
        try { editor?.destroyEditor?.() } catch {}
        editor = null
        errorMsg.value = '编辑器加载失败，请检查 Document Server 状态后重试，或下载文件查看。'
      }
    }
  })
  loading.value = false
}

onMounted(async () => {
  try {
    await init(await loadConfig())
  } catch (e: any) {
    errorMsg.value = e?.message || '无法打开在线编辑器'
  } finally {
    if (editor) loading.value = false
    else if (!errorMsg.value) loading.value = false
  }
})

onBeforeUnmount(() => {
  try { editor?.destroyEditor?.() } catch {}
})

function close() {
  try { editor?.destroyEditor?.() } catch {}
  // 从桌面/分享页进入则回退；直接打开 URL 的标签页回落到对应入口页
  if (window.history.length > 2) {
    history.back()
  } else {
    location.hash = isShare.value ? `#/s/${shareToken}` : '#/boot'
  }
}

function download() {
  if (isShare.value) {
    window.open(`/api/s/${shareToken}/download?st=${encodeURIComponent(q.st || '')}&path=${encodeURIComponent(q.path || '')}`)
  } else if (q.shareId) {
    window.open(userShareApi.dlUrl(q.shareId, q.rel || ''))
  } else {
    window.open(downloadUrl(Number(q.policyId), [q.path || '']))
  }
}

// ---- 分享（本地盘文件）----
const shareShow = ref(false)
const sharePwd = ref('')
const shareExpire = ref(0)
const shareLink = ref('')
const shareBusy = ref(false)
const shareMsg = ref('')
function openShareDlg() {
  sharePwd.value = ''; shareExpire.value = 0; shareLink.value = ''; shareMsg.value = ''
  shareShow.value = true
}
async function doShare() {
  shareBusy.value = true; shareMsg.value = ''
  try {
    const s = await shareApi.create({
      policyId: Number(q.policyId), path: q.path || '',
      password: sharePwd.value || undefined, expireDays: shareExpire.value,
      remainDownloads: 0, allowDownload: true, previewEnabled: true, allowEdit: true
    })
    shareLink.value = location.origin + location.pathname + '#/s/' + s.token
  } catch (e: any) {
    shareMsg.value = e?.message || '创建失败'
  } finally {
    shareBusy.value = false
  }
}
// HTTP 环境（非安全上下文）下 navigator.clipboard 不可用，copyText 内部回退 execCommand
async function copyLink() {
  const ok = await copyText(shareLink.value)
  if (ok) {
    shareShow.value = false
  } else {
    shareMsg.value = '复制失败，请选中上方链接后按 Ctrl+C 复制'
  }
}
</script>

<style scoped>
.office-page {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  background: #f0f2f5; z-index: 9999;
}
.office-topbar {
  flex: none; height: 46px; display: flex; align-items: center; gap: 10px;
  padding: 0 14px; background: #1e1f22; color: #e8e8ea;
}
.office-title {
  font-size: 14px; font-weight: 500; max-width: 46vw;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.office-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
  background: rgba(255, 193, 7, 0.16); color: #ffd54f;
}
.office-btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.08);
  color: #e8e8ea; border-radius: 8px; padding: 5px 12px; font-size: 12.5px;
  cursor: pointer;
}
.office-btn:hover { background: rgba(255, 255, 255, 0.16); }
.office-btn.primary {
  background: #3b91d8; border-color: #3b91d8; color: #fff;
}
.office-body {
  flex: 1; position: relative; overflow: hidden;
}
.office-status {
  position: absolute; inset: 0; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  color: #667; font-size: 14px;
}
.office-status-text { max-width: 420px; text-align: center; line-height: 1.7; }
</style>
