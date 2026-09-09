<template>
  <div class="app-root">
    <div class="app-toolbar">
      <span style="font-size: 14px; font-weight: 600">应用中心</span>
      <div class="tool-sep"></div>
      <input class="input ac-search" placeholder="搜索功能…" v-model="kw" />
      <span style="flex: 1"></span>
      <span style="font-size: 12px; color: var(--text-3)">
        {{ isAdmin ? '管理员：可启停系统功能' : '普通用户：只读' }}
      </span>
    </div>

    <div style="flex: 1; overflow: auto; padding: 18px 22px">
      <div class="ac-sub">系统功能</div>
      <div class="ac-grid">
        <div v-for="a in filtered" :key="a.key" class="ac-card" :class="{ off: !a.enabled, locked: a.enabled && !a.allowed }">
          <div class="ac-ico"><AppIcon :name="a.icon" :size="38" /></div>
          <div style="flex: 1; min-width: 0">
            <div class="ac-name">
              {{ a.name }}
              <span class="ac-ver">v{{ a.version }}</span>
              <span v-if="a.enabled && !a.allowed" class="ac-tag-deny">无权限</span>
            </div>
            <div class="ac-desc">{{ a.desc }}</div>
          </div>
          <div class="ac-switch" :class="{ on: a.enabled && a.allowed, disabled: !isAdmin || (a.enabled && !a.allowed && !isAdmin) }"
               @click="toggle(a)" :title="switchTitle(a)">
            <span class="knob"></span>
          </div>
        </div>
      </div>
      <div v-if="!filtered.length" class="empty-hint" style="position: static; padding: 40px 0">未找到匹配的功能</div>

      <div class="ac-sub" style="margin-top: 26px">我的应用</div>
      <div class="ac-grid">
        <div v-for="a in installable" :key="a.id" class="ac-card" :class="{ off: !isInstalled(a.id) }">
          <div class="ac-ico"><AppIcon :name="a.icon" :size="38" /></div>
          <div style="flex: 1; min-width: 0">
            <div class="ac-name">
              {{ a.name }}
              <span class="ac-ver" :class="{ on: isInstalled(a.id) }">{{ isInstalled(a.id) ? '已安装' : '可安装' }}</span>
            </div>
            <div class="ac-desc">{{ installDesc(a.id) }}</div>
          </div>
          <button class="btn ac-inst-btn" :class="{ primary: !isInstalled(a.id) }" :disabled="busyInst === a.id" @click="installApp(a.id, !isInstalled(a.id))">
            {{ isInstalled(a.id) ? '卸载' : '安装' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSession } from '../stores/session'
import { useAppState } from '../stores/appstate'
import { useToast } from '../stores/dialog'
import { installableApps } from '../stores/apps'
import { appsApi, adminApi, type SysApp } from '../api/modules'
import AppIcon from '../components/AppIcon.vue'

const session = useSession()
const appstate = useAppState()
const toast = useToast()
const isAdmin = computed(() => session.user?.role === 'admin')

const kw = ref('')
const list = ref<SysApp[]>([])
const busy = ref('')
const busyInst = ref('')

const filtered = computed(() =>
  list.value.filter(a =>
    // 非管理员只看「全局启用 且 自己有权限」的功能——无权限的功能不显示（连图标都不见）；
    // 管理员看全部（启停管理面）
    (isAdmin.value || (a.enabled && a.allowed)) &&
    (!kw.value || a.name.includes(kw.value) || a.desc.includes(kw.value))
  )
)

// 可安装应用（用户自装自卸；安装态存用户设置 KV，启动器按安装态过滤）
const installable = computed(() => installableApps())
const INSTALL_DESCS: Record<string, string> = {
  mediacenter: '视频/音乐媒体库：自动扫描全盘媒体文件，播放列表、继续观看进度云端保存。'
}
function installDesc(id: string) {
  return INSTALL_DESCS[id] || '可选应用，安装后出现在桌面与开始菜单。'
}
function isInstalled(id: string) {
  return appstate.isInstalled(id)
}
async function installApp(id: string, on: boolean) {
  if (busyInst.value) return
  busyInst.value = id
  try {
    appstate.setInstalled(id, on)
    const name = installableApps().find(a => a.id === id)?.name || id
    toast.show(on ? `已安装「${name}」，可在桌面/开始菜单打开` : `已卸载「${name}」`, on ? 'success' : 'info')
  } finally {
    busyInst.value = ''
  }
}

async function load() {
  try { list.value = await appsApi.list() } catch {}
}
onMounted(async () => {
  await appstate.load()
  await appstate.loadInstalled()
  await load()
})

function switchTitle(a: SysApp) {
  if (!a.enabled) return '点击启用'
  if (!a.allowed) return '你的账号无权使用此功能（可在管理控制台为用户组/用户授权）'
  return '点击停用'
}

async function toggle(a: SysApp) {
  if (!isAdmin.value || busy.value) return
  // 无权限的功能不允许通过全局开关"启用"（权限仍由组/用户控制）
  if (a.enabled && !a.allowed) {
    toast.show('你的账号无权使用此功能', 'error')
    return
  }
  busy.value = a.key
  try {
    await adminApi.appToggle(a.key, !a.enabled)
    a.enabled = !a.enabled
    appstate.set(a.key, a.enabled)
    toast.show(a.enabled ? `已启用「${a.name}」` : `已停用「${a.name}」`, a.enabled ? 'success' : 'info')
  } catch (e: any) {
    toast.show(e.message || '操作失败', 'error')
  } finally {
    busy.value = ''
  }
}
</script>

<style scoped>
.ac-search { width: 220px; }
.ac-sub { font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 12px; }
.ac-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 12px;
}
.ac-card {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px; border-radius: var(--radius); border: 1px solid var(--stroke-b);
  background: var(--card);
  transition: opacity 0.15s, border-color 0.15s;
}
.ac-card:hover { border-color: var(--stroke); }
.ac-card.off { opacity: 0.62; }
.ac-card.locked { opacity: 0.7; }
.ac-tag-deny {
  font-size: 10px; font-weight: 500; color: var(--text-2);
  background: var(--hover-b); border-radius: 4px; padding: 1px 6px;
}
.ac-ico { flex: none; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: var(--hover-b); }
.ac-name { font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.ac-ver { font-size: 10.5px; font-weight: 400; color: var(--text-3); }
.ac-desc { font-size: 11.5px; color: var(--text-3); margin-top: 3px; line-height: 1.4; }
.ac-switch {
  flex: none; width: 38px; height: 22px; border-radius: 11px; position: relative; cursor: pointer;
  background: var(--stroke); transition: background 0.18s;
}
.ac-switch.disabled { cursor: default; opacity: 0.55; }
.ac-switch .knob {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left 0.18s;
}
.ac-switch.on { background: var(--theme-2); }
.ac-switch.on .knob { left: 18px; }
.ac-inst-btn { flex: none; padding: 4px 14px; font-size: 12px; }
.ac-ver.on { color: #3fbf6f; }
</style>
