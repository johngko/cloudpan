<template>
  <div class="app-root sc">
    <div class="app-toolbar">
      <AppIcon name="share" :size="18" />
      <span class="sc-title">我的共享</span>
      <button class="tool-btn" @click="loadAll" title="刷新"><AppIcon name="refresh" :size="15" /></button>
      <div style="flex: 1"></div>
      <span class="sc-stats">{{ links.length }} 个链接分享 · {{ ushares.length }} 个内部共享</span>
    </div>

    <!-- 两个分享功能均停用/无权限（如游客）：统一空态，不显示死页签 -->
    <div v-if="!shareAvail && !ushAvail" class="sc-empty" style="flex: 1">
      分享 / 共享功能当前不可用（管理控制台 → 系统应用）
    </div>

    <template v-else>
    <div class="sc-tabs">
      <button class="sc-tab" :class="{ on: tab === 'link' }" @click="tab = 'link'">
        <AppIcon name="link" :size="14" /> 链接分享
      </button>
      <button class="sc-tab" :class="{ on: tab === 'ushare' }" @click="tab = 'ushare'">
        <AppIcon name="share2" :size="14" /> 内部共享
      </button>
    </div>

    <!-- 链接分享：/api/shares（Mine），外链 #/s/<token> -->
    <div v-show="tab === 'link'" class="sc-list">
      <div v-if="!shareAvail" class="sc-empty">「公开分享」功能已停用（管理控制台 → 系统应用）</div>
      <template v-else>
        <div v-if="!links.length" class="sc-empty">
          暂无链接分享 —— 在资源管理器中右键文件或文件夹，选「分享」即可生成外链
        </div>
        <div v-for="s in links" :key="s.id" class="sc-row">
          <div class="sc-ico"><AppIcon :name="s.encrypted ? 'lock' : 'link'" :size="22" /></div>
          <div class="sc-main">
            <div class="sc-name">{{ s.name || '(未命名)' }}
              <span v-if="s.encrypted" class="sc-badge e2e">E2E 加密</span>
              <span v-else-if="s.hasPassword" class="sc-badge pwd">需密码</span>
              <span v-if="expired(s)" class="sc-badge off">已过期</span>
              <span v-else-if="s.remainDownloads === 0" class="sc-badge off">次数已用完</span>
            </div>
            <div class="sc-path" :title="s.path">{{ s.path }}</div>
            <div class="sc-meta">
              <span>{{ expireText(s) }}</span>
              <span>剩余 {{ s.remainDownloads < 0 ? '不限' : s.remainDownloads + ' 次' }}</span>
              <span>浏览 {{ s.views }}</span>
              <span>下载 {{ s.downloads }}</span>
              <span>{{ fmtDate(s.createdAt) }}</span>
            </div>
          </div>
          <div class="sc-ops">
            <button class="tool-btn" :disabled="expired(s) || s.remainDownloads === 0" @click="copyLink(s)">
              <AppIcon name="copy" :size="14" /> 复制链接
            </button>
            <button class="tool-btn danger" @click="cancelLink(s)"><AppIcon name="trash" :size="14" /> 取消分享</button>
          </div>
        </div>
      </template>
    </div>

    <!-- 内部共享：/api/usershares（Mine），共享给指定用户/用户组/所有人 -->
    <div v-show="tab === 'ushare'" class="sc-list">
      <div v-if="!ushAvail" class="sc-empty">「内部共享」功能已停用（管理控制台 → 系统应用）</div>
      <template v-else>
        <div v-if="!ushares.length" class="sc-empty">
          暂无内部共享 —— 在资源管理器中右键目录，选「共享给…」可共享给指定用户或用户组
        </div>
        <div v-for="s in ushares" :key="s.id" class="sc-row">
          <div class="sc-ico"><AppIcon :name="s.targetType === 'all' ? 'share2' : 'user'" :size="22" /></div>
          <div class="sc-main">
            <div class="sc-name">{{ s.name || '(未命名)' }}
              <span class="sc-badge" :class="s.perm === 'rw' ? 'rw' : 'ro'">{{ s.perm === 'rw' ? '读写' : '只读' }}</span>
            </div>
            <div class="sc-path" :title="s.path">{{ s.path }}</div>
            <div class="sc-meta">
              <span class="sc-target">共享给 {{ s.targetName }}</span>
              <span>浏览 {{ s.views }}</span>
              <span>下载 {{ s.downloads }}</span>
              <span>{{ fmtDate(s.createdAt) }}</span>
            </div>
          </div>
          <div class="sc-ops">
            <button class="tool-btn danger" @click="cancelUshare(s)"><AppIcon name="trash" :size="14" /> 取消共享</button>
          </div>
        </div>
      </template>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { shareApi, userShareApi } from '../api/modules'
import { useAppState } from '../stores/appstate'
import { useUiDialog, useToast } from '../stores/dialog'
import { copyText } from '../utils/clipboard'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()
const appstate = useAppState()
const uiDlg = useUiDialog()
const toast = useToast()

const tab = ref<'link' | 'ushare'>('link')
const links = ref<any[]>([])
const ushares = ref<any[]>([])

// 双功能独立门控（与后端 AppGate 一致）：某功能停用/无权限时对应页签显示提示而非报错
const shareAvail = appstate.isAvailable('share')
const ushAvail = appstate.isAvailable('usershare')

onMounted(loadAll)

async function loadAll() {
  if (shareAvail) {
    try { links.value = (await shareApi.mine()) || [] } catch (e: any) { toast.error(e.message) }
  } else links.value = []
  if (ushAvail) {
    try { ushares.value = (await userShareApi.mine()) || [] } catch (e: any) { toast.error(e.message) }
  } else ushares.value = []
}

// 与 Explorer 分享弹窗同构：origin + pathname + #/s/<token>
function copyLinkUrl(s: any) {
  return location.origin + location.pathname + '#/s/' + s.token
}
async function copyLink(s: any) {
  const ok = await copyText(copyLinkUrl(s))
  toast[ok ? 'success' : 'error'](ok ? '分享链接已复制' : '复制失败，请手动复制')
}
function expired(s: any) {
  return !!(s.expiresAt && new Date(s.expiresAt).getTime() < Date.now())
}
function expireText(s: any) {
  if (!s.expiresAt) return '永久有效'
  return '有效期至 ' + fmtDate(s.expiresAt)
}
function fmtDate(t: any) {
  if (!t) return ''
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
async function cancelLink(s: any) {
  const ok = await uiDlg.confirm('取消分享', `确定取消「${s.name || s.path}」的分享？取消后链接立即失效，无法恢复。`, { danger: true, okText: '取消分享' })
  if (!ok) return
  try { await shareApi.cancel(s.id); toast.success('已取消分享'); loadAll() } catch (e: any) { toast.error(e.message) }
}
async function cancelUshare(s: any) {
  const ok = await uiDlg.confirm('取消共享', `确定取消「${s.name || s.path}」共享给 ${s.targetName}？对方将无法再访问该目录。`, { danger: true, okText: '取消共享' })
  if (!ok) return
  try { await userShareApi.cancel(s.id); toast.success('已取消共享'); loadAll() } catch (e: any) { toast.error(e.message) }
}
</script>

<style scoped>
.sc { display: flex; flex-direction: column; }
.sc-title { font-size: 13px; font-weight: 600; margin-left: 8px }
.sc-stats { font-size: 12px; color: var(--text-3) }
.sc-tabs {
  display: flex; gap: 6px; padding: 2px 12px 8px;
}
.sc-tab {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 14px; font-size: 12px; border: 1px solid var(--stroke-b);
  border-radius: 999px; background: var(--bg40); color: var(--text-2); cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.sc-tab:hover { background: var(--bg50) }
.sc-tab.on { background: var(--theme-1); border-color: var(--theme-1); color: #fff }
.sc-list { flex: 1; overflow: auto; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 8px }
.sc-empty {
  padding: 40px 20px; text-align: center; font-size: 13px; color: var(--text-3);
}
.sc-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid var(--stroke-b); border-radius: 10px; background: var(--bg40);
}
.sc-row:hover { background: var(--bg50) }
.sc-ico {
  flex: none; width: 40px; height: 40px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
  background: var(--bg50);
}
.sc-main { flex: 1; min-width: 0 }
.sc-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.sc-path {
  font-size: 11px; color: var(--text-3); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sc-meta { display: flex; gap: 12px; margin-top: 4px; font-size: 11px; color: var(--text-3); flex-wrap: wrap }
.sc-target { color: var(--theme-1); font-weight: 500 }
.sc-badge {
  font-size: 10px; font-weight: 500; padding: 1px 7px; border-radius: 999px;
  background: var(--bg50); color: var(--text-2);
}
.sc-badge.e2e { background: rgba(31, 168, 79, 0.15); color: #1fa84f }
.sc-badge.pwd { background: rgba(232, 163, 61, 0.18); color: #b07615 }
.sc-badge.rw { background: rgba(1, 131, 251, 0.15); color: var(--theme-1) }
.sc-badge.off { background: rgba(224, 82, 82, 0.15); color: #d04545 }
.sc-ops { flex: none; display: flex; flex-direction: column; gap: 6px }
.sc-ops .tool-btn { font-size: 11px; padding: 4px 10px }
.sc-ops .tool-btn.danger { color: #d04545; border-color: rgba(224, 82, 82, 0.35) }
.sc-ops .tool-btn.danger:hover { background: rgba(224, 82, 82, 0.08) }
</style>
