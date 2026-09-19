<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSession } from '../stores/session'
import { termApi, type SshConnView } from '../api/modules'
import TermPanel from './terminal/TermPanel.vue'
import SftpPanel from './terminal/SftpPanel.vue'
import ConnDialog from './terminal/ConnDialog.vue'

/**
 * 终端应用：本地真实 shell（PTY/ConPTY）/ 远程 SSH 终端 + SFTP 文件管理
 * 契约：{ winId, props }；关闭按钮 → cp-close-window
 */
const props = defineProps<{ winId: number; props: any }>()
const session = useSession()

// 安全边界：本地终端 = 项目服务器 shell，仅管理员；其他用户（含访客）即使被授权
// 也只能用 SSH 远程终端连自己的服务器（后端 WS 对非 admin 的 local 模式直接 403）
const isAdmin = computed(() => session.user?.role === 'admin')
const mode = ref<'local' | 'ssh'>(props.props?.mode === 'ssh' || !isAdmin.value ? 'ssh' : 'local')
const shell = ref('')
const shells = ref<string[]>([])
const os = ref('linux')

const conns = ref<SshConnView[]>([])
const connId = ref<number | null>(null)
const connOpen = ref(false)

const status = ref<'connecting' | 'ready' | 'closed' | 'error'>('connecting')
const statusMsg = ref('')
const helloInfo = ref<{ os?: string; shell?: string; host?: string; user?: string }>({})
const panelVisible = ref(true)
const toast = ref<{ msg: string; type: 'ok' | 'err' } | null>(null)

const termRef = ref<InstanceType<typeof TermPanel> | null>(null)

function closeWindow() {
  window.dispatchEvent(new CustomEvent('cp-close-window', { detail: props.winId }))
}

function onToast(msg: string, type: 'ok' | 'err' = 'ok') {
  toast.value = { msg, type }
  setTimeout(() => { toast.value = null }, 2600)
}

async function loadConns(select?: number) {
  conns.value = await termApi.conns()
  if (select) connId.value = select
  else if (!conns.value.find(c => c.id === connId.value)) connId.value = conns.value[0]?.id ?? null
}

onMounted(async () => {
  try {
    const p = await termApi.platform()
    os.value = p.os
    shells.value = p.shells
    shell.value = p.defaultShell
  } catch {
    shells.value = ['bash']
    shell.value = '/bin/bash'
  }
  try {
    await loadConns(props.props?.connId)
  } catch { /* 无连接也可用本地模式 */ }
})

// 切到 SSH 模式但没有选中连接 → 打开管理对话框
watch(mode, m => {
  if (m === 'ssh' && !connId.value) connOpen.value = true
})

const sftpKey = computed(() => connId.value)
// 本地模式必须等 platform 接口给出 defaultShell 后再挂面板：否则 TermPanel 会以
// 空 shell 先发一条 WS（服务端起一次完整会话），shell 解析完再重连——白白多占一个
// 终端并发槽位，且旧连接的异步 onclose 可能覆盖新会话状态
const termReady = computed(() => (mode.value === 'local' ? !!shell.value : !!connId.value))

const statusText = computed(() => {
  if (status.value === 'connecting') return '连接中'
  if (status.value === 'ready') {
    if (mode.value === 'local') return helloInfo.value.shell ? '本地 · ' + helloInfo.value.shell.split('/').pop() : '本地终端'
    return helloInfo.value.host ? `${helloInfo.value.user}@${helloInfo.value.host}` : '远程 SSH'
  }
  if (status.value === 'error') return '连接失败'
  return '已断开'
})

function onHello(m: any) {
  helloInfo.value = m
}
function onStatus(s: typeof status.value, msg?: string) {
  status.value = s
  statusMsg.value = msg || ''
  if (s === 'ready') helloInfo.value = {}
}
</script>

<template>
  <div class="app-root term-app">
    <!-- 工具栏 -->
    <div class="term-toolbar">
      <div class="term-seg">
        <button v-if="isAdmin" :class="{ on: mode === 'local' }" @click="mode = 'local'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></svg>
          本地终端
        </button>
        <button :class="{ on: mode === 'ssh' }" @click="mode = 'ssh'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
          远程 SSH
        </button>
      </div>

      <!-- 本地模式：shell 选择 -->
      <div v-if="mode === 'local'" class="term-shell">
        <select v-model="shell" class="term-select" title="选择 shell">
          <option v-for="s in shells" :key="s" :value="s">{{ s.split('/').pop() }}</option>
        </select>
      </div>

      <!-- SSH 模式：连接选择 -->
      <div v-else class="term-conn">
        <select :value="connId ?? ''" class="term-select"
                @change="connId = Number(($event.target as HTMLSelectElement).value)" title="选择连接">
          <option v-for="c in conns" :key="c.id" :value="c.id">{{ c.name }}（{{ c.host }}:{{ c.port }}）</option>
        </select>
        <button class="term-icon-btn" title="管理连接" @click="connOpen = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
        </button>
      </div>

      <!-- 右侧操作 -->
      <div class="term-ops">
        <span class="term-status" :class="'st-' + status">
          <i class="dot"></i>{{ statusText }}
        </span>
        <button class="term-icon-btn" title="清屏" @click="termRef?.clear()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" /></svg>
        </button>
        <button v-if="mode === 'ssh'" class="term-icon-btn" :class="{ on: panelVisible }"
                :title="panelVisible ? '隐藏文件面板' : '显示文件面板'" @click="panelVisible = !panelVisible">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
        </button>
        <button v-if="status === 'closed' || status === 'error'" class="term-reconnect" @click="termRef?.reconnect()">重连</button>
        <button class="term-icon-btn" title="关闭终端" @click="closeWindow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>

    <!-- 主体：终端 + SFTP 面板 -->
    <div class="term-body">
      <div class="term-main">
        <TermPanel v-if="termReady"
                   ref="termRef"
                   :mode="mode" :shell="shell" :conn-id="connId"
                   @status="onStatus" @hello="onHello" />
        <!-- 空状态：SSH 模式未选连接 -->
        <div v-else class="term-void">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
          <p>还没有 SSH 连接 —— 先添加一个远程主机</p>
          <button class="btn primary" @click="connOpen = true">管理连接</button>
        </div>

        <!-- 遮罩：断连 / 失败 -->
        <div v-if="termReady && (status === 'closed' || status === 'error')" class="term-overlay" :class="{ err: status === 'error' }">
          <div class="term-overlay-card">
            <div class="term-overlay-icon">
              <svg v-if="status === 'error'" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              <svg v-else width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
            </div>
            <b>{{ status === 'error' ? '连接失败' : '会话已结束' }}</b>
            <p>{{ statusMsg || (mode === 'local' ? 'Shell 进程已退出，可重新连接' : '与远程主机的连接已断开') }}</p>
            <button class="btn primary" @click="termRef?.reconnect()">重新连接</button>
          </div>
        </div>
      </div>
      <SftpPanel v-if="mode === 'ssh' && connId && panelVisible"
                 :key="sftpKey" :conn-id="connId" @toast="onToast" />
    </div>

    <ConnDialog v-if="connOpen" @close="connOpen = false"
                @saved="(cs, sel) => { loadConns(sel) }" @toast="onToast" />

    <!-- 轻提示 -->
    <Teleport to="body">
      <Transition name="tst">
        <div v-if="toast" class="term-toast" :class="toast.type">
          <svg v-if="toast.type === 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5" /></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg>
          {{ toast.msg }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.term-app {
  display: flex;
  flex-direction: column;
  background: #16171d;
  overflow: hidden;
}

/* ---- 工具栏 ---- */
.term-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: var(--card);
  border-bottom: 1px solid var(--stroke);
  flex: none;
  flex-wrap: wrap;
}
.term-seg {
  display: flex;
  padding: 3px;
  background: var(--bg70);
  border-radius: 10px;
  gap: 2px;
}
.term-seg button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  font-size: 12.5px;
  border: none;
  background: transparent;
  color: var(--text-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.term-seg button:hover { color: var(--text); }
.term-seg button.on {
  background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-1) 35%, transparent);
}
.term-shell { display: flex; }
.term-select {
  font-size: 12.5px;
  padding: 5px 8px;
  border: 1px solid var(--stroke-b);
  background: var(--card);
  color: var(--text);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
  max-width: 240px;
}
.term-select:focus { border-color: var(--theme-1); }
.term-conn { display: flex; align-items: center; gap: 6px; }
.term-ops {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 7px;
}
.term-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  padding: 4px 10px;
  border-radius: 99px;
  background: var(--bg70);
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
}
.term-status .dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex: none;
}
.st-connecting { color: var(--text-2); }
.st-connecting .dot { background: #ffcb6b; animation: tb 1s ease-in-out infinite; }
.st-ready { color: var(--text); }
.st-ready .dot { background: #3ecf7a; box-shadow: 0 0 6px #3ecf7a88; }
.st-closed { color: var(--text-3); }
.st-closed .dot { background: #8a8f9c; }
.st-error { color: var(--danger); }
.st-error .dot { background: var(--danger); animation: tb 0.8s ease-in-out infinite; }
@keyframes tb { 50% { opacity: .35 } }

.term-icon-btn {
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border: 1px solid var(--stroke-b);
  background: var(--card);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all .12s;
}
.term-icon-btn:hover { color: var(--theme-1); border-color: var(--theme-1); }
.term-icon-btn.on { color: var(--theme-1); border-color: var(--theme-1); background: color-mix(in srgb, var(--theme-1) 9%, var(--card)); }
.term-reconnect {
  font-size: 12px;
  padding: 5px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.term-reconnect:hover { filter: brightness(1.08); }

/* ---- 主体 ---- */
.term-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.term-main {
  flex: 1;
  position: relative;
  min-width: 0;
  background: #16171d;
}
.term-void {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6b7080;
  font-size: 13px;
}
.term-void p { margin: 0; }

.term-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 11, 15, 0.72);
  backdrop-filter: blur(3px);
  z-index: 4;
}
.term-overlay-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 26px 38px;
  background: rgba(28, 30, 38, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 16px;
  color: #e6e8f0;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  text-align: center;
  max-width: 86%;
}
.term-overlay-icon {
  width: 52px; height: 52px;
  display: grid; place-items: center;
  border-radius: 50%;
  margin-bottom: 4px;
  background: rgba(140, 160, 255, 0.12);
  color: #9cb8ff;
}
.term-overlay.err .term-overlay-icon { background: rgba(255, 120, 120, 0.14); color: #ff8a80; }
.term-overlay-card b { font-size: 15px; }
.term-overlay-card p { margin: 0; font-size: 12.5px; color: #a7abbb; line-height: 1.6; word-break: break-all; }
.term-overlay-card .btn { margin-top: 8px; }

/* ---- 轻提示 ---- */
.term-toast {
  position: fixed;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  font-size: 12.5px;
  color: #fff;
  background: rgba(30, 32, 42, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  z-index: 400;
  max-width: 70vw;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.term-toast.ok svg { color: #3ecf7a; }
.term-toast.err svg { color: #ff8a80; }
.tst-enter-active, .tst-leave-active { transition: all .25s; }
.tst-enter-from, .tst-leave-to { opacity: 0; transform: translate(-50%, 10px); }
</style>
