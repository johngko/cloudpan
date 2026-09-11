<template>
  <!-- 壁纸中心：内置目录（当前主题）+ 管理员目录（站点设置）+ 我的壁纸（用户 KV，URL 形式）；
       定时自动轮换存用户 KV wallpaper_rotate_min，桌面外壳按间隔随机切换 -->
  <div class="app-root wp-root">
    <div class="app-toolbar">
      <AppIcon name="wallpapers" :size="18" />
      <b>壁纸中心</b>
      <span class="wp-sub">当前：{{ currentName }}</span>
      <div style="flex: 1"></div>
      <span style="font-size: 12px; color: var(--text-3)">定时轮换</span>
      <input class="input" type="number" min="0" max="1440" v-model.number="rotateMin" style="width: 70px" />
      <span style="font-size: 12px; color: var(--text-3)">分钟（0 = 关闭）</span>
      <button class="btn" :disabled="rotateBusy" @click="saveRotate">{{ rotateBusy ? '…' : '应用' }}</button>
    </div>

    <div class="wp-body">
      <!-- 内置 -->
      <div class="wp-sec">
        <div class="wp-sec-title">内置壁纸 · {{ theme.name }}</div>
        <div class="wp-grid">
          <div v-for="w in theme.wallpapers" :key="w.key" class="wp-card"
            :class="{ on: session.wallpaper === w.key }" @click="pick(w.key, w.name)">
            <div class="wp-thumb" :class="wallpaperClass(w.key)"></div>
            <div class="wp-cap">{{ w.name }}</div>
          </div>
        </div>
      </div>

      <!-- 管理员目录 -->
      <div v-if="catalog.length" class="wp-sec">
        <div class="wp-sec-title">管理员壁纸（全站可用）</div>
        <div class="wp-grid">
          <div v-for="(w, i) in catalog" :key="'c' + i" class="wp-card"
            :class="{ on: session.wallpaper === 'ext:' + w.url }" @click="pick('ext:' + w.url, w.name)">
            <div class="wp-thumb wp-thumb-img" :style="{ backgroundImage: `url(${w.url})` }"></div>
            <div class="wp-cap">{{ w.name || w.url }}</div>
          </div>
        </div>
      </div>

      <!-- 我的壁纸 -->
      <div class="wp-sec">
        <div class="wp-sec-title">
          我的壁纸
          <div style="display: flex; gap: 6px; align-items: center; margin-left: 12px">
            <input class="input" v-model="myName" placeholder="名称（可选）" style="width: 130px" />
            <input class="input" v-model="myUrl" placeholder="图片 URL，如 https://…/bg.jpg" style="width: 280px" />
            <button class="btn" :disabled="!myUrl.trim()" @click="addMy">添加</button>
          </div>
        </div>
        <div v-if="!myList.length" class="wp-empty">暂无。可添加任意图片 URL（含自己网盘的直链），或删除不需要的条目</div>
        <div v-else class="wp-grid">
          <div v-for="(w, i) in myList" :key="'m' + i" class="wp-card"
            :class="{ on: session.wallpaper === 'ext:' + w.url }" @click="pick('ext:' + w.url, w.name)">
            <div class="wp-thumb wp-thumb-img" :style="{ backgroundImage: `url(${w.url})` }"></div>
            <div class="wp-cap">
              {{ w.name || w.url }}
              <button class="wp-del" title="移除" @click.stop="delMy(i)">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 管理员：目录配置 -->
      <div v-if="isAdmin" class="wp-sec">
        <div class="wp-sec-title">管理员壁纸目录配置（JSON，全站生效）</div>
        <textarea class="input" v-model="catalogJson" rows="4"
          style="width: 100%; resize: vertical; font-family: Consolas, monospace; font-size: 12px"
          placeholder='[{"name":"云海","url":"https://example.com/bg1.jpg"}]'></textarea>
        <div style="margin-top: 8px; display: flex; gap: 8px">
          <button class="btn" :disabled="catalogBusy" @click="saveCatalog">{{ catalogBusy ? '保存中…' : '保存目录' }}</button>
          <span v-if="catalogMsg" style="font-size: 12px; color: var(--text-3); align-self: center">{{ catalogMsg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSession } from '../stores/session'
import { resolveTheme } from '../themes/registry'
import { wallpaperClass } from '../assets/wallpapers'
import { settingsApi, adminApi } from '../api/modules'
import { useToast } from '../stores/dialog'

const session = useSession()
const toast = useToast()
const theme = computed(() => resolveTheme(session.osTheme))
const isAdmin = computed(() => session.user?.role === 'admin')
const currentName = computed(() => {
  const w = session.wallpaper
  if (w.startsWith('ext:')) return w.slice(4).split('/').pop() || '自定义壁纸'
  return theme.value.wallpapers.find(x => x.key === w)?.name || w
})

const catalog = computed(() => session.site.wallpaperCatalog || [])
const myList = ref<{ name: string; url: string }[]>([])
const myName = ref('')
const myUrl = ref('')
const rotateMin = ref(0)
const rotateBusy = ref(false)
const catalogJson = ref('')
const catalogBusy = ref(false)
const catalogMsg = ref('')

async function loadMy() {
  try {
    const d = await settingsApi.get(['wallpaper_my', 'wallpaper_rotate_min'])
    try { myList.value = JSON.parse(d.wallpaper_my || '[]') } catch { myList.value = [] }
    rotateMin.value = Number(d.wallpaper_rotate_min || 0)
  } catch { /* ignore */ }
}
function pick(key: string, name: string) {
  session.setWallpaper(key)
  toast.success('已应用壁纸：' + name)
}
async function addMy() {
  const url = myUrl.value.trim()
  if (!url) return
  if (!/^https?:\/\//i.test(url)) { toast.error('图片地址需以 http(s):// 开头'); return }
  const item = { name: myName.value.trim(), url }
  myList.value = [...myList.value, item]
  await persistMy()
  myName.value = ''; myUrl.value = ''
  toast.success('已添加到我的壁纸')
}
async function delMy(i: number) {
  myList.value.splice(i, 1)
  await persistMy()
}
async function persistMy() {
  try { await settingsApi.set('wallpaper_my', JSON.stringify(myList.value)) } catch { /* ignore */ }
}
async function saveRotate() {
  rotateBusy.value = true
  try {
    await settingsApi.set('wallpaper_rotate_min', String(rotateMin.value || 0))
    toast.success(rotateMin.value > 0 ? `已开启定时轮换：每 ${rotateMin.value} 分钟` : '已关闭定时轮换')
  } catch (e: any) {
    toast.error('保存失败：' + (e.message || ''))
  } finally {
    rotateBusy.value = false
  }
}
async function saveCatalog() {
  catalogBusy.value = true
  catalogMsg.value = ''
  try {
    const raw = catalogJson.value.trim()
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('必须是数组')
    }
    await adminApi.settingsSet({ wallpaper_catalog: raw || '[]' })
    catalogMsg.value = '已保存'
    await session.loadSite()
    toast.success('壁纸目录已保存')
  } catch (e: any) {
    toast.error('保存失败：' + (e.message || ''))
  } finally {
    catalogBusy.value = false
  }
}

onMounted(async () => {
  loadMy()
  if (isAdmin) catalogJson.value = JSON.stringify(catalog.value, null, 2)
})
</script>

<style scoped>
.wp-root { display: flex; flex-direction: column }
.wp-sub { font-size: 12px; color: var(--text-3); margin-left: 8px }
.wp-body { flex: 1; overflow: auto; padding: 6px 18px 18px }
.wp-sec { margin-top: 14px }
.wp-sec-title {
  font-size: 13px; font-weight: 600; color: var(--text-2);
  margin-bottom: 8px; display: flex; align-items: center;
}
.wp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.wp-card {
  border: 1px solid var(--stroke); border-radius: 10px; overflow: hidden;
  cursor: pointer; transition: transform 120ms, border-color 120ms;
  background: var(--bg2);
}
.wp-card:hover { transform: translateY(-2px) }
.wp-card.on { border-color: var(--theme-1, #3b91d8); box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-1, #3b91d8) 35%, transparent) }
.wp-thumb { height: 86px; background-size: cover; background-position: center }
.wp-thumb-img { background-color: #101623 }
.wp-cap {
  font-size: 12px; padding: 6px 9px; color: var(--text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; gap: 6px;
}
.wp-del {
  border: none; background: rgba(229, 57, 53, 0.15); color: #e57373;
  border-radius: 4px; font-size: 10px; padding: 1px 5px; cursor: pointer;
}
.wp-del:hover { background: rgba(229, 57, 53, 0.3) }
.wp-empty { font-size: 12.5px; color: var(--text-3); padding: 10px 2px }
</style>
