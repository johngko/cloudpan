<template>
  <!-- 审计日志（分页 + 关键词 + 导出 CSV） -->
  <div class="ac-head">
    <h2 class="ac-h2">审计日志</h2>
    <div style="display: flex; gap: 8px; align-items: center">
      <input class="input" v-model="logKw" style="width: 160px" placeholder="搜索用户/动作/详情" @keyup.enter="logPage = 1; loadLogs()" />
      <button class="btn" @click="logPage = 1; loadLogs()">查询</button>
      <button class="btn" @click="exportLogs"><AppIcon name="download" :size="14" />导出 CSV</button>
      <button class="btn" :disabled="logPage <= 1" @click="logPage--; loadLogs()">上一页</button>
      <span style="font-size: 12px; color: var(--text-3)">第 {{ logPage }} 页 / 共 {{ Math.ceil(logTotal / 20) || 1 }} 页</span>
      <button class="btn" :disabled="logPage >= Math.ceil(logTotal / 20)" @click="logPage++; loadLogs()">下一页</button>
    </div>
  </div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>时间</th><th>用户</th><th>动作</th><th>详情</th><th>IP</th></tr></thead>
      <tbody>
        <tr v-for="l in logs" :key="l.id">
          <td style="color: var(--text-3)">{{ new Date(l.createdAt).toLocaleString() }}</td>
          <td class="ac-strong">{{ l.username }}</td>
          <td><span class="ac-tag">{{ l.action }}</span></td>
          <td style="color: var(--text-2)">{{ l.detail }}</td>
          <td style="color: var(--text-3)">{{ l.ip }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { logs, logKw, logPage, logTotal, loadLogs, exportLogs } from './state'
</script>
