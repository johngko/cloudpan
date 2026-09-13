<template>
  <div class="app-root poster-root">
    <!-- 左侧：模板库 + 素材库（内置资源盘 T: 只读）+ 我的资源 + 管理员用户资源 -->
    <div class="poster-side">
      <div class="side-tabs">
        <div class="side-tab" :class="{ on: tab === 'tpl' }" @click="tab = 'tpl'">模板库</div>
        <div class="side-tab" :class="{ on: tab === 'mat' }" @click="tab = 'mat'">素材库</div>
        <div class="side-tab" :class="{ on: tab === 'works' }" @click="tab = 'works'">我的作品</div>
        <div v-if="isAdmin" class="side-tab" :class="{ on: tab === 'users' }" @click="tab = 'users'">用户资源</div>
      </div>

      <!-- 模板库 -->
      <div v-if="tab === 'tpl'" class="side-body">
        <div class="src-chips">
          <div class="src-chip" :class="{ on: tplSrc === 'sys' }" @click="tplSrc = 'sys'">系统模板</div>
          <div class="src-chip" :class="{ on: tplSrc === 'my' }" @click="tplSrc = 'my'">我的模板</div>
          <div style="flex: 1"></div>
          <button v-if="canManage" class="mini-btn" @click="saveAsTemplate" :disabled="savingTpl || !frameSrc" title="把当前画布保存为自己的模板">
            {{ savingTpl ? '保存中…' : '存为模板' }}
          </button>
        </div>
        <template v-if="tplSrc === 'sys'">
          <div class="side-search">
            <input v-model="tplQuery" placeholder="搜索模板（如 618、婚礼、招聘）" />
          </div>
          <div class="tpl-grid">
            <div v-for="t in visibleTpl" :key="t.file" class="tpl-card" :title="t.title + '（' + t.width + '×' + t.height + '）'" @click="openTemplate(t)">
              <img v-if="t.thumb" :src="tUrl(t.thumb)" loading="lazy" alt="" @error="onImgErr" />
              <div v-else class="tpl-ph"><AppIcon name="poster" :size="30" /></div>
              <div class="tpl-meta">
                <span class="tpl-name">{{ t.title }}</span>
                <span class="tpl-size">{{ t.width }}×{{ t.height }}</span>
              </div>
              <div v-if="isAdmin" class="card-del" title="删除该内置模板" @click.stop="delBuiltin(t.file.slice(1))">×</div>
            </div>
            <div v-if="!manifest && !loadingManifest" class="side-empty">
              <AppIcon name="poster" :size="34" />
              <span>模板清单加载失败</span>
            </div>
            <div ref="tplSentinel" style="grid-column: 1 / -1; height: 8px"></div>
          </div>
          <div v-if="tplLimit < visibleTpl.length || tplLimit < filteredTpl.length" style="text-align: center; padding: 0 0 10px">
            <button class="mini-btn" @click="tplLimit += 120">加载更多（{{ filteredTpl.length - tplLimit }}）</button>
          </div>
          <div v-if="isAdmin" class="admin-upload">
            <div class="au-row">
              <input class="au-file" type="file" accept=".json,application/json" @change="e => builtinTplFile = (e.target as HTMLInputElement).files?.[0] || null" />
            </div>
            <div class="au-row">
              <input class="au-file" type="file" accept="image/png" title="缩略图（可选，同名 png）" @change="e => builtinTplThumb = (e.target as HTMLInputElement).files?.[0] || null" />
              <button class="mini-btn primary" :disabled="!builtinTplFile || uploadingBuiltin" @click="uploadBuiltinTemplate">上传模板</button>
            </div>
            <div class="side-tip">管理员可随时上传/更换内置模板（JSON + 可选 png 缩略图，同名覆盖）</div>
          </div>
        </template>
        <template v-else>
          <div class="tpl-grid">
            <div v-for="f in myTpls" :key="f.path" class="tpl-card" :title="f.name" @click="openMy(f.path)">
              <img v-if="myTplThumbs[f.path]" :src="myTplThumbs[f.path]" loading="lazy" alt="" @error="onImgErr" />
              <div v-else class="tpl-ph"><AppIcon name="poster" :size="30" /></div>
              <div class="tpl-meta"><span class="tpl-name">{{ tplTitle(f.name) }}</span></div>
              <div v-if="canManage" class="card-del" title="删除该模板" @click.stop="delMy(f.path)">×</div>
            </div>
            <div v-if="!myTpls.length" class="side-empty">
              <AppIcon name="poster" :size="34" />
              <span>{{ canManage ? '还没有自己的模板，编辑后点「存为模板」' : '暂无模板（联系管理员授权后可保存自己的模板）' }}</span>
            </div>
          </div>
          <div class="side-tip">我的模板保存在本机盘 /poster/模板/，仅自己可见</div>
        </template>
      </div>

      <!-- 素材库 -->
      <div v-else-if="tab === 'mat'" class="side-body">
        <div class="src-chips">
          <div class="src-chip" :class="{ on: matSrc === 'sys' }" @click="matSrc = 'sys'">系统素材</div>
          <div class="src-chip" :class="{ on: matSrc === 'my' }" @click="matSrc = 'my'">我的素材</div>
        </div>
        <template v-if="matSrc === 'sys'">
          <div class="mat-cats">
            <div v-for="c in matCats" :key="c" class="mat-cat" :class="{ on: matCat === c }" @click="matCat = c">{{ c }}</div>
          </div>
          <div class="mat-grid">
            <div v-for="m in visibleMat" :key="m.file" class="mat-card" :title="m.name" @click="addMaterial(m)">
              <img :src="tUrl(m.file)" loading="lazy" alt="" @error="onImgErr" />
              <div v-if="isAdmin" class="card-del" title="删除该内置素材" @click.stop="delBuiltin(m.file.slice(1))">×</div>
            </div>
            <div ref="matSentinel" style="grid-column: 1 / -1; height: 8px"></div>
          </div>
          <div v-if="matLimit < filteredMatAll.length" style="text-align: center; padding: 0 0 10px">
            <button class="mini-btn" @click="matLimit += 240">加载更多（{{ filteredMatAll.length - matLimit }}）</button>
          </div>
          <div v-if="isAdmin" class="admin-upload">
            <div class="au-row">
              <select class="toolbar-sel" v-model="builtinMatCat" style="flex: 1">
                <option v-for="c in ['背景', '装饰', '边框', '图标', '纹理', '未分类']" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="au-row">
              <input class="au-file" type="file" multiple accept="image/*" @change="e => builtinMatFiles = Array.from((e.target as HTMLInputElement).files || [])" />
              <button class="mini-btn primary" :disabled="!builtinMatFiles.length || uploadingBuiltin" @click="uploadBuiltinMaterials">上传素材</button>
            </div>
            <div class="side-tip">管理员可随时上传/更换内置素材（同名覆盖，即时进清单）</div>
          </div>
        </template>
        <template v-else>
          <div class="au-row" style="padding: 8px 10px 0">
            <button v-if="canManage" class="mini-btn primary" @click="myMatInput?.click()">上传素材</button>
            <input v-if="canManage" ref="myMatInput" type="file" multiple accept="image/*" style="display: none" @change="uploadMyMaterials" />
            <span v-if="!canManage" class="side-tip" style="padding: 0">联系管理员授权后可上传自己的素材</span>
          </div>
          <div class="mat-grid">
            <div v-for="f in myMats" :key="f.path" class="mat-card" :title="f.name" @click="addMyMaterial(f)">
              <img :src="rawOf(f.path)" loading="lazy" alt="" @error="onImgErr" />
              <div v-if="canManage" class="card-del" title="删除该素材" @click.stop="delMy(f.path)">×</div>
            </div>
          </div>
          <div v-if="!myMats.length" class="side-empty">
            <AppIcon name="image" :size="34" />
            <span>{{ canManage ? '还没有自己的素材，点「上传素材」添加' : '暂无素材（联系管理员授权后可上传）' }}</span>
          </div>
          <div class="side-tip">点击素材加入画布 · 我的素材保存在本机盘 /poster/素材/，仅自己可见</div>
        </template>
      </div>

      <!-- 我的作品 -->
      <div v-else-if="tab === 'works'" class="side-body">
        <div class="works-list">
          <div v-for="f in myWorks" :key="f.path" class="work-row" @click="openMy(f.path)" :title="f.name + '（点击继续编辑）'">
            <img v-if="isPng(f.name)" class="work-thumb" :src="rawOf(f.path)" loading="lazy" alt="" @error="onImgErr" />
            <AppIcon v-else name="poster" :size="22" />
            <div class="work-info">
              <div class="work-name">{{ f.name }}</div>
              <div class="work-size">{{ fmtSize(f.size) }}</div>
            </div>
            <div class="card-del" title="删除该作品" @click.stop="delMy(f.path)">×</div>
          </div>
          <div v-if="!myWorks.length" class="side-empty">
            <AppIcon name="poster" :size="34" />
            <span>暂无作品，打开模板编辑后点「保存」</span>
          </div>
        </div>
        <div class="side-tip">作品保存在本机盘 /poster/，点击继续编辑</div>
      </div>

      <!-- 用户资源（仅管理员）：查看所有用户的作品/素材/模板 -->
      <div v-else class="side-body">
        <div class="au-row" style="padding: 8px 10px 0">
          <select class="toolbar-sel" v-model="adminUid" style="flex: 1" @change="loadAdminLib">
            <option v-for="u in adminUsers" :key="u.id" :value="u.id">{{ u.nickname || u.username }}（{{ u.username }}）</option>
          </select>
        </div>
        <div v-if="adminLib" class="admin-lib">
          <div class="al-sec">作品（{{ adminLib.works.length }}）</div>
          <div class="works-list">
            <div v-for="f in adminLib.works" :key="f.path" class="work-row">
              <img v-if="isPng(f.name)" class="work-thumb" :src="adminFileUrl(f.path)" loading="lazy" alt="" @error="onImgErr" />
              <AppIcon v-else name="poster" :size="22" />
              <div class="work-info">
                <div class="work-name">{{ f.name }}</div>
                <div class="work-size">{{ fmtSize(f.size) }}</div>
              </div>
            </div>
            <div v-if="!adminLib.works.length" class="side-tip" style="text-align: left; padding: 2px 10px">无</div>
          </div>
          <div class="al-sec">素材（{{ adminLib.materials.length }}）</div>
          <div class="mat-grid" style="padding: 0 10px">
            <div v-for="f in adminLib.materials" :key="f.path" class="mat-card" :title="f.name">
              <img :src="adminFileUrl(f.path)" loading="lazy" alt="" @error="onImgErr" />
            </div>
            <div v-if="!adminLib.materials.length" class="side-tip" style="grid-column: 1 / -1; text-align: left; padding: 2px 0">无</div>
          </div>
          <div class="al-sec">模板（{{ adminLib.templates.length }}）</div>
          <div class="works-list">
            <div v-for="f in adminLib.templates" :key="f.path" class="work-row">
              <AppIcon name="poster" :size="22" />
              <div class="work-info">
                <div class="work-name">{{ f.name }}</div>
                <div class="work-size">{{ fmtSize(f.size) }}</div>
              </div>
            </div>
            <div v-if="!adminLib.templates.length" class="side-tip" style="text-align: left; padding: 2px 10px">无</div>
          </div>
        </div>
        <div class="side-tip">仅管理员可查看所有用户的素材与模板；用户之间互相隔离</div>
      </div>
    </div>

    <!-- 右侧：编辑器（vendored 海报设计，同源 iframe cp 嵌入模式） -->
    <div class="poster-main">
      <div class="poster-toolbar">
        <select class="toolbar-sel" v-model="newSize" title="新建画布尺寸">
          <option value="750*1334">新建 手机海报 750×1334</option>
          <option value="1080*1920">新建 手机海报 1080×1920</option>
          <option value="1000*1000">新建 方形 1000×1000</option>
          <option value="1920*1080">新建 横幅 1920×1080</option>
        </select>
        <button class="tool-btn" @click="newBoard">
          <AppIcon name="plus" :size="14" />新建画布
        </button>
        <div class="tool-sep"></div>
        <button class="tool-btn" :disabled="exporting" @click="exportPng('cloud')">
          <AppIcon name="upload" :size="14" />{{ exporting ? '导出中…' : '导出 PNG 到云盘' }}
        </button>
        <button class="tool-btn" :disabled="exporting" @click="exportPng('local')">
          <AppIcon name="download" :size="14" />下载 PNG
        </button>
        <div style="flex: 1"></div>
        <span class="toolbar-hint">作品保存于「{{ savePolicy?.name || '云盘' }} /poster/」· 系统模板素材来自内置资源库 T:（仅管理员可管理）</span>
      </div>
      <iframe v-show="frameSrc" ref="frame" class="poster-frame" :src="frameSrc" @load="onFrameLoad" title="海报设计编辑器"></iframe>
      <div v-if="!frameSrc" class="poster-placeholder">
        <AppIcon name="poster" :size="46" />
        <div>正在加载海报设计…</div>
        <div class="ph-sub">从左侧选一个模板开始，或点「新建画布」</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { fsApi, adminApi, posterApi, rawUrl, Policy, FileItem } from '../api/modules'
import { getToken } from '../api/http'
import { useToast } from '../stores/dialog'
import { useTransfer } from '../stores/transfer'
import { useSession } from '../stores/session'
import AppIcon from '../components/AppIcon.vue'

// 海报设计（poster-design 前端 vendored 到 /vendor/poster/，同源 iframe 嵌入）：
//  - 系统模板/素材：内置只读资源盘 T:（/templates/、/materials/，manifest = /index.json），
//    仅管理员可管理（/api/admin/poster/builtin 上传/删除 + 后端重建清单）
//  - 我的素材/模板：用户自己盘 /poster/素材/、/poster/模板/（用户间天然隔离）；
//    上传/删除须管理员或用户组「允许管理海报素材」授权（allowPosterAsset）
//  - 我的作品：/poster/*.poster.json，点击即回编辑器
//  - 用户资源（管理员）：/api/admin/poster/userlib 查看任意用户的海报资源
const props = defineProps<{ winId: number; props: any }>()
const toast = useToast()
const transfer = useTransfer()
const session = useSession()

const isAdmin = computed(() => session.user?.role === 'admin')
// 授权 = 管理员，或用户组勾选「允许管理海报素材」
const canManage = computed(() => isAdmin.value || !!session.group?.allowPosterAsset)

// ---- 策略：T: 内置资源盘（只读，系统模板/素材来源）+ 用户本地盘（保存目标） ----
const policies = ref<Policy[]>([])
const tPolicy = computed(() => policies.value.find(p => p.type === 'builtin' && p.letter === 'T') || null)
const savePolicy = computed(() => policies.value.find(p => p.type === 'local') || policies.value[0] || null)

// ---- 系统清单（T:/index.json，管理员变更后由后端重建） ----
interface Tpl { file: string; thumb?: string; width: number; height: number; title: string }
interface Mat { file: string; category: string; name: string }
const manifest = ref<any>(null)
const loadingManifest = ref(false)
const tab = ref<'tpl' | 'mat' | 'works' | 'users'>('tpl')
const tplSrc = ref<'sys' | 'my'>('sys')
const matSrc = ref<'sys' | 'my'>('sys')
const tplQuery = ref('')
const matCat = ref('全部')
const matCats = ['全部', '背景', '图案', '装饰', '边框', '图标', '纹理']

const tpls = computed<Tpl[]>(() => {
  const arr: any[] = manifest.value?.templates || []
  return arr.map(t => ({ ...t, title: (t.file.split('/').pop() || t.file).replace(/^t\d+-/, '').replace(/\.json$/i, '').replace(/-/g, ' ') }))
})
const mats = computed<Mat[]>(() => {
  const arr: any[] = manifest.value?.materials || []
  return arr.map(m => ({ ...m, name: (m.file.split('/').pop() || m.file).replace(/\.\w+$/i, '') }))
})
const filteredTpl = computed(() => {
  const q = tplQuery.value.trim().toLowerCase()
  return q ? tpls.value.filter(t => (t.title + t.file).toLowerCase().includes(q)) : tpls.value
})
// 万级条目懒渲染：IntersectionObserver 触底加载下一块
const TPL_CHUNK = 120
const MAT_CHUNK = 240
const tplLimit = ref(TPL_CHUNK)
const matLimit = ref(MAT_CHUNK)
const visibleTpl = computed(() => filteredTpl.value.slice(0, tplLimit.value))
const filteredMatAll = computed(() => matCat.value === '全部' ? mats.value : mats.value.filter(m => m.category === matCat.value))
const visibleMat = computed(() => filteredMatAll.value.slice(0, matLimit.value))
const tplSentinel = ref<HTMLDivElement>()
const matSentinel = ref<HTMLDivElement>()
let tplObserver: IntersectionObserver | null = null
let matObserver: IntersectionObserver | null = null
function setupObservers() {
  tplObserver?.disconnect(); matObserver?.disconnect()
  tplObserver = new IntersectionObserver((es) => {
    if (es.some(e => e.isIntersecting) && tplLimit.value < filteredTpl.value.length) tplLimit.value += TPL_CHUNK
  }, { root: document.querySelector('.tpl-grid')?.closest('.side-body'), rootMargin: '200px' })
  matObserver = new IntersectionObserver((es) => {
    if (es.some(e => e.isIntersecting) && matLimit.value < filteredMatAll.value.length) matLimit.value += MAT_CHUNK
  }, { root: document.querySelector('.mat-grid')?.closest('.side-body'), rootMargin: '200px' })
  if (tplSentinel.value) tplObserver.observe(tplSentinel.value)
  if (matSentinel.value) matObserver.observe(matSentinel.value)
}
onMounted(() => { setTimeout(setupObservers, 800) })
watch([tplQuery, matCat, tab, tplSrc, matSrc], () => { tplLimit.value = TPL_CHUNK; matLimit.value = MAT_CHUNK; setTimeout(setupObservers, 150) })

function tUrl(p: string) {
  return tPolicy.value ? rawUrl(tPolicy.value.id, p) : ''
}
function rawOf(rel: string) {
  return savePolicy.value ? rawUrl(savePolicy.value.id, rel) : ''
}
function onImgErr(e: Event) {
  ;(e.target as HTMLInputElement).style.visibility = 'hidden'
}
function isPng(name: string) {
  return /\.png$/i.test(name)
}
function fmtSize(n: number) {
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}
function tplTitle(name: string) {
  return name.replace(/\.poster\.json$|\.json$/i, '')
}
async function reloadManifest() {
  if (!tPolicy.value) return
  // 清单较大（万级条目）超 readText 上限，走 raw 直链
  const r = await fetch(rawUrl(tPolicy.value.id, '/index.json'))
  manifest.value = await r.json()
}

// ---- 我的资源（自己盘 /poster/，用户间隔离） ----
const myTpls = ref<FileItem[]>([])
const myMats = ref<FileItem[]>([])
const myWorks = ref<FileItem[]>([])
const myTplThumbs = ref<Record<string, string>>({})

async function loadMy() {
  if (!savePolicy.value) return
  const pid = savePolicy.value.id
  const ls = async (p: string) => {
    try {
      return (await fsApi.list(pid, p)).items.filter(i => !i.isDir)
    } catch {
      return [] as FileItem[]
    }
  }
  const [tpls2, mats2, works] = await Promise.all([ls('/poster/模板'), ls('/poster/素材'), ls('/poster')])
  myTpls.value = tpls2.filter(f => /\.json$/i.test(f.name)).map(f => ({ ...f, path: '/poster/模板/' + f.name }))
  myMats.value = mats2.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name)).map(f => ({ ...f, path: '/poster/素材/' + f.name }))
  myWorks.value = works.filter(f => /\.poster\.json$/i.test(f.name) || /\.png$/i.test(f.name)).map(f => ({ ...f, path: '/poster/' + f.name }))
  // 我的模板缩略图：同名 png（/poster/模板/xxx.png ↔ xxx.poster.json）
  const thumbs: Record<string, string> = {}
  const pngs = tpls2.filter(f => /\.png$/i.test(f.name))
  for (const t of myTpls.value) {
    const base = t.name.replace(/\.poster\.json$|\.json$/i, '')
    if (pngs.some(f => f.name === base + '.png')) thumbs[t.path] = rawUrl(pid, '/poster/模板/' + base + '.png')
  }
  myTplThumbs.value = thumbs
}

function openMy(path: string) {
  currentTitle.value = decodeURIComponent(path.split('/').pop() || '').replace(/\.poster\.json$/i, '')
  frameSrc.value = iframeSrc(path)
}

// ---- 上传/删除我的素材（需授权） ----
const myMatInput = ref<HTMLInputElement>()
async function uploadMyMaterials(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  ;(e.target as HTMLInputElement).value = ''
  if (!files.length || !savePolicy.value) return
  transfer.addFiles(savePolicy.value.id, '/poster/素材', files)
  toast.success('素材上传中，完成后出现在列表')
  setTimeout(loadMy, 2500)
}
async function delMy(path: string) {
  if (!savePolicy.value) return
  try {
    await fsApi.remove(savePolicy.value.id, [path])
    toast.success('已删除')
  } catch (e: any) {
    toast.error('删除失败：' + (e?.message || ''))
  }
  loadMy()
}

// ---- 管理员：内置库上传/删除 ----
const builtinTplFile = ref<File | null>(null)
const builtinTplThumb = ref<File | null>(null)
const builtinMatFiles = ref<File[]>([])
const builtinMatCat = ref('背景')
const uploadingBuiltin = ref(false)

async function builtinUpload(form: FormData) {
  uploadingBuiltin.value = true
  try {
    await posterApi.builtinUpload(form)
    toast.success('已上传，清单已更新')
    await reloadManifest()
  } catch (e: any) {
    toast.error('上传失败：' + (e?.message || ''))
  } finally {
    uploadingBuiltin.value = false
  }
}
async function uploadBuiltinTemplate() {
  if (!builtinTplFile.value) return
  const fd = new FormData()
  fd.append('file', builtinTplFile.value)
  fd.append('kind', 'template')
  if (builtinTplThumb.value) fd.append('thumb', builtinTplThumb.value)
  await builtinUpload(fd)
  builtinTplFile.value = null
  builtinTplThumb.value = null
}
async function uploadBuiltinMaterials() {
  if (!builtinMatFiles.value.length) return
  uploadingBuiltin.value = true
  try {
    for (const f of builtinMatFiles.value) {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('kind', 'material')
      fd.append('category', builtinMatCat.value)
      await posterApi.builtinUpload(fd)
    }
    toast.success('已上传 ' + builtinMatFiles.value.length + ' 个素材')
    await reloadManifest()
    builtinMatFiles.value = []
  } catch (e: any) {
    toast.error('上传失败：' + (e?.message || ''))
  } finally {
    uploadingBuiltin.value = false
  }
}
async function delBuiltin(path: string) {
  try {
    await posterApi.builtinDelete(path)
    toast.success('已删除')
    await reloadManifest()
  } catch (e: any) {
    toast.error('删除失败：' + (e?.message || ''))
  }
}

// ---- 存为模板：向编辑器要 JSON + 缩略图，落自己盘 /poster/模板/ ----
const savingTpl = ref(false)
function saveAsTemplate() {
  if (!frameSrc.value) { toast.error('请先打开模板或新建画布'); return }
  if (savingTpl.value) return
  savingTpl.value = true
  postToFrame({ type: 'cp-poster:export-all' })
  setTimeout(() => { if (savingTpl.value) { savingTpl.value = false; toast.error('保存超时：编辑器未就绪') } }, 60000)
}

async function handleExportedAll(d: any) {
  savingTpl.value = false
  if (d.error) { toast.error(d.error); return }
  if (!savePolicy.value) { toast.error('未找到可保存的云盘'); return }
  const raw = (currentTitle.value || '我的模板').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || '我的模板'
  const base = raw + '-' + Date.now().toString(36)
  try {
    await fsApi.writeText(savePolicy.value.id, `/poster/模板/${base}.poster.json`, d.data)
    if (d.dataUrl) {
      const blob = dataUrlToBlob(d.dataUrl)
      transfer.addFiles(savePolicy.value.id, '/poster/模板', [new File([blob], base + '.png', { type: 'image/png' })])
    }
    toast.success(`已保存为我的模板：${base}`)
    setTimeout(loadMy, 2500)
  } catch (e: any) {
    toast.error('保存失败：' + (e?.message || ''))
  }
}

// ---- 管理员：用户资源 ----
const adminUsers = ref<any[]>([])
const adminUid = ref<number>(0)
const adminLib = ref<any>(null)

function adminFileUrl(path: string) {
  return posterApi.userFileUrl(adminUid.value, path)
}
async function loadAdminLib() {
  if (!adminUid.value) return
  try {
    adminLib.value = await posterApi.userLib(adminUid.value)
  } catch (e: any) {
    toast.error('加载用户资源失败：' + (e?.message || ''))
  }
}

// ---- 编辑器 iframe ----
const frame = ref<HTMLIFrameElement>()
const frameSrc = ref('')
const currentTitle = ref('')
const exporting = ref(false)
const newSize = ref('750*1334')

// 每次切换作品/模板都换一次文档查询串（#r=n）：hash 路由下仅改 # 后内容不会重载
// 已加载的 iframe 文档，必须改 # 前的文档 URL 才会重新走 onMounted→loadData→cpLoad
let srcNonce = 0
function iframeSrc(cpath: string, wH = '') {
  const tp = tPolicy.value
  if (!tp) return ''
  srcNonce++
  const q = new URLSearchParams()
  q.set('cp', '1')
  q.set('pid', String(tp.id))
  if (cpath) q.set('cpath', cpath)
  if (wH) q.set('w_h', wH)
  q.set('tok', getToken() || '')
  if (savePolicy.value) {
    q.set('spid', String(savePolicy.value.id))
    q.set('spath', '/poster')
  }
  return `/vendor/poster/index.html?r=${srcNonce}#/home?${q.toString()}`
}

function openTemplate(t: Tpl) {
  currentTitle.value = t.title
  frameSrc.value = iframeSrc(t.file)
}
function newBoard() {
  currentTitle.value = ''
  frameSrc.value = iframeSrc('', newSize.value)
}

function onFrameLoad() {
  // 素材点击早于编辑器就绪时补发
  if (pendingMyMat.value) {
    const url = pendingMyMat.value
    pendingMyMat.value = null
    setTimeout(() => postToFrame({ type: 'cp-poster:add-image', url }), 2500)
  }
}

function postToFrame(d: any) {
  frame.value?.contentWindow?.postMessage({ target: 'cp-poster-iframe', ...d }, '*')
}

// ---- 素材 → 画布 ----
const pendingMyMat = ref<string | null>(null)
function addMaterial(m: Mat) {
  if (!tPolicy.value) return
  addByUrl(tUrl(m.file))
}
function addMyMaterial(f: FileItem) {
  addByUrl(rawOf(f.path))
}
function addByUrl(url: string) {
  if (!frameSrc.value) {
    // 还没有画布：先开空白板再投递
    newBoard()
    pendingMyMat.value = url
    return
  }
  postToFrame({ type: 'cp-poster:add-image', url })
}

// ---- 导出 PNG（iframe 前端出图 → dataURL 回传宿主） ----
let exportState: { mode: 'cloud' | 'local'; timer: ReturnType<typeof setTimeout> } | null = null
function exportPng(mode: 'cloud' | 'local') {
  if (!frameSrc.value) { toast.error('请先打开模板或新建画布'); return }
  if (exporting.value) return
  exporting.value = true
  postToFrame({ type: 'cp-poster:export' })
  exportState = {
    mode,
    timer: setTimeout(() => {
      if (exportState) { exportState = null; exporting.value = false; toast.error('导出超时：编辑器未就绪，请重试') }
    }, 60000)
  }
}

// dataURL → Blob（不经过 fetch：宿主 CSP connect-src 'self' 会拦 data: 地址）
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

async function handleExported(mode: 'cloud' | 'local', dataUrl: string, fileName: string) {
  try {
    const blob = dataUrlToBlob(dataUrl)
    const file = new File([blob], fileName, { type: blob.type || 'image/png' })
    if (mode === 'cloud') {
      if (!savePolicy.value) { toast.error('未找到可保存的云盘'); return }
      transfer.addFiles(savePolicy.value.id, '/poster', [file])
      toast.success(`PNG 正在上传到 /poster/${fileName}`)
      setTimeout(loadMy, 3000)
    } else {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = fileName
      a.click()
    }
  } catch (err: any) {
    toast.error('PNG 处理失败：' + (err?.message || ''))
  }
}

// ---- 宿主 ↔ iframe postMessage 桥 ----
function onMessage(e: MessageEvent) {
  const d = e.data
  if (!d || typeof d !== 'object') return
  // iframe → 宿主：保存作品
  if (d.type === 'cp-poster:save') {
    handleSave(d)
    return
  }
  // iframe → 宿主：导出结果
  if (d.type === 'cp-poster:exported') {
    const st = exportState
    if (st) { clearTimeout(st.timer); exportState = null }
    exporting.value = false
    if (d.error) { toast.error(d.error); return }
    if (!st || !d.dataUrl) return
    handleExported(st.mode, d.dataUrl, d.fileName || '海报.png')
    return
  }
  // iframe → 宿主：存为模板（JSON + 缩略图）
  if (d.type === 'cp-poster:exported-all') {
    handleExportedAll(d)
    return
  }
  // iframe → 宿主：素材上画布回执
  if (d.type === 'cp-poster:added') { /* 静默成功 */ return }
  if (d.type === 'cp-poster:add-error') { toast.error('素材添加失败，请重试'); return }
}

async function handleSave(d: any) {
  const reply = (ok: boolean, msg = '') => {
    frame.value?.contentWindow?.postMessage({ target: 'cp-poster-iframe', type: 'cp-poster:saved', ok, msg }, '*')
  }
  try {
    const pid = Number(d.policyId)
    if (!pid || !d.path) { reply(false, '保存目标无效'); return }
    await fsApi.writeText(pid, d.path, d.data)
    reply(true, d.path)
    loadMy()
  } catch (err: any) {
    reply(false, err?.message || '保存失败')
  }
}

onMounted(async () => {
  window.addEventListener('message', onMessage)
  try {
    loadingManifest.value = true
    policies.value = await fsApi.policies()
    await reloadManifest()
  } catch (e) {
    toast.error('资源库加载失败')
  } finally {
    loadingManifest.value = false
  }
  loadMy()
  if (isAdmin.value) {
    try {
      const r: any = await adminApi.users(1, 200)
      adminUsers.value = (r.list || r.items || r.users || (Array.isArray(r) ? r : [])).filter((u: any) => u.id !== session.user?.id)
      if (adminUsers.value.length) adminUid.value = adminUsers.value[0].id
    } catch { /* 忽略 */ }
  }
  // Explorer 双击 .poster.json 进入：直接打开该作品
  const p = props.props
  if (p?.policyId && p?.path) {
    currentTitle.value = (p.name || p.path).replace(/\.poster\.json$/i, '')
    frameSrc.value = `/vendor/poster/index.html?r=${++srcNonce}#/home?cp=1&pid=${p.policyId}&cpath=${encodeURIComponent(p.path)}&tok=${encodeURIComponent(getToken() || '')}${savePolicy.value ? `&spid=${savePolicy.value.id}&spath=${encodeURIComponent('/poster')}` : ''}`
  } else {
    newBoard()
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
})
</script>

<style scoped>
.poster-root {
  display: flex;
  /* app-root 基类是纵向 flex，本应用需要横向（左资源库 + 右编辑器） */
  flex-direction: row;
  flex: 1;
  min-height: 0;
  background: var(--bg-1, #f3f5f9);
}
.poster-side {
  width: 300px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bd-1, #e3e7ee);
  background: var(--bg-2, #fff);
}
.side-tabs { display: flex; border-bottom: 1px solid var(--bd-1, #e3e7ee) }
.side-tab {
  flex: 1; padding: 9px 0; text-align: center; font-size: 13px; cursor: pointer;
  color: var(--text-2, #667); border-bottom: 2px solid transparent; user-select: none; white-space: nowrap;
}
.side-tab.on { color: var(--text-1, #223); font-weight: 600; border-bottom-color: var(--accent-1, #2f86d6) }
.side-body { flex: 1; overflow: auto; display: flex; flex-direction: column; min-height: 0 }
.src-chips { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px }
.src-chip {
  font-size: 12px; padding: 3px 10px; border-radius: 999px; cursor: pointer; user-select: none;
  color: var(--text-2, #667); background: var(--bg-1, #eef1f6);
}
.src-chip.on { color: #fff; background: var(--accent-1, #2f86d6) }
.mini-btn {
  font-size: 12px; padding: 3px 10px; border-radius: 6px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--bd-1, #dfe3ea); background: var(--bg-2, #fff); color: var(--text-1, #223);
}
.mini-btn.primary { color: #fff; background: var(--accent-1, #2f86d6); border-color: var(--accent-1, #2f86d6) }
.mini-btn:disabled { opacity: .55; cursor: default }
.side-search { padding: 8px 10px }
.side-search input {
  width: 100%; box-sizing: border-box; padding: 6px 9px; font-size: 12px;
  border: 1px solid var(--bd-1, #dfe3ea); border-radius: 6px; outline: none; background: var(--bg-1, #f6f8fb);
}
.tpl-grid, .mat-grid { display: grid; gap: 8px; padding: 4px 10px 12px }
.tpl-grid { grid-template-columns: repeat(2, 1fr) }
.mat-grid { grid-template-columns: repeat(3, 1fr) }
.tpl-card {
  position: relative; border-radius: 8px; overflow: hidden; cursor: pointer;
  border: 1px solid var(--bd-1, #e3e7ee); background: #fff; transition: box-shadow .15s;
}
.tpl-card:hover { box-shadow: 0 2px 10px rgba(30, 60, 120, .18) }
.tpl-card img { width: 100%; aspect-ratio: 750 / 1100; object-fit: cover; display: block }
.tpl-ph { width: 100%; aspect-ratio: 750 / 1100; display: flex; align-items: center; justify-content: center; color: var(--text-3, #98a); background: var(--bg-1, #f2f4f8) }
.tpl-meta { display: flex; justify-content: space-between; align-items: center; padding: 4px 7px; gap: 6px }
.tpl-name { font-size: 11px; color: var(--text-1, #223); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.tpl-size { font-size: 10px; color: var(--text-3, #98a); flex: none }
.mat-card { position: relative; border-radius: 6px; overflow: hidden; cursor: pointer; border: 1px solid var(--bd-1, #e3e7ee); background: #fff }
.mat-card:hover { box-shadow: 0 2px 8px rgba(30, 60, 120, .16) }
.mat-card img { width: 100%; aspect-ratio: 1; object-fit: contain; display: block; background: #f2f4f8 }
.card-del {
  position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%;
  background: rgba(0, 0, 0, .55); color: #fff; font-size: 13px; line-height: 17px; text-align: center;
  cursor: pointer; display: none; user-select: none;
}
.tpl-card:hover .card-del, .mat-card:hover .card-del, .work-row:hover .card-del { display: block }
.mat-cats { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 10px }
.mat-cat {
  font-size: 11px; padding: 3px 9px; border-radius: 999px; cursor: pointer; user-select: none;
  color: var(--text-2, #667); background: var(--bg-1, #eef1f6);
}
.mat-cat.on { color: #fff; background: var(--accent-1, #2f86d6) }
.side-tip { font-size: 11px; color: var(--text-3, #98a); text-align: center; padding: 0 8px 8px }
.side-empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 30px 10px; color: var(--text-3, #98a); font-size: 12px; text-align: center }
.admin-upload { border-top: 1px dashed var(--bd-1, #e3e7ee); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px }
.au-row { display: flex; gap: 6px; align-items: center }
.au-file { font-size: 11px; flex: 1; min-width: 0 }
.works-list { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px }
.work-row {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--bd-1, #e3e7ee); background: var(--bg-2, #fff); position: relative;
}
.work-row:hover { background: var(--bg-1, #f2f5fa) }
.work-thumb { width: 34px; height: 34px; object-fit: cover; border-radius: 5px; background: #f2f4f8 }
.work-info { flex: 1; min-width: 0 }
.work-name { font-size: 12px; color: var(--text-1, #223); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.work-size { font-size: 10px; color: var(--text-3, #98a) }
.admin-lib { display: flex; flex-direction: column }
.al-sec { font-size: 12px; font-weight: 600; color: var(--text-2, #556); padding: 10px 10px 2px }
.poster-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0 }
.poster-toolbar {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px;
  border-bottom: 1px solid var(--bd-1, #e3e7ee); background: var(--bg-2, #fff);
}
.toolbar-sel {
  font-size: 12px; padding: 5px 7px; border-radius: 6px;
  border: 1px solid var(--bd-1, #dfe3ea); background: var(--bg-2, #fff); color: var(--text-1, #223);
}
.tool-btn {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;
  padding: 5px 10px; border-radius: 6px; border: 1px solid var(--bd-1, #dfe3ea);
  background: var(--bg-2, #fff); color: var(--text-1, #223); white-space: nowrap;
}
.tool-btn:hover { background: var(--bg-1, #eef2f8) }
.tool-btn:disabled { opacity: .55; cursor: default }
.tool-sep { width: 1px; height: 18px; background: var(--bd-1, #e3e7ee) }
.toolbar-hint { font-size: 11px; color: var(--text-3, #98a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.poster-frame { flex: 1; width: 100%; border: none; background: #2b2f36 }
.poster-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  color: var(--text-2, #667); font-size: 13px;
}
.ph-sub { font-size: 12px; color: var(--text-3, #98a) }
</style>
