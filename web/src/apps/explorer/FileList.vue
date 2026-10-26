<template>
  <!-- 表格行：只负责「一行长什么样」；表头/占位行/滚动都在 Explorer -->
  <template v-for="f in items" :key="f.path">
    <tr :data-path="f.path" :class="{ selected: selSet.has(f.path) }" draggable="true"
      @pointerdown="$emit('item-down', f, $event)" @pointerup="$emit('item-up', f, $event)" @dblclick="$emit('item-open', f)" @contextmenu.stop.prevent="$emit('item-ctx', f, $event)"
      @dragstart="$emit('item-drag', f, $event)" @dragover.prevent @drop.prevent.stop="$emit('item-drop', f, $event)">
      <td style="width: 34px; text-align: center"><input type="checkbox" :checked="selSet.has(f.path)" @mousedown.stop.prevent @click.stop="$emit('check-toggle', f)" /></td>
      <td><div style="display: flex; align-items: center; gap: 10px">
        <AppIcon :name="iconOf(f)" :size="19" /><span class="fn-nm"><template v-for="(p, pi) in nameParts(f.name)" :key="pi"><mark v-if="p.hit">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span>
        <span v-if="f.tags?.length && tagColor" class="f-tags"><i v-for="tid in f.tags" :key="tid" :style="{ background: tagColor(tid) }" :title="tagName(tid)"></i></span>
        <span v-if="f.snippet" class="fn-snip" :title="f.snippet">…{{ f.snippet }}…</span>
        <span v-if="editing[f.path]" class="editing-badge" :title="'正在编辑：' + editing[f.path]"><span class="editing-dot"></span>编辑中</span>
        <AppIcon v-if="f.starred" name="starFill" :size="13" />
      </div></td>
      <td style="color: var(--text-3)">{{ fmtTime(f.modTime) }}</td>
      <td style="color: var(--text-3)">{{ f.isDir ? '文件夹' : (f.ext ? f.ext.toUpperCase() + ' 文件' : '文件') }}</td>
      <td style="text-align: right; color: var(--text-3)">{{ f.isDir ? '' : fmt(f.size) }}</td>
    </tr>
  </template>
</template>

<script setup lang="ts">
import type { FileItem } from '../../api/modules'
import AppIcon from '../../components/AppIcon.vue'

// 解析器与格式化函数由父组件注入：状态源都在 Explorer，子组件保持无状态
defineProps<{
  items: FileItem[]
  selSet: Set<string>
  editing: Record<string, string>
  iconOf: (f: FileItem) => string
  nameParts: (name: string) => { t: string; hit: boolean }[]
  fmt: (n: number) => string
  fmtTime: (ms: number) => string
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
/* 条目级样式随条目一起搬（父组件是 scoped，跨组件选择器够不着） */
/* 实时协作「正在编辑」绿点（悬停提示协作者名单） */
.editing-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--success); box-shadow: 0 0 5px var(--success-bg);
  vertical-align: middle;
}
.editing-badge {
  display: inline-flex; align-items: center; gap: 5px; flex: none;
  font-size: 11px; color: var(--success);
}
/* 列表复选框（表头全选框的样式留在 Explorer） */
.file-list td input[type="checkbox"] { width: 15px; height: 15px; margin: 0; accent-color: var(--theme-2); cursor: pointer; }
/* 标签圆点（行内叠加，不增行高） */
.f-tags { display: inline-flex; gap: 3px; flex: none; align-items: center; }
.f-tags i { width: 6px; height: 6px; border-radius: 50%; }
/* 内容检索命中摘要：单行省略，完整内容进 title */
.fn-snip { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
/* 搜索命中高亮（按片段渲染成 <mark>，不做 v-html） */
.fn-nm mark {
  background: color-mix(in srgb, var(--theme-2) 40%, transparent);
  color: inherit; border-radius: 2px; padding: 0 1px;
}
/* 大文件夹窗口化：行高固定 + 名称单行省略（普通目录不套用） */
.file-list.virtual tbody tr { height: 36px; }
.file-list.virtual .fn-nm { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
