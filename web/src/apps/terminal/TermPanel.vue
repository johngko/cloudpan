<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { termWsUrl } from '../../api/modules'

/**
 * 真实终端面板：xterm.js + WebSocket（二进制帧 = PTY 原始字节）
 * session 变化（模式/shell/连接）即重建会话
 */
const props = defineProps<{
  mode: 'local' | 'ssh'
  shell?: string
  connId?: number | null
}>()
const emit = defineEmits<{
  (e: 'status', s: 'connecting' | 'ready' | 'closed' | 'error', msg?: string): void
  (e: 'hello', info: { mode: string; os?: string; shell?: string; host?: string; user?: string }): void
}>()

const host = ref<HTMLElement | null>(null)
let term: Terminal | null = null
let fit: FitAddon | null = null
let ws: WebSocket | null = null
let ro: ResizeObserver | null = null
let manualClose = false

function xtermPalette() {
  const cs = getComputedStyle(document.documentElement)
  const accent = cs.getPropertyValue('--theme-1').trim() || '#7aa2f7'
  // 终端遵循经典深色惯例（浅色主题下同样是深色终端），光标/选中同步主题色
  return {
    background: '#16171d',
    foreground: '#d8dae3',
    cursor: accent,
    cursorAccent: '#16171d',
    selectionBackground: 'rgba(140,160,255,0.28)',
    black: '#2a2b33', red: '#f07178', green: '#97d077', yellow: '#ffcb6b',
    blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#89ddff', white: '#d8dae3',
    brightBlack: '#5a5c68', brightRed: '#ff8a90', brightGreen: '#b9e48f',
    brightYellow: '#ffd88a', brightBlue: '#9cb8ff', brightMagenta: '#d3b5fb',
    brightCyan: '#a9ebff', brightWhite: '#f2f3f7'
  }
}

function connect() {
  manualClose = false
  emit('status', 'connecting')
  const params: Record<string, string | number> = {}
  if (props.mode === 'local' && props.shell) params.shell = props.shell
  if (props.mode === 'ssh' && props.connId) params.connId = props.connId
  ws = new WebSocket(termWsUrl(props.mode, params))
  ws.binaryType = 'arraybuffer'
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      let m: any
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'hello') {
        emit('status', 'ready')
        emit('hello', m)
        fit?.fit()
      } else if (m.type === 'error') {
        emit('status', 'error', m.msg)
      } else if (m.type === 'exit' || m.type === 'closed') {
        emit('status', 'closed', m.msg || (m.type === 'exit' ? `进程已退出（code ${m.code}）` : '连接已断开'))
      }
    } else if (term) {
      term.write(new Uint8Array(ev.data as ArrayBuffer))
    }
  }
  ws.onclose = () => {
    if (!manualClose) {
      emit('status', 'closed', '连接已断开')
    }
  }
  ws.onerror = () => {
    if (ws && ws.readyState > 1) {
      emit('status', 'error', 'WebSocket 连接失败')
    }
  }
}

onMounted(() => {
  if (!host.value) return
  term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontFamily: 'Consolas, "Cascadia Code", Menlo, "DejaVu Sans Mono", "Noto Sans Mono CJK SC", monospace',
    fontSize: 13,
    lineHeight: 1.25,
    theme: xtermPalette(),
    allowProposedApi: true
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon())
  term.open(host.value)
  requestAnimationFrame(() => {
    fit?.fit()
    term?.focus()
  })

  // 输入必须以二进制帧发送（服务端文本帧 = JSON 控制消息）
  const enc = new TextEncoder()
  term.onData(d => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(enc.encode(d))
  })
  // 窗口尺寸变化 → fit + 通知后端调整 PTY
  ro = new ResizeObserver(() => {
    if (!term || !fit) return
    fit.fit()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
  })
  ro.observe(host.value)

  connect()
})

// 会话参数变化：断开重连。旧 ws 的 onclose 是异步触发的，若不先置 manualClose，
// 它的 'closed/连接已断开' 会在新连接建立后到达，把新会话的状态覆盖成已断开
watch(() => [props.mode, props.shell, props.connId], () => {
  if (!term) return
  manualClose = true
  ws?.close()
  ws = null
  term.reset()
  connect()
})

onBeforeUnmount(() => {
  manualClose = true
  ro?.disconnect()
  ws?.close()
  ws = null
  term?.dispose()
  term = null
})

// 主题切换（深色模式/换主题包）时同步 xterm 配色
watch(() => document.documentElement.className, () => {
  if (term) term.options.theme = xtermPalette()
})

defineExpose({
  clear: () => term?.clear(),
  focus: () => term?.focus(),
  reconnect: () => {
    if (!term) return
    manualClose = true // 防止旧 ws 的 onclose 异步覆盖新会话状态
    ws?.close()
    ws = null
    term.clear()
    connect()
  }
})
</script>

<template>
  <div class="tp-host" ref="host" @mousedown="() => term?.focus()"></div>
</template>

<style scoped>
.tp-host {
  width: 100%;
  height: 100%;
  background: #16171d;
  padding: 4px 0 0 6px;
  overflow: hidden;
}
/* xterm 内部滚动条与主题一致 */
.tp-host :deep(.xterm-scrollbars) {
  width: 9px;
}
.tp-host :deep(.xterm-scrollbars-viewport) {
  cursor: pointer;
  background: rgba(255, 255, 255, 0.09) !important;
  margin-left: 2px;
}
.tp-host :deep(.xterm-scrollbars-viewport > div) {
  background: rgba(255, 255, 255, 0.22);
}
.tp-host :deep(.xterm-viewport) {
  background: transparent !important;
}
</style>
