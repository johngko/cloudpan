<template>
  <!-- 共享审计（站内用户共享：目录直接授权给目标用户/组/所有人，无链接） -->
  <div class="ac-head">
    <div style="min-width: 0">
      <h2 class="ac-h2">共享审计</h2>
      <div style="font-size: 12px; color: var(--text-3); margin-top: 4px">与「分享审计」（外链）不同：站内共享把目录直接授权给目标，对方登录后即可在「共享」中随时查看/下载，无链接与提取码。</div>
    </div>
    <div style="display: flex; gap: 8px; flex: none">
      <input class="input" v-model="userShareKw" @keyup.enter="loadUserShares" placeholder="搜索目录名/路径" style="width: 200px" />
      <button class="btn" @click="loadUserShares">查询</button>
    </div>
  </div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>目录</th><th>所在盘</th><th>共享者</th><th>共享给</th><th>权限</th><th>浏览/下载</th><th>创建时间</th><th style="width: 90px">操作</th></tr></thead>
      <tbody>
        <tr v-for="s in allUserShares" :key="s.id">
          <td class="ac-strong" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis" :title="s.path">{{ s.name }}<span style="color: var(--text-3); font-weight: 400; font-size: 11px">{{ s.path === '/' ? '（整盘）' : ' ' + s.path }}</span></td>
          <td>{{ s.policy }}</td>
          <td>{{ s.owner }} ({{ s.ownerName }})</td>
          <td>{{ s.targetName }}<span style="color: var(--text-3); font-size: 11px">（{{ s.targetType === 'all' ? '所有人' : s.targetType === 'group' ? '用户组' : '用户' }}）</span></td>
          <td>{{ s.perm === 'rw' ? '可写' : '只读' }}</td>
          <td>{{ s.views }} / {{ s.downloads }}</td>
          <td>{{ new Date(s.createdAt).toLocaleString() }}</td>
          <td><button class="btn danger" style="padding: 4px 10px" @click="adminDelUserShare(s)">取消</button></td>
        </tr>
      </tbody>
    </table>
    <div v-if="!allUserShares.length" style="padding: 24px; text-align: center; color: var(--text-3); font-size: 13px">暂无站内共享</div>
  </div>
</template>

<script setup lang="ts">
import { allUserShares, userShareKw, loadUserShares, adminDelUserShare } from './state'
</script>
