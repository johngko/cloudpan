<template>
  <!-- 分享审计（外链） -->
  <div class="ac-head"><h2 class="ac-h2">分享审计</h2></div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>文件</th><th>分享者</th><th>提取码</th><th>浏览/下载</th><th>到期</th><th style="width: 90px">操作</th></tr></thead>
      <tbody>
        <tr v-for="s in allShares" :key="s.id">
          <td class="ac-strong" style="max-width: 220px; overflow: hidden; text-overflow: ellipsis">{{ s.name }}{{ s.isDir ? ' (目录)' : '' }}</td>
          <td>{{ s.owner }} ({{ s.ownerName }})</td>
          <td>{{ s.hasPassword ? '有' : '无' }}</td>
          <td>{{ s.views }} / {{ s.downloads }}</td>
          <td>{{ s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : '永久' }}</td>
          <td><button class="btn danger" style="padding: 4px 10px" @click="adminDelShare(s)">取消</button></td>
        </tr>
      </tbody>
    </table>
    <div v-if="!allShares.length" style="padding: 24px; text-align: center; color: var(--text-3); font-size: 13px">暂无分享</div>
  </div>
</template>

<script setup lang="ts">
import { allShares, adminDelShare } from './state'
</script>
