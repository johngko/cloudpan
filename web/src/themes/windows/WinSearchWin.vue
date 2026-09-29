<template>
  <!-- #search-win：600×594 居中，输入 + 页签 + 左列表/右详情（真实全局搜索） -->
  <div class="w12-panel w12-search show-begin" :class="{ show: shown }" @click.stop>
    <div class="w12-inwrap">
      <span class="w12-inico">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </span>
      <input type="text" class="w12-input" id="w12-search-input" placeholder="在这里输入你要搜索的内容"
        v-model="kw" @input="onInput" ref="inputEl" />
    </div>
    <div class="w12-search-tabs">
      <button v-for="t in tabs" :key="t" :class="{ now: tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <div class="w12-search-ans">
      <div class="w12-search-list">
        <!-- 应用（全部/应用） -->
        <template v-if="(tab === '全部' || tab === '应用') && appHits.length">
          <div class="w12-search-sec">应用</div>
          <div v-for="a in appHits" :key="a.id" class="w12-search-item" @click="openApp(a)">
            <AppIcon :name="a.icon" :size="25" /><span class="nm">{{ a.name }}</span>
          </div>
        </template>
        <!-- 文件（全部/文档/文件夹/照片，按当前页签过滤）：
             有关键词=搜索命中；无关键字=各盘顶层首屏（浏览态），小字标注来源盘 -->
        <template v-if="isFileTab && shownFiles.length">
          <div class="w12-search-sec">文件</div>
          <div v-for="(f, i) in shownFiles" :key="f.policyId + '|' + f.path" class="w12-search-item"
            :class="{ on: sel && sel.kind === 'file' && sel.idx === i }" @click="selFile(f, i)">
            <AppIcon :name="iconOf(f)" :size="25" /><span class="nm">{{ f.name }}</span>
            <small v-if="!kw && f.policyName">{{ f.policyName }}</small><small v-else-if="f.isDir">文件夹</small>
          </div>
        </template>
        <!-- 设置（静态设置页深链） -->
        <template v-if="tab === '设置'">
          <div class="w12-search-sec">设置</div>
          <div v-for="s in settingsHits" :key="s.id" class="w12-search-item" @click="openSettings(s)">
            <AppIcon :name="s.icon" :size="25" /><span class="nm">{{ s.name }}</span>
            <small v-if="kw">设置</small>
          </div>
        </template>
        <!-- 网页（交给内置浏览器搜索） -->
        <template v-if="tab === '网页' && kw">
          <div class="w12-search-sec">网页</div>
          <div class="w12-search-item" @click="openWeb()">
            <AppIcon name="browser" :size="25" />
            <span class="nm">在浏览器中搜索“{{ kw }}”</span>
          </div>
        </template>
        <!-- 空态：区分"加载中 / 无结果"，避免面板空白 -->
        <div v-if="kw && isFileTab && searching" class="w12-search-empty">正在搜索...</div>
        <div v-else-if="!kw && isFileTab && recentLoading" class="w12-search-empty">正在读取文件...</div>
        <div v-else-if="!kw && isFileTab && !recentLoading && !shownFiles.length" class="w12-search-empty">此类型下暂无文件</div>
        <div v-else-if="kw && isFileTab && !searching && !shownFiles.length && !(tab === '全部' && appHits.length)" class="w12-search-empty">未找到相关结果</div>
        <div v-else-if="kw && tab === '应用' && !appHits.length" class="w12-search-empty">未找到相关应用</div>
        <div v-else-if="kw && tab === '设置' && !settingsHits.length" class="w12-search-empty">未找到相关设置</div>
        <div v-else-if="tab === '网页' && !kw" class="w12-search-empty">输入关键词，用内置浏览器搜索网页</div>
      </div>
      <div class="w12-search-view" :class="{ on: !!sel }">
        <template v-if="sel && sel.kind === 'file'">
          <span class="w12-sv-icon"><AppIcon :name="iconOf(sel.item)" :size="70" /></span>
          <p class="w12-sv-name">{{ sel.item.name }}</p>
          <p class="w12-sv-type">{{ sel.item.isDir ? '文件夹' : (sel.item.ext ? sel.item.ext.toUpperCase() + ' 文件' : '文件') }}</p>
          <div class="w12-sv-opts">
            <div class="w12-sv-opt" @click="openSel">打开</div>
            <div class="w12-sv-opt" @click="copyPath(sel.item.path)">复制路径</div>
          </div>
        </template>
        <template v-else-if="sel && sel.kind === 'app'">
          <span class="w12-sv-icon"><AppIcon :name="sel.item.icon" :size="70" /></span>
          <p class="w12-sv-name">{{ sel.item.name }}</p>
          <p class="w12-sv-type">应用</p>
          <div class="w12-sv-opts">
            <div class="w12-sv-opt" @click="openApp(sel.item)">打开</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGlobalSearch, type SearchFile } from '../../shell/useGlobalSearch'
import { fileIcon } from '../../apps/explorer/fileIcons'
import AppIcon from '../../components/AppIcon.vue'

const props = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// 搜索逻辑全部来自 shell/useGlobalSearch（与 mac/deepin 通用搜索面板共用同一份），
// 本组件只负责 win12 的 w12-* 模板与位图图标，模板/CSS 与重构前完全一致。
// 搜索框元素：模板 ref="inputEl" 绑定后交给 composable 自动聚焦
const inputEl = ref<HTMLInputElement>()
const {
  kw, tab, tabs, sel, appHits, settingsHits, shownFiles, searching, recentLoading,
  isFileTab,
  onInput, selFile, openApp, openSettings, openWeb, openSel, copyPath
} = useGlobalSearch({ inputEl, onClose: () => emit('close') })

// 文件类型 → 图标名：统一走 explorer/fileIcons（唯一一份映射）+ AppIcon 分发。
// 这里不再硬编码任何 /icons/win12/ 路径 —— 这正是 P3.8「图标体系统一」要消掉的重复。
function iconOf(f: SearchFile) { return fileIcon(f, 'win12') }
</script>
