<template>
  <!-- 网格条目：只负责「一个条目长什么样」；容器/滚动/占位/橡皮筋都在 Explorer -->
  <template v-for="f in items" :key="f.path + (f.letter || '')">
    <div class="file-item" :class="{ selected: selSet.has(f.path) }" :data-path="f.path" draggable="true"
      @pointerdown="$emit('item-down', f, $event)" @pointerup="$emit('item-up', f, $event)" @dblclick="$emit('item-open', f)" @contextmenu.stop.prevent="$emit('item-ctx', f, $event)"
      @dragstart="$emit('item-drag', f, $event)" @dragover.prevent @drop.prevent.stop="$emit('item-drop', f, $event)">
      <input type="checkbox" class="f-check" :checked="selSet.has(f.path)" @mousedown.stop.prevent @click.stop="$emit('check-toggle', f)" :title="selSet.has(f.path) ? '取消选择' : '选择'" />
      <span v-if="f.letter" class="g-badge">{{ f.letter }}</span>
      <div class="f-ico">
        <img v-if="isThumb(f)" :src="thumbUrl(f)" class="f-thumb" draggable="false" />
        <AppIcon v-else :name="iconOf(f)" :size="46" />
      </div>
      <div class="f-name"><span v-if="editing[f.path]" class="editing-dot" :title="'正在编辑：' + editing[f.path]"></span><template v-for="(p, pi) in nameParts(f.name)" :key="pi"><mark v-if="p.hit">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></div>
      <!-- 标签圆点：绝对定位在条目左下，不参与布局（窗口化固定行高不受影响） -->
      <span v-if="f.tags?.length && tagColor" class="f-tags"><i v-for="tid in f.tags" :key="tid" :style="{ background: tagColor(tid) }" :title="tagName(tid)"></i></span>
    </div>
  </template>
</template>

<script setup lang="ts">
import type { FileItem } from '../../api/modules'
import AppIcon from '../../components/AppIcon.vue'

// 解析器（图标/缩略图/高亮）由父组件注入：状态源都在 Explorer，子组件保持无状态
defineProps<{
  items: FileItem[]
  selSet: Set<string>
  editing: Record<string, string>
  iconOf: (f: FileItem) => string
  isThumb: (f: FileItem) => boolean
  thumbUrl: (f: FileItem) => string
  nameParts: (name: string) => { t: string; hit: boolean }[]
  tagColor?: (id: number) => string
  tagName?: (id: number) => string
}>()

defineEmits<{
  (e: 'item-down', f: FileItem, ev: MouseEvent): void
  (e: 'item-open', f: FileItem): void
  (e: 'item-ctx', f: FileItem, ev: MouseEvent): void
  (e: 'item-drag', f: FileItem, ev: DragEvent): void
  (e: 'item-drop', f: FileItem, ev: DragEvent): void
  (e: 'check-toggle', f: FileItem): void
  (e: 'item-up', f: FileItem, ev: PointerEvent): void
}>()
</script>

<style scoped>
/* 条目级样式随条目一起搬（父组件是 scoped，跨组件选择器够不着）；
   基础布局（.file-item/.f-ico/.f-name/.file-grid 等）在全局 base.css */
.g-badge {
  position: absolute; top: 7px; left: 9px; z-index: 2;
  background: linear-gradient(135deg, var(--theme-1), var(--theme-2));
  color: #fff; font-size: 10px; font-weight: 600; padding: 1.5px 7px; border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.28); box-shadow: 0 1px 4px rgba(0,0,0,0.18);
}
/* 实时协作「正在编辑」绿点（悬停提示协作者名单） */
.editing-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--success); box-shadow: 0 0 5px var(--success-bg);
  vertical-align: middle;
}
.f-name .editing-dot { margin-right: 5px; }
/* Win11 叠加复选框：悬停或选中时显示 */
.f-check {
  position: absolute; top: 7px; right: 9px; z-index: 3; width: 16px; height: 16px;
  margin: 0; cursor: pointer; opacity: 0; transition: opacity 0.12s ease; accent-color: var(--theme-2);
}
.file-item:hover .f-check, .file-item.selected .f-check { opacity: 1; }
.f-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,.14); }
/* 搜索命中高亮（按片段渲染成 <mark>，不做 v-html） */
.f-name mark {
  background: color-mix(in srgb, var(--theme-2) 40%, transparent);
  color: inherit; border-radius: 2px; padding: 0 1px;
}
/* 标签圆点：左下角叠加（绝对定位，窗口化固定行高不受影响） */
.f-tags { position: absolute; left: 8px; bottom: 7px; z-index: 2; display: flex; gap: 3px; }
.f-tags i { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.4); }
.dark .f-tags i { box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.35); }
/* 大文件夹窗口化：行高必须固定，窗口计算才成立（普通目录不套用）
   （112 = 12+10 内边距 + 46 图标 + 8 间距 + 两行 12px×1.35 名称 + 2 边框，取整留余） */
.file-grid.virtual .file-item { height: 112px; }
</style>
