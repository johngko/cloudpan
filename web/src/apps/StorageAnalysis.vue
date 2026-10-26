<template>
  <div class="app-root sa-root">
    <!-- 工具条 -->
    <div class="sa-bar">
      <span class="sa-title">存储分析</span>
      <select class="input sa-sel" v-model.number="policyId" @change="load">
        <option v-for="p in policies" :key="p.id" :value="p.id">{{ p.name }} ({{ p.letter }})</option>
      </select>
      <button class="btn" :disabled="loading" @click="load">{{ loading ? '分析中…' : '刷新' }}</button>
      <span v-if="data" class="sa-meta">已扫描 {{ data.scanned }} 个文件</span>
      <span class="sa-spacer"></span>
    </div>

    <!-- 遍历触顶提示：统计不完整必须显式告知，避免用户据此误判 -->
    <div v-if="data && data.truncated" class="sa-warn">
      文件数量超出扫描上限，本次统计不完整（结果偏小）。
    </div>

    <div v-if="loading && !data" class="sa-empty">正在统计…大目录首次分析需要一点时间</div>
    <div v-else-if="!data" class="sa-empty">请选择要分析的磁盘</div>

    <template v-else>
      <!-- 概览卡 -->
      <div class="sa-cards">
        <div class="sa-card"><div class="sa-num">{{ fmtBytes(data.totalBytes) }}</div><div class="sa-lbl">总占用</div></div>
        <div class="sa-card"><div class="sa-num">{{ data.totalFiles }}</div><div class="sa-lbl">文件数</div></div>
        <div class="sa-card">
          <div class="sa-num">{{ topType ? topType.label : '-' }}</div>
          <div class="sa-lbl">最占空间类型{{ topType ? '（' + fmtBytes(topType.bytes) + '）' : '' }}</div>
        </div>
        <div class="sa-card">
          <div class="sa-num">{{ data.duplicates.length }}</div>
          <div class="sa-lbl">同内容多副本（不省空间）</div>
        </div>
      </div>

      <!-- 页签 -->
      <div class="sa-tabs">
        <div v-for="t in TABS" :key="t.id" class="sa-tab" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.name }}</div>
      </div>

      <!-- 按类型 / 按目录：同一种「占比条 + 体积 + 数量」渲染 -->
      <div v-if="tab === 'type' || tab === 'dir'" class="sa-list">
        <div v-for="(row, i) in (tab === 'type' ? typeRows : dirRows)" :key="i" class="sa-row">
          <div class="sa-row-head">
            <span class="sa-row-name" :title="row.label">{{ row.label }}</span>
            <span class="sa-row-num">{{ fmtBytes(row.bytes) }} · {{ row.count }} 个</span>
          </div>
          <div class="sa-track"><div class="sa-fill" :style="{ width: barW(row.bytes) }"></div></div>
        </div>
        <div v-if="!(tab === 'type' ? typeRows : dirRows).length" class="sa-empty">暂无数据</div>
      </div>

      <!-- 大文件排行 -->
      <div v-else-if="tab === 'largest'" class="sa-list">
        <div v-for="(f, i) in data.largest" :key="i" class="sa-file">
          <AppIcon :name="iconOf(f.ext)" :size="20" />
          <div class="sa-file-main">
            <div class="sa-file-name" :title="f.path">{{ f.name }}</div>
            <div class="sa-file-path" :title="f.path">{{ f.path }}</div>
          </div>
          <span class="sa-file-size">{{ fmtBytes(f.size) }}</span>
          <button class="btn" @click="reveal(f.path)">定位</button>
          <button class="btn danger" @click="del(f)">删除</button>
        </div>
        <div v-if="!data.largest.length" class="sa-empty">暂无文件</div>
      </div>

      <!-- 同内容多副本 -->
      <div v-else class="sa-list">
        <div class="sa-note">
          同内容文件在秒传时已按<b>硬链接</b>存储，<b>不额外占用空间</b>；这里用于「同一份文件散落在多处」的整理：
          多余副本可移入回收站（可还原，清空回收站才真正释放空间）。
        </div>
        <div v-if="dupExtra.length" style="display: flex; gap: 8px; align-items: center; margin: 2px 0 4px">
          <button class="btn" @click="cleanAllDups">一键整理：每组保留第一份，其余 {{ dupExtra.length }} 个移入回收站</button>
        </div>
        <div v-for="g in data.duplicates" :key="g.hash" class="sa-dup">
          <div class="sa-row-head">
            <span class="sa-row-name">{{ fmtBytes(g.size) }} · {{ g.count }} 处</span>
            <span style="display: flex; align-items: center; gap: 8px">
              <span class="sa-tag" :class="{ hl: g.hardLinked }">{{ g.hardLinked ? '硬链接（不占额外空间）' : '独立副本（占用额外空间）' }}</span>
              <button v-if="g.paths.length > 1" class="btn" @click="cleanGroup(g)">保留第一份</button>
            </span>
          </div>
          <div v-for="(p, i) in g.paths" :key="i" class="sa-dup-path">
            <span :title="p">{{ p }}</span>
            <button class="btn" @click="reveal(p)">定位</button>
          </div>
        </div>
        <div v-if="!data.duplicates.length" class="sa-empty">没有同内容多副本</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useWindows } from '../stores/windows'
import { useUiDialog, useToast } from '../stores/dialog'
import { fsApi, type Policy, type StorageAnalysis, type StorageLargestItem, type StorageDupGroup } from '../api/modules'
import { fileIcon } from './explorer/fileIcons'

const store = useWindows()
const toast = useToast()
const uiDlg = useUiDialog()

const TABS = [
  { id: 'type', name: '按类型' },
  { id: 'dir', name: '按顶层目录' },
  { id: 'largest', name: '大文件' },
  { id: 'dup', name: '同内容多副本' }
] as const
const tab = ref<'type' | 'dir' | 'largest' | 'dup'>('type')

const policies = ref<Policy[]>([])
const policyId = ref(0)
const data = ref<StorageAnalysis | null>(null)
const loading = ref(false)

const topType = computed(() => (data.value?.byType?.length ? data.value.byType[0] : null))

// 顶层目录：空路径 = 根目录下的散文件，展示为「(根目录)」
const dirRows = computed(() =>
  (data.value?.byTopDir || []).map(d => ({ label: d.path || '(根目录)', bytes: d.bytes, count: d.count })))
const typeRows = computed(() => data.value?.byType || [])

function fmtBytes(n: number) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return (i === 0 ? v : v.toFixed(v >= 100 ? 0 : 1)) + ' ' + u[i]
}
function barW(bytes: number) {
  const total = data.value?.totalBytes || 0
  if (!total) return '0%'
  return Math.max(1, Math.round((bytes / total) * 100)) + '%'
}
function iconOf(ext: string) {
  // 复用资源管理器的扩展名 → 图标映射，保持与文件列表一致
  return fileIcon({ name: '', ext, isDir: false } as any, 'win12')
}

async function load() {
  if (!policyId.value) return
  loading.value = true
  try {
    data.value = await fsApi.analysis(policyId.value)
  } catch (e: any) {
    toast.error(e?.message || '分析失败')
  } finally {
    loading.value = false
  }
}

// 定位：打开资源管理器并停在目标所在目录（复用既有的深链约定）
function reveal(path: string) {
  const dir = path.slice(0, path.lastIndexOf('/')) || '/'
  store.open('explorer', { policyId: policyId.value, path: dir }, { title: '文件资源管理器', icon: 'explorer', w: 1000, h: 640 })
}

// 重复副本清理：每组保留第一份，其余移入回收站（dup-purge 接口，可还原）
const dupExtra = computed(() => (data.value?.duplicates || []).flatMap(g => g.paths.slice(1)))
async function purgeDups(paths: string[], desc: string) {
  if (!paths.length) return
  const ok = await uiDlg.confirm('整理重复副本', `将把${desc}移入回收站。移入后仍可还原，清空回收站才真正释放空间。确定？`, { danger: true, okText: '移入回收站' })
  if (!ok) return
  try {
    await fsApi.dupPurge(policyId.value, paths)
    toast.success('已移入回收站，可在回收站还原')
    await load()
  } catch (e: any) {
    toast.error(e?.message || '清理失败')
  }
}
function cleanGroup(g: StorageDupGroup) { purgeDups(g.paths.slice(1), `该组 ${g.paths.length - 1} 份多余副本`) }
function cleanAllDups() { purgeDups(dupExtra.value, `全部 ${dupExtra.value.length} 份多余副本`) }

// 删除（进回收站，走既有删除接口）
async function del(f: StorageLargestItem) {
  const ok = await uiDlg.confirm('删除文件', `确定删除「${f.name}」（${fmtBytes(f.size)}）？可在回收站还原。`, { danger: true, okText: '删除' })
  if (!ok) return
  try {
    await fsApi.remove(policyId.value, [f.path])
    toast.success('已移入回收站')
    await load()
  } catch (e: any) {
    toast.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  try {
    policies.value = await fsApi.policies()
    if (policies.value.length) {
      policyId.value = policies.value[0].id
      await load()
    }
  } catch (e: any) {
    toast.error(e?.message || '读取存储列表失败')
  }
})
</script>

<style scoped>
.sa-root { padding: 16px 18px; overflow: auto; }
.sa-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex: none; }
.sa-title { font-size: 16px; font-weight: 600; }
.sa-sel { width: 220px; }
.sa-meta { font-size: 12px; color: var(--text-3); }
.sa-spacer { flex: 1; }
.sa-warn {
  margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; font-size: 12.5px;
  color: var(--danger, #e05252); background: color-mix(in srgb, var(--danger, #e05252) 10%, transparent);
}
.sa-empty { color: var(--text-3); font-size: 13px; padding: 22px 4px; text-align: center; }

.sa-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-bottom: 14px; }
.sa-card { background: var(--card); border: 1px solid var(--stroke-b); border-radius: var(--radius); padding: 14px 16px; }
.sa-num { font-size: 19px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sa-lbl { font-size: 11.5px; color: var(--text-3); margin-top: 5px; }

.sa-tabs { display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--stroke-b); }
.sa-tab { padding: 7px 14px; font-size: 13px; color: var(--text-2); cursor: pointer; border-bottom: 2px solid transparent; }
.sa-tab:hover { color: var(--text); background: var(--hover-b); }
.sa-tab.on { color: var(--text); font-weight: 600; border-bottom-color: var(--theme-2); }

.sa-list { display: flex; flex-direction: column; gap: 8px; }
.sa-row { background: var(--card); border: 1px solid var(--stroke-b); border-radius: var(--radius-sm); padding: 10px 12px; }
.sa-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 13px; }
.sa-row-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-row-num { color: var(--text-3); font-size: 12px; flex: none; font-variant-numeric: tabular-nums; }
.sa-track { height: 6px; border-radius: 3px; background: rgba(125, 125, 135, 0.22); overflow: hidden; margin-top: 8px; }
.sa-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--theme-1), var(--theme-2)); }

.sa-file { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1px solid var(--stroke-b); border-radius: var(--radius-sm); padding: 8px 12px; }
.sa-file-main { flex: 1; min-width: 0; }
.sa-file-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-file-path { font-size: 11px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-file-size { font-size: 12.5px; color: var(--text-2); flex: none; font-variant-numeric: tabular-nums; }

.sa-note { font-size: 12px; color: var(--text-2); background: var(--accent-weak); border-radius: 8px; padding: 9px 12px; margin-bottom: 4px; }
.sa-dup { background: var(--card); border: 1px solid var(--stroke-b); border-radius: var(--radius-sm); padding: 10px 12px; }
.sa-tag { font-size: 11px; padding: 1px 8px; border-radius: 9px; background: var(--accent-weak); color: var(--theme-2); flex: none; }
.sa-tag.hl { background: rgba(125, 125, 135, 0.16); color: var(--text-3); }
.sa-dup-path { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.sa-dup-path span { flex: 1; min-width: 0; font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
</style>
