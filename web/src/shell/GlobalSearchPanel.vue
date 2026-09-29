<template>
  <!-- 全局搜索面板（mac / deepin 共用）：主题中立外观（语义 token + AppIcon），
       逻辑来自 shell/useGlobalSearch，与 win12 的 WinSearchWin 完全一致。
       遮罩点击关闭；面板本体居中偏上（类 Spotlight） -->
  <div class="gsp-mask" @mousedown.self="emit('close')">
    <div class="gsp-panel glass" @click.stop>
      <div class="gsp-head">
        <AppIcon name="search" :size="18" class="gsp-head-ico" />
        <input ref="inputEl" v-model="kw" class="gsp-input" placeholder="搜索应用、文件、设置…"
          @input="onInput" />
      </div>
      <div class="gsp-tabs">
        <button v-for="t in tabs" :key="t" class="gsp-tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      </div>
      <div class="gsp-body">
        <div class="gsp-list">
          <!-- 应用（全部/应用） -->
          <template v-if="(tab === '全部' || tab === '应用') && appHits.length">
            <div class="gsp-sec">应用</div>
            <div v-for="a in appHits" :key="a.id" class="gsp-item" @click="openApp(a)">
              <AppIcon :name="a.icon" :size="22" /><span class="nm">{{ a.name }}</span>
            </div>
          </template>
          <!-- 文件（全部/文档/文件夹/照片，按当前页签过滤）：
               有关键词=搜索命中；无关键字=各盘顶层首屏（浏览态），小字标注来源盘 -->
          <template v-if="isFileTab && shownFiles.length">
            <div class="gsp-sec">文件</div>
            <div v-for="(f, i) in shownFiles" :key="f.policyId + '|' + f.path" class="gsp-item"
              :class="{ on: sel && sel.kind === 'file' && sel.idx === i }" @click="selFile(f, i)">
              <AppIcon :name="fileIcon(f, session.osTheme)" :size="22" /><span class="nm">{{ f.name }}</span>
              <small v-if="!kw && f.policyName">{{ f.policyName }}</small><small v-else-if="f.isDir">文件夹</small>
            </div>
          </template>
          <!-- 设置（静态设置页深链） -->
          <template v-if="tab === '设置'">
            <div class="gsp-sec">设置</div>
            <div v-for="s in settingsHits" :key="s.id" class="gsp-item" @click="openSettings(s)">
              <AppIcon :name="s.icon" :size="22" /><span class="nm">{{ s.name }}</span>
              <small v-if="kw">设置</small>
            </div>
          </template>
          <!-- 网页（交给内置浏览器搜索） -->
          <template v-if="tab === '网页' && kw">
            <div class="gsp-sec">网页</div>
            <div class="gsp-item" @click="openWeb()">
              <AppIcon name="browser" :size="22" /><span class="nm">在浏览器中搜索“{{ kw }}”</span>
            </div>
          </template>
          <!-- 空态：区分"加载中 / 无结果"，避免面板空白 -->
          <div v-if="kw && isFileTab && searching" class="gsp-empty">正在搜索...</div>
          <div v-else-if="!kw && isFileTab && recentLoading" class="gsp-empty">正在读取文件...</div>
          <div v-else-if="!kw && isFileTab && !recentLoading && !shownFiles.length" class="gsp-empty">此类型下暂无文件</div>
          <div v-else-if="kw && isFileTab && !searching && !shownFiles.length && !(tab === '全部' && appHits.length)" class="gsp-empty">未找到相关结果</div>
          <div v-else-if="kw && tab === '应用' && !appHits.length" class="gsp-empty">未找到相关应用</div>
          <div v-else-if="kw && tab === '设置' && !settingsHits.length" class="gsp-empty">未找到相关设置</div>
          <div v-else-if="tab === '网页' && !kw" class="gsp-empty">输入关键词，用内置浏览器搜索网页</div>
        </div>
        <div class="gsp-view" :class="{ on: !!sel }">
          <template v-if="sel && sel.kind === 'file'">
            <AppIcon class="gsp-vicon" :name="fileIcon(sel.item, session.osTheme)" :size="64" />
            <p class="gsp-vname">{{ sel.item.name }}</p>
            <p class="gsp-vtype">{{ sel.item.isDir ? '文件夹' : (sel.item.ext ? sel.item.ext.toUpperCase() + ' 文件' : '文件') }}</p>
            <div class="gsp-opts">
              <button class="gsp-opt" @click="openSel">打开</button>
              <button class="gsp-opt" @click="copyPath(sel.item.path)">复制路径</button>
            </div>
          </template>
          <template v-else-if="sel && sel.kind === 'app'">
            <AppIcon class="gsp-vicon" :name="sel.item.icon" :size="64" />
            <p class="gsp-vname">{{ sel.item.name }}</p>
            <p class="gsp-vtype">应用</p>
            <div class="gsp-opts">
              <button class="gsp-opt" @click="openApp(sel.item)">打开</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useGlobalSearch } from './useGlobalSearch'
import { fileIcon } from '../apps/explorer/fileIcons'
import { useSession } from '../stores/session'
import AppIcon from '../components/AppIcon.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const session = useSession()

// 搜索框元素：模板 ref="inputEl" 绑定后交给 composable 自动聚焦
const inputEl = ref<HTMLInputElement>()
const {
  kw, tab, tabs, sel, appHits, settingsHits, shownFiles, searching, recentLoading,
  isFileTab,
  onInput, selFile, openApp, openSettings, openWeb, openSel, copyPath
} = useGlobalSearch({ inputEl, onClose: () => emit('close') })

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
/* 遮罩：轻微压暗背景，点击空白关闭 */
.gsp-mask {
  position: fixed; inset: 0; z-index: 7500;
  display: flex; justify-content: center; align-items: flex-start;
  padding-top: 13vh; background: rgba(0, 0, 0, 0.22);
}
.gsp-panel {
  width: min(680px, 92vw); max-height: 64vh;
  border-radius: var(--radius-3xl);
  display: flex; flex-direction: column; overflow: hidden;
  animation: gsp-in 0.16s var(--anim-pop, ease);
}
@keyframes gsp-in { from { opacity: 0; transform: translateY(-10px) scale(0.985); } to { opacity: 1; transform: none; } }

.gsp-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border, var(--stroke-b)); }
.gsp-head-ico { flex: none; color: var(--text-3); }
.gsp-input { flex: 1; min-width: 0; border: none; background: transparent; font-size: 16px; color: var(--text); }
.gsp-input::placeholder { color: var(--text-3); }

.gsp-tabs { display: flex; gap: 2px; padding: 8px 12px; border-bottom: 1px solid var(--border, var(--stroke-b)); overflow-x: auto; }
.gsp-tab {
  flex: none; border: none; background: transparent; color: var(--text-2);
  padding: 4px 11px; border-radius: 999px; font-size: 12.5px; cursor: pointer;
}
.gsp-tab:hover { background: var(--hover-b); }
.gsp-tab.on { background: var(--accent-weak); color: var(--text); }

.gsp-body { flex: 1; display: flex; min-height: 0; }
.gsp-list { flex: 1 1 56%; overflow-y: auto; padding: 6px; }
.gsp-sec { font-size: 11.5px; font-weight: 600; color: var(--text-3); padding: 8px 10px 4px; }
.gsp-item {
  display: flex; align-items: center; gap: 10px; padding: 7px 10px;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--text); font-size: 13px;
}
.gsp-item:hover { background: var(--hover-b); }
.gsp-item.on { background: var(--accent-weak); }
.gsp-item .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gsp-item small { flex: none; font-size: 11px; color: var(--text-3); }
.gsp-empty { padding: 30px 16px; text-align: center; color: var(--text-3); font-size: 13px; }

.gsp-view {
  flex: 1 1 44%; border-left: 1px solid var(--border, var(--stroke-b));
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 20px; text-align: center;
}
.gsp-vicon { margin-bottom: 4px; }
.gsp-vname { font-size: 14px; font-weight: 600; color: var(--text); word-break: break-all; }
.gsp-vtype { font-size: 12px; color: var(--text-3); }
.gsp-opts { display: flex; gap: 8px; margin-top: 10px; }
.gsp-opt {
  border: 1px solid var(--stroke); background: var(--bg); color: var(--text);
  padding: 5px 14px; border-radius: var(--radius-sm); font-size: 12.5px; cursor: pointer;
}
.gsp-opt:hover { background: var(--hover-b); }

@media (max-width: 620px) {
  .gsp-view { display: none; }
  .gsp-list { flex: 1 1 100%; }
}
</style>
