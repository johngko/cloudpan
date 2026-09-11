<template>
  <div class="login-screen" :class="wpClass" style="align-items: flex-start; justify-content: flex-start; padding: 0">
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center">
      <div class="glass" style="width: 760px; max-width: 92vw; max-height: 86vh; border-radius: var(--radius-3xl); display: flex; flex-direction: column; overflow: hidden">
        <div style="padding: 22px 26px; border-bottom: 1px solid var(--stroke); display: flex; align-items: center; gap: 12px">
          <AppIcon :name="info.isDir ? 'folder' : 'file'" :size="30" />
          <div style="flex: 1">
            <div style="font-size: 17px; font-weight: 600">{{ info.name || '...' }}</div>
            <div style="font-size: 12px; color: var(--text-3); margin-top: 3px">
              {{ info.owner }} 分享{{ !info.isDir && info.size ? ' · ' + fmt(info.size) : '' }}{{ info.expiresAt ? ' · ' + new Date(info.expiresAt).toLocaleDateString() + ' 到期' : '' }}
              · {{ info.views || 0 }} 次浏览 · {{ info.downloads || 0 }} 次下载
              <span v-if="!info.isDir && editing['']" class="share-editing" :title="'当前还有协作者在线编辑：' + editing['']"><span class="share-editing-dot"></span>正在编辑：{{ editing[''] }}</span>
            </div>
          </div>
          <button class="btn" v-if="authed" :disabled="saveBusy" @click="openSaveDlg" title="一键保存到自己的网盘">
            <AppIcon name="cloud" :size="15" /> 保存到网盘
          </button>
          <button class="btn" v-if="!info.isDir && officeReady && OFFICE_DS_EXTS.includes(extOf(info.name))" @click="openOfficeEditor('')" title="ONLYOFFICE 在线编辑器（可编辑保存）">
            <AppIcon name="office" :size="15" /> 在线打开
          </button>
          <button class="btn primary" v-if="info.allowDownload" @click="downloadCurrent">
            <AppIcon name="download" :size="15" /> 下载
          </button>
        </div>

        <!-- 转存结果提示 -->
        <div v-if="saved" style="padding: 10px 26px 0; font-size: 12.5px; color: #7ee2a8">
          <AppIcon name="check" :size="14" style="vertical-align: -2px" /> {{ saved }}
        </div>

        <div v-if="!verified && info.hasPassword" style="padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 14px">
          <AppIcon name="lock" :size="40" />
          <div style="color: var(--text-2)">此分享已被加密，请输入提取码</div>
          <div style="display: flex; gap: 8px">
            <input class="input" placeholder="提取码" v-model="pwd" style="width: 200px" @keyup.enter="verify" />
            <button class="btn primary" @click="verify">提取文件</button>
          </div>
          <div v-if="errMsg" style="color: #ff8a80; font-size: 12.5px">{{ errMsg }}</div>
        </div>

        <div v-else style="flex: 1; overflow: auto; padding: 12px">
          <div v-if="errMsg" class="empty-hint">{{ errMsg }}</div>
          <table v-else class="file-list" style="width: 100%; border-collapse: collapse; font-size: 13px">
            <tbody>
              <tr v-for="f in items" :key="f.relPath" style="cursor: pointer"
                @click="openItem(f)" @dblclick="openItem(f)">
                <td style="width: 40px; padding: 8px 14px"><AppIcon :name="iconOf(f)" :size="20" /></td>
                <td style="padding: 8px 6px">{{ f.name }}
                  <span v-if="editing[f.relPath]" class="share-editing" :title="'正在编辑：' + editing[f.relPath]"><span class="share-editing-dot"></span>编辑中</span>
                </td>
                <td style="width: 110px; color: var(--text-3); padding: 8px 14px">{{ f.isDir ? '-' : fmt(f.size) }}</td>
                <td style="width: 90px; padding: 8px 14px; color: var(--text-3)">
                  <button v-if="officeReady && OFFICE_DS_EXTS.includes(f.ext)" class="tool-btn" style="padding: 3px 8px" @click.stop="openItem(f)">打开</button>
                  <button v-else-if="info.allowDownload" class="tool-btn" style="padding: 3px 8px" @click.stop="downloadItem(f)">下载</button>
                  <button v-else-if="info.previewEnabled && canPreview(f)" class="tool-btn" style="padding: 3px 8px" @click.stop="openItem(f)">预览</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 转存对话框：选目标盘 + 目标文件夹 -->
    <div class="dialog-mask" v-if="saveShow" @click.self="saveShow = false">
      <div class="dialog" style="width: 440px">
        <h3>保存到网盘</h3>
        <div class="row">
          <label>目标存储</label>
          <select class="input" v-model.number="savePolicyId" style="width: 100%" @change="onSavePolicyChange">
            <option v-for="p in savePolicies" :key="p.id" :value="p.id">{{ p.name }} ({{ p.letter }})</option>
          </select>
        </div>
        <div class="row">
          <label>目标文件夹</label>
          <div style="font-size: 12.5px; color: var(--text-2); margin-bottom: 6px">
            <span style="cursor: pointer" @click="pickCrumb(0)">根目录</span>
            <template v-for="(c, i) in saveCrumb" :key="i">
              <span style="opacity: 0.5"> › </span><span style="cursor: pointer" @click="pickCrumb(i + 1)">{{ c.name }}</span>
            </template>
          </div>
          <div style="max-height: 180px; overflow: auto; border: 1px solid var(--stroke); border-radius: 8px">
            <div v-for="d in saveDirs" :key="d.path" style="padding: 7px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px"
              :style="{ background: d.path === saveDir ? 'var(--hover, rgba(127,127,127,0.12))' : '' }" @click="pickDir(d)">
              <AppIcon name="folder" :size="15" />{{ d.name }}
            </div>
            <div v-if="!saveDirs.length" style="padding: 12px; font-size: 12px; color: var(--text-3)">（无子文件夹，保存到当前目录）</div>
          </div>
        </div>
        <div v-if="saveMsg" style="font-size: 12.5px; color: #ff8a80; margin-bottom: 8px">{{ saveMsg }}</div>
        <div class="actions">
          <button class="btn" @click="saveShow = false">取消</button>
          <button class="btn primary" :disabled="saveBusy" @click="doSave">{{ saveBusy ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import AppIcon from '../components/AppIcon.vue'
import { resolveTheme, availableThemes } from '../themes/registry'
import { wallpaperClass } from '../assets/wallpapers'
import { getToken } from '../api/http'

// 分享页为公开页：按站点主题渲染（管理员全局设置，游客/登录用户访问都一致），拉取失败回落 win12
const siteTheme = ref('win12')
const wpClass = computed(() => {
  const t = resolveTheme(siteTheme.value)
  const key = localStorage.getItem('cp_wallpaper')
  return wallpaperClass(t.wallpapers.some(w => w.key === key) ? key! : t.defaultWallpaper)
})

// 站点是否配置了 ONLYOFFICE Document Server（公开接口 /site/public 提供）：
// 配置后分享页 Office 文件直接进整页在线编辑器（Cloudreve 分享模式）
const officeReady = ref(false)

async function loadSiteTheme() {
  try {
    const r: any = (await api.get('/site/public')).data
    officeReady.value = !!r.data?.officeConfigured
    const th = r.data?.theme
    if (th === 'win12' || th === 'macos' || th === 'deepin') {
      siteTheme.value = th
      const el = document.documentElement
      for (const t of availableThemes()) el.classList.remove(t.rootClass)
      el.classList.add(resolveTheme(th).rootClass)
    }
  } catch { /* 回落默认主题 */ }
}

const route = useRoute()
const token = route.params.token as string
const info = ref<any>({})
const items = ref<any[]>([])
const pwd = ref('')
const stoken = ref('')
const verified = ref(false)
const errMsg = ref('')

const api = axios.create({ baseURL: '/api' })

// ---- 转存（保存到网盘）：仅登录用户可见 ----
const authed = computed(() => !!getToken())
const save = axios.create({ baseURL: '/api' })
save.interceptors.request.use(cfg => {
  const t = getToken()
  if (t) cfg.headers.Authorization = 'Bearer ' + t
  return cfg
})
const saveShow = ref(false)
const savePolicies = ref<any[]>([])
const savePolicyId = ref(0)
const saveDir = ref('/')
const saveDirs = ref<any[]>([])
const saveCrumb = ref<{ name: string; path: string }[]>([])
const saveBusy = ref(false)
const saveMsg = ref('')
const saved = ref('')

async function openSaveDlg() {
  saveMsg.value = ''
  saveShow.value = true
  if (!savePolicies.value.length) {
    try {
      const r: any = (await save.get('/policies')).data
      if (r.code !== 0 || !r.data?.length) { saveMsg.value = '没有可用的存储盘'; return }
      savePolicies.value = r.data
      savePolicyId.value = r.data[0].id
    } catch (e: any) { saveMsg.value = e.message || '加载存储失败'; return }
  }
  await resetSaveDir()
}
async function resetSaveDir() {
  saveCrumb.value = []
  try {
    const r: any = (await save.get(`/fs/list?policyId=${savePolicyId.value}&path=%2F`)).data
    if (r.code !== 0) throw new Error(r.msg)
    saveDir.value = '/'
    saveDirs.value = (r.data.items || []).filter((i: any) => i.isDir)
  } catch (e: any) { saveMsg.value = e.message }
}
function onSavePolicyChange() { resetSaveDir() }
function pickDir(d: any) {
  saveCrumb.value = [...saveCrumb.value, { name: d.name, path: d.path }]
  loadSaveDir(d.path)
}
function pickCrumb(i: number) {
  saveCrumb.value = saveCrumb.value.slice(0, i)
  loadSaveDir(i === 0 ? '/' : saveCrumb.value[i - 1].path)
}
async function loadSaveDir(dir: string) {
  try {
    const r: any = (await save.get(`/fs/list?policyId=${savePolicyId.value}&path=${encodeURIComponent(dir)}`)).data
    if (r.code !== 0) throw new Error(r.msg)
    saveDir.value = dir
    saveDirs.value = (r.data.items || []).filter((i: any) => i.isDir)
  } catch (e: any) { saveMsg.value = e.message }
}
async function doSave() {
  saveBusy.value = true
  saveMsg.value = ''
  try {
    const r: any = (await save.post(`/s/${token}/save?st=${encodeURIComponent(stoken.value)}`, { policyId: savePolicyId.value, path: saveDir.value })).data
    if (r.code !== 0) throw new Error(r.msg)
    const p = savePolicies.value.find(x => x.id === savePolicyId.value)
    saveShow.value = false
    saved.value = `已保存到 ${p ? p.name : '网盘'}${saveDir.value === '/' ? ' 根目录' : saveDir.value}`
    setTimeout(() => { saved.value = '' }, 6000)
  } catch (e: any) { saveMsg.value = e.message }
  finally { saveBusy.value = false }
}

onMounted(async () => {
  loadSiteTheme() // 站点主题（公开接口，无需登录）
  try {
    const r: any = (await api.get(`/s/${token}/info`)).data
    if (r.code !== 0) throw new Error(r.msg)
    info.value = r.data
    if (!r.data.hasPassword) { verified.value = true; await loadList(); startEditPoll() }
  } catch (e: any) {
    errMsg.value = e.message || '分享不存在或已过期'
  }
})

onBeforeUnmount(() => {
  if (editTimer) window.clearInterval(editTimer)
})

async function verify() {
  errMsg.value = ''
  try {
    const r: any = (await api.post(`/s/${token}/verify`, { password: pwd.value })).data
    if (r.code !== 0) throw new Error(r.msg)
    stoken.value = r.data.stoken
    verified.value = true
    await loadList()
    startEditPoll()
  } catch (e: any) { errMsg.value = e.message }
}

async function loadList() {
  if (!info.value.isDir) { items.value = []; return }
  try {
    const r: any = (await api.get(`/s/${token}/list?st=${stoken.value}`)).data
    if (r.code !== 0) throw new Error(r.msg)
    items.value = r.data
  } catch (e: any) { errMsg.value = e.message }
}

// Office 文档进整页在线编辑器（Cloudreve 分享模式：任何人打开分享链接都能在线编辑）；
// 单文件分享的 rel 为空（分享文件本身）
const OFFICE_DS_EXTS = ['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'odp']
function openOfficeEditor(rel: string) {
  location.hash = `/s/${token}/office?path=${encodeURIComponent(rel)}&st=${encodeURIComponent(stoken.value)}`
}

function openItem(f: any) {
  if (f.isDir) {
    currentRel.value = f.relPath
    loadInto(f.relPath)
  } else {
    const rel = currentRel.value ? currentRel.value + '/' + f.relPath : f.relPath
    if (OFFICE_DS_EXTS.includes(f.ext)) {
      openOfficeEditor(rel)
    } else if (info.value.previewEnabled && canPreview(f)) {
      window.open(`/api/s/${token}/raw?st=${stoken.value}&path=${encodeURIComponent(rel)}`)
    }
  }
}

const currentRel = ref('')

async function loadInto(rel: string) {
  try {
    const r: any = (await api.get(`/s/${token}/list?st=${stoken.value}&path=${encodeURIComponent(rel)}`)).data
    if (r.code !== 0) throw new Error(r.msg)
    items.value = r.data
  } catch (e: any) { errMsg.value = e.message }
}

// ---- 实时协作「正在编辑」：25s 轮询（匿名端点；目录分享最多查前 10 个 Office 文件）----
const editing = ref<Record<string, string>>({}) // relPath(''=分享文件本身) -> "访客、访客"
const sessID = Math.random().toString(36).slice(2, 12)
let editTimer: number | undefined
async function pollEditing() {
  if (!officeReady.value || !verified.value) { editing.value = {}; return }
  const files = info.value.isDir
    ? items.value.filter((f: any) => !f.isDir && OFFICE_DS_EXTS.includes(f.ext)).slice(0, 10)
    : (OFFICE_DS_EXTS.includes(extOf(info.value.name || '')) ? [{ relPath: '' }] : [])
  if (!files.length) { editing.value = {}; return }
  const out: Record<string, string> = {}
  await Promise.all(files.map(async (f: any) => {
    try {
      const r: any = (await api.get(`/s/${token}/office/status`, {
        params: { path: f.relPath || '', st: stoken.value, sess: sessID }
      })).data
      if (r.code === 0) {
        const names = (r.data.editors || []).filter((e: any) => !e.me).map((e: any) => e.name)
        if (names.length) out[f.relPath || ''] = names.join('、')
      }
    } catch { /* 忽略 */ }
  }))
  editing.value = out
}
function startEditPoll() {
  if (editTimer) window.clearInterval(editTimer)
  pollEditing()
  editTimer = window.setInterval(pollEditing, 25000)
}

function downloadCurrent() {
  const p = currentRel.value || ''
  window.open(`/api/s/${token}/download?st=${stoken.value}&path=${encodeURIComponent(p)}`)
}
function downloadItem(f: any) {
  const p = currentRel.value ? currentRel.value + '/' + f.relPath : f.relPath
  window.open(`/api/s/${token}/download?st=${stoken.value}&path=${encodeURIComponent(p)}`)
}

function canPreview(f: any) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'pdf'].includes(f.ext)
}
function extOf(name: string) {
  const i = (name || '').lastIndexOf('.')
  return i >= 0 ? name.substring(i + 1).toLowerCase() : ''
}
function iconOf(f: any) { return f.isDir ? 'folder' : iconForExt(f.ext) }
function iconForExt(ext: string) {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) return 'media'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'media'
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'].includes(ext)) return 'office'
  return 'file'
}
function fmt(n: number) {
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}
</script>

<style scoped>
/* 实时协作「正在编辑」徽章 */
.share-editing {
  display: inline-flex; align-items: center; gap: 5px;
  color: #4caf50; margin-left: 8px; white-space: nowrap;
}
.share-editing-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4caf50; box-shadow: 0 0 5px rgba(76, 175, 80, 0.85);
}
</style>
