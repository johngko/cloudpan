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
            </div>
          </div>
          <button class="btn primary" v-if="info.allowDownload" @click="downloadCurrent">
            <AppIcon name="download" :size="15" /> 下载
          </button>
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
                <td style="padding: 8px 6px">{{ f.name }}</td>
                <td style="width: 110px; color: var(--text-3); padding: 8px 14px">{{ f.isDir ? '-' : fmt(f.size) }}</td>
                <td style="width: 90px; padding: 8px 14px; color: var(--text-3)">
                  <button v-if="info.allowDownload" class="tool-btn" style="padding: 3px 8px" @click.stop="downloadItem(f)">下载</button>
                  <button v-else-if="info.previewEnabled && canPreview(f)" class="tool-btn" style="padding: 3px 8px" @click.stop="openItem(f)">预览</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import AppIcon from '../components/AppIcon.vue'
import { resolveTheme } from '../themes/registry'
import { wallpaperClass } from '../assets/wallpapers'

// 分享页为公开页：按访客本机主题/壁纸渲染（localStorage），缺失时回落默认
const wpClass = computed(() => {
  const t = resolveTheme(localStorage.getItem('cp_theme'))
  const key = localStorage.getItem('cp_wallpaper')
  return wallpaperClass(t.wallpapers.some(w => w.key === key) ? key! : t.defaultWallpaper)
})

const route = useRoute()
const token = route.params.token as string
const info = ref<any>({})
const items = ref<any[]>([])
const pwd = ref('')
const stoken = ref('')
const verified = ref(false)
const errMsg = ref('')

const api = axios.create({ baseURL: '/api' })

onMounted(async () => {
  try {
    const r: any = (await api.get(`/s/${token}/info`)).data
    if (r.code !== 0) throw new Error(r.msg)
    info.value = r.data
    if (!r.data.hasPassword) { verified.value = true; await loadList() }
  } catch (e: any) {
    errMsg.value = e.message || '分享不存在或已过期'
  }
})

async function verify() {
  errMsg.value = ''
  try {
    const r: any = (await api.post(`/s/${token}/verify`, { password: pwd.value })).data
    if (r.code !== 0) throw new Error(r.msg)
    stoken.value = r.data.stoken
    verified.value = true
    await loadList()
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

function openItem(f: any) {
  if (f.isDir) {
    currentRel.value = f.relPath
    loadInto(f.relPath)
  } else if (info.value.previewEnabled && canPreview(f)) {
    window.open(`/api/s/${token}/raw?st=${stoken.value}&path=${encodeURIComponent(currentRel.value ? currentRel.value + '/' + f.relPath : f.relPath)}`)
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
