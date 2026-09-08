<template>
  <div class="app-root" style="background: #1e1e1e">
    <div style="flex: 1; overflow: auto; padding: 14px 16px; font-family: Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.55; user-select: text">
      <div v-for="(l, i) in lines" :key="i" :style="{ color: l.type === 'cmd' ? '#4cc2ff' : l.type === 'err' ? '#ff8a80' : 'rgba(255,255,255,0.85)' }">
        <span v-if="l.type === 'cmd'" style="color: #3fbf6f">{{ l.prompt }}</span>{{ l.text }}
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--stroke)">
      <span style="color: #3fbf6f; font-family: Consolas, monospace; font-size: 13px">{{ prompt }}</span>
      <input ref="inputEl" v-model="cmd" @keyup.enter="run" autofocus
        style="flex: 1; background: transparent; border: none; font-family: Consolas, monospace; font-size: 13px; color: #fff" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fsApi, downloadUrl } from '../api/modules'

interface Line { type: 'cmd' | 'out' | 'err'; text: string; prompt?: string }

const props = defineProps<{ winId: number; props: any }>()
const lines = ref<Line[]>([])
const cmd = ref('')
const inputEl = ref<HTMLInputElement>()

let policyId = 0
const cwd = ref('/')

const prompt = computed(() => `${letter()}:${cwd.value === '/' ? '\\' : cwd.value.replace(/\//g, '\\')}>`)

onMounted(async () => {
  policyId = props.props?.policyId || 0
  cwd.value = props.props?.path || '/'
  if (!policyId) {
    try {
      const ps = await fsApi.policies()
      if (ps.length) { policyId = ps[0].id }
    } catch {}
  }
  out(`CloudPan Terminal — 输入 help 查看命令。当前目录: ${prompt.value}`)
})

function letter() {
  return 'C'
}

function out(t: string) { lines.value.push({ type: 'out', text: t }) }
function err(t: string) { lines.value.push({ type: 'err', text: t }) }

async function run() {
  const raw = cmd.value.trim()
  lines.value.push({ type: 'cmd', text: raw, prompt: prompt.value })
  cmd.value = ''
  if (!raw) return
  const [c, ...args] = raw.split(/\s+/)
  const lc = c.toLowerCase()
  try {
    if (lc === 'help') {
      out('dir / cd <目录> / md <名称> / rd <名称> / del <名称> / type <文件> / copy <src> <dstdir> / move <src> <dstdir> / ren <名称> <新名> / tree / cls / exit')
    } else if (lc === 'cls') { lines.value = []; return
    } else if (lc === 'exit') { window.dispatchEvent(new CustomEvent('cp-close-window', { detail: props.winId })); return
    } else if (lc === 'dir' || lc === 'tree') {
      if (!policyId) return err('未挂载存储')
      const d = await fsApi.list(policyId, cwd.value)
      out(` ${d.items.length} 个项目`)
      for (const it of d.items) {
        const t = new Date(it.modTime)
        out(` ${t.toLocaleDateString()} ${t.toTimeString().slice(0, 5)}   ${it.isDir ? '<DIR>       ' : String(it.size).padStart(12)} ${it.name}`)
      }
    } else if (lc === 'cd') {
      const target = args[0]
      if (!target || target === '.') return
      if (target === '..') { cwd.value = cwd.value.slice(0, cwd.value.lastIndexOf('/')) || '/'; return }
      if (target === '/' || target === '\\') { cwd.value = '/'; return }
      const np = (cwd.value === '/' ? '' : cwd.value) + '/' + target.replace(/\\/g, '/')
      await fsApi.list(policyId, np)
      cwd.value = np
    } else if (lc === 'md' || lc === 'mkdir') {
      await fsApi.mkdir(policyId, cwd.value, args[0])
    } else if (lc === 'rd') {
      await fsApi.remove(policyId, [join(args[0])])
      out('已移入回收站')
    } else if (lc === 'del') {
      await fsApi.remove(policyId, [join(args[0])])
      out('已移入回收站')
    } else if (lc === 'type') {
      const d = await fsApi.readText(policyId, join(args[0]))
      d.content.split('\n').forEach(out)
    } else if (lc === 'ren') {
      await fsApi.rename(policyId, join(args[0]), args[1])
    } else if (lc === 'copy' || lc === 'move') {
      const paths = args.slice(0, -1).map(join)
      const dst = args[args.length - 1].startsWith('/') ? args[args.length - 1] : join(args[args.length - 1])
      if (lc === 'copy') await fsApi.copy(policyId, paths, dst)
      else await fsApi.move(policyId, paths, dst)
    } else if (lc === 'echo') {
      out(args.join(' '))
    } else {
      err(`'${c}' 不是内部或外部命令`)
      return
    }
    // cmd succeeded
  } catch (e: any) {
    err(e.message || '命令执行失败')
  }
}

function join(name: string) {
  if (!name) return cwd.value
  if (name.startsWith('/')) return name
  return (cwd.value === '/' ? '' : cwd.value) + '/' + name.replace(/\\/g, '/')
}
</script>
