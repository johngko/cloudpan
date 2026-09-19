<template>
  <div class="app-root ph-root">
    <div class="app-toolbar">
      <AppIcon name="image" :size="18" />
      <b>图库</b>
      <select class="input" v-model.number="policyId" style="width: 150px" @change="load">
        <option v-for="p in policies" :key="p.id" :value="p.id">{{ p.name }} ({{ p.letter }})</option>
      </select>
      <div class="ph-crumb">
        <span class="ph-crumb-item" :class="{ on: dir === '/' }" @click="gotoDir('/')">根目录</span>
        <template v-for="(c, i) in crumbs" :key="i">
          <span class="ph-sep">›</span>
          <span class="ph-crumb-item" @click="gotoDir(c.path)">{{ c.name }}</span>
        </template>
      </div>
      <div style="flex: 1"></div>
      <span class="ph-count">{{ photos.length }} 张图片</span>
      <button class="tool-btn" :disabled="loading" title="刷新" @click="load">
        <AppIcon name="refresh" :size="15" />
      </button>
    </div>

    <div class="ph-body">
      <div v-if="loading" class="ph-empty">正在收集图片…</div>
      <div v-else-if="!photos.length" class="ph-empty">
        {{ dir === '/' ? '该目录（含子目录）没有图片' : '该目录（含子目录）没有图片' }}
        <div style="margin-top: 6px; font-size: 11.5px">支持 jpg / jpeg / png / gif / webp / bmp</div>
      </div>
      <template v-else>
        <div v-for="g in groups" :key="g.month" class="ph-month">
          <div class="ph-month-head">{{ g.label }} <span class="ph-month-n">{{ g.items.length }}</span></div>
          <div class="ph-grid">
            <div v-for="f in g.items" :key="f.path" class="ph-cell" title="点击查看大图" @click="openViewer(f)">
              <img :src="thumbUrl(f)" loading="lazy" alt="" />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// 图库：按日期（拍摄/修改时间月份）分组的照片墙。
// 递归收集所选目录下的图片（客户端遍历 /fs/list，限 300 张），缩略图走 /fs/raw?thumb=1（服务端缓存）。
// 点击任意图片 → 打开图片查看器（灯箱：缩放/旋转/EXIF/前后翻页）。
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { fsApi, rawUrl, type Policy } from '../api/modules'
import { get } from '../api/http'
import { useToast } from '../stores/dialog'
import { openFileByType } from '../stores/transfer'

const toast = useToast()
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const MAX_PHOTOS = 300
const MAX_DIRS = 80

const policies = ref<Policy[]>([])
const policyId = ref(0)
const dir = ref('/')
const crumbs = ref<{ name: string; path: string }[]>([])
const photos = ref<any[]>([])
const loading = ref(false)

async function loadPolicies() {
  try {
    const list = await fsApi.policies()
    policies.value = list
    if (list.length && !policyId.value) policyId.value = list[0].id
  } catch { policies.value = [] }
}

function thumbUrl(f: any) {
  return rawUrl(policyId.value, f.path) + '&thumb=1'
}

async function walk(d: string, rel: string, out: any[]) {
  if (out.length >= MAX_PHOTOS) return
  const r: any = await get(`/fs/list?policyId=${policyId.value}&path=${encodeURIComponent(d)}`)
  const items: any[] = r?.items || []
  let subdirs = 0
  for (const it of items) {
    if (out.length >= MAX_PHOTOS) return
    const childRel = rel ? rel + '/' + it.name : it.name
    if (it.isDir) {
      subdirs++
      if (subdirs <= MAX_DIRS) await walk(it.path, childRel, out)
    } else if (IMG_EXTS.includes(it.ext)) {
      // Picasa 灯箱按 item.policyId 拉原图，需带上
      out.push({ ...it, rel: childRel, policyId: policyId.value })
    }
  }
}

async function load() {
  if (!policyId.value) return
  loading.value = true
  photos.value = []
  try {
    const out: any[] = []
    await walk(dir.value, '', out)
    photos.value = out.sort((a, b) => (b.modTime || 0) - (a.modTime || 0))
  } catch (e: any) {
    toast.error('收集图片失败：' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 按月份分组（modTime → YYYY-MM，新→旧）
const groups = computed(() => {
  const m = new Map<string, any[]>()
  for (const f of photos.value) {
    const d = new Date(f.modTime || 0)
    if (!f.modTime) continue
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(f)
  }
  return [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, items]) => ({
      month,
      label: month.slice(0, 4) + ' 年 ' + Number(month.slice(5)) + ' 月',
      items
    }))
})

function gotoDir(d: string) {
  dir.value = d
  // 面包屑：按路径段重建
  const segs = d.split('/').filter(Boolean)
  crumbs.value = segs.map((s, i) => ({ name: s, path: '/' + segs.slice(0, i + 1).join('/') }))
  load()
}

function openViewer(f: any) {
  // 灯箱：Picasa 图片预览（同一分组内前后翻页，list 走 expandFiles）
  openFileByType('picasa', { list: photos.value, path: f.path, policyId: policyId.value }, f.name, 1080, 700)
}

onMounted(async () => {
  await loadPolicies()
  if (policyId.value) await load()
})
</script>

<style scoped>
.ph-root { display: flex; flex-direction: column }
.ph-crumb { display: flex; align-items: center; gap: 4px; font-size: 12.5px; min-width: 0; overflow: hidden; white-space: nowrap }
.ph-crumb-item { cursor: pointer; color: var(--text-2); padding: 2px 6px; border-radius: 4px }
.ph-crumb-item:hover { background: var(--hover, rgba(127,127,127,0.15)) }
.ph-crumb-item.on { color: var(--text-1); font-weight: 600 }
.ph-sep { color: var(--text-3) }
.ph-count { font-size: 12px; color: var(--text-3); margin-right: 4px; white-space: nowrap }
.ph-body { flex: 1; overflow: auto; padding: 4px 14px 14px }
.ph-empty { padding: 40px; text-align: center; color: var(--text-3); font-size: 13px }
.ph-month { margin-top: 12px }
.ph-month-head {
  position: sticky; top: 0; z-index: 1;
  font-size: 13px; font-weight: 600; color: var(--text-2);
  padding: 7px 4px; background: var(--bg1);
  display: flex; align-items: center; gap: 8px;
}
.ph-month-n {
  font-size: 11px; font-weight: 400; color: var(--text-3);
  background: rgba(127, 127, 127, 0.15); border-radius: 999px; padding: 1px 8px;
}
.ph-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 6px;
}
.ph-cell {
  aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer;
  background: rgba(127, 127, 127, 0.12);
}
.ph-cell:hover { outline: 2px solid var(--theme-1, #3b91d8) }
.ph-cell img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
</style>
