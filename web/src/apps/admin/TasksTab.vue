<template>
  <!-- 任务队列监控 -->
  <div class="ac-head"><h2 class="ac-h2">任务队列监控</h2></div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>ID</th><th>类型</th><th>状态</th><th>进度</th><th>时间</th><th>错误</th></tr></thead>
      <tbody>
        <tr v-for="t in tasks" :key="t.id">
          <td>#{{ t.id }}</td>
          <td><span class="ac-tag">{{ taskTypeName(t.type) }}</span></td>
          <td><span class="ac-status" :class="t.status === 'finished' ? 'active' : t.status"><span class="ac-dot" :class="{ off: t.status === 'error' || t.status === 'canceled' }"></span>{{ taskStatusName(t.status) }}</span></td>
          <td style="width: 160px"><div class="ac-progress"><div class="ac-progress-fill" :style="{ width: t.progress + '%' }"></div></div></td>
          <td style="color: var(--text-3)">{{ new Date(t.createdAt).toLocaleString() }}</td>
          <td style="color: var(--danger); font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis">{{ t.error }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="!tasks.length" style="padding: 24px; text-align: center; color: var(--text-3); font-size: 13px">暂无后台任务</div>
  </div>
</template>

<script setup lang="ts">
import { tasks } from './state'
import { taskTypeName, taskStatusName } from './format'
</script>
