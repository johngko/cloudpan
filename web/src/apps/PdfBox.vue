<template>
  <div class="app-root" style="padding: 18px 22px; overflow: auto">
    <h2 style="font-size: 18px; margin-bottom: 4px">PDF 工具箱</h2>
    <div style="font-size: 12px; color: var(--text-3); margin-bottom: 16px">服务端 pdfcpu 处理；产物保存回原目录（不会改动源文件）</div>

    <!-- 单文件：页数信息 + 按页拆分 -->
    <template v-if="single">
      <div class="pb-file">{{ base(paths[0]) }}</div>
      <div style="margin: 10px 0 18px; font-size: 13px">
        页数：<b>{{ pages === null ? '读取中…' : pages }}</b>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px">
        <span>按页拆分：每份</span>
        <select class="input" v-model.number="span" style="width: 90px">
          <option v-for="n in [1, 2, 3, 5, 10, 20]" :key="n" :value="n">{{ n }} 页</option>
        </select>
        <button class="btn" :disabled="busy || pages === null" @click="doSplit">拆分</button>
        <span v-if="busy" style="color: var(--text-3)">处理中…</span>
      </div>
      <div v-if="result" style="margin-top: 12px; font-size: 13px">
        {{ result.text }}
        <button v-if="result.dir" class="btn" style="margin-left: 8px" @click="openDir(result.dir)">打开产物目录</button>
      </div>
    </template>

    <!-- 多文件：合并（顺序可调） -->
    <template v-else>
      <div style="font-size: 13px; margin-bottom: 8px">按下列顺序合并 {{ paths.length }} 个 PDF：</div>
      <div style="max-height: 260px; overflow: auto; border: 1px solid var(--stroke); border-radius: var(--radius)">
        <div v-for="(p, i) in paths" :key="p" class="pb-row">
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ base(p) }}</span>
          <button class="btn" :disabled="i === 0" @click="move(i, -1)" title="上移">↑</button>
          <button class="btn" :disabled="i === paths.length - 1" @click="move(i, 1)" title="下移">↓</button>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 14px; font-size: 13px">
        <span>输出文件名</span>
        <input class="input" v-model="outName" placeholder="留空 = 第一个文件名-合并.pdf" style="width: 260px" />
        <button class="btn" :disabled="busy" @click="doMerge">合并</button>
        <span v-if="busy" style="color: var(--text-3)">处理中…</span>
      </div>
      <div v-if="result" style="margin-top: 12px; font-size: 13px">
        {{ result.text }}
        <button v-if="result.dir" class="btn" style="margin-left: 8px" @click="openDir(result.dir)">打开产物目录</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fsApi } from '../api/modules'
import { useToast } from '../stores/dialog'
import { useWindows } from '../stores/windows'

const winProps = defineProps<{ winId: number; props: any }>()
const toast = useToast()
const store = useWindows()

const p = winProps.props || {}
const policyId: number = p.policyId
const paths = ref<string[]>((p.paths || []).slice())
const single = computed(() => paths.value.length === 1)

const pages = ref<number | null>(null)
const span = ref(1)
const busy = ref(false)
const outName = ref('')
const result = ref<{ text: string; dir: string } | null>(null)

const base = (vp: string) => vp.split('/').filter(Boolean).pop() || vp
const dirOf = (vp: string) => { const i = vp.lastIndexOf('/'); return i <= 0 ? '/' : vp.slice(0, i) }

function move(i: number, d: number) {
  const j = i + d
  const a = paths.value
  ;[a[i], a[j]] = [a[j], a[i]]
}

async function loadInfo() {
  if (!single.value) return
  try { pages.value = (await fsApi.pdfInfo(policyId, paths.value[0])).pages }
  catch (e: any) { toast.error(e?.message || '读取页数失败') }
}

async function doInfo() { await loadInfo() }

async function doSplit() {
  busy.value = true; result.value = null
  try {
    const r = await fsApi.pdfSplit(policyId, paths.value[0], span.value)
    result.value = { text: `已拆分 ${r.count} 份到「${base(r.dir)}」`, dir: r.dir }
    toast.success('拆分完成')
  } catch (e: any) { toast.error(e?.message || '拆分失败') }
  finally { busy.value = false }
}

async function doMerge() {
  busy.value = true; result.value = null
  try {
    const r = await fsApi.pdfMerge(policyId, paths.value, outName.value.trim() || undefined)
    result.value = { text: `已生成「${r.name}」`, dir: dirOf(r.path) }
    toast.success('合并完成')
  } catch (e: any) { toast.error(e?.message || '合并失败') }
  finally { busy.value = false }
}

function openDir(dir: string) {
  store.open('explorer', { policyId, path: dir }, { title: base(dir), w: 1000, h: 640 })
}

onMounted(doInfo)
</script>

<style scoped>
.pb-file { font-size: 14px; font-weight: 600; }
.pb-row { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--hover-b); font-size: 13px; }
.pb-row:last-child { border-bottom: none; }
.pb-row .btn { padding: 2px 8px; }
</style>
