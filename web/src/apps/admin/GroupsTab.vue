<template>
  <!-- 用户组：卡片列表（配额/开关/应用权限摘要） -->
  <div class="ac-head">
    <h2 class="ac-h2">用户组</h2>
    <button class="btn primary" @click="openNewGroup"><AppIcon name="plus" :size="15" />新建用户组</button>
  </div>
  <div class="ac-cards" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))">
    <div v-for="g in groups" :key="g.id" class="ac-card" style="padding: 16px 18px">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
        <AppIcon name="lock" :size="20" />
        <div style="font-weight: 600; flex: 1">{{ g.name }}</div>
        <span v-if="g.isDefault" class="ac-tag">默认</span>
      </div>
      <div class="ac-kv"><span>配额</span><b>{{ g.quotaMB > 0 ? g.quotaMB + ' MB' : '不限' }}</b></div>
      <div class="ac-kv"><span>分享 / WebDAV / 压缩 / 离线</span><b>{{ yn(g.allowShare) }} {{ yn(g.allowWebdav) }} {{ yn(g.allowArchive) }} {{ yn(g.allowOffline) }}</b></div>
      <div class="ac-kv"><span>分享可下载</span><b>{{ yn(g.shareAllowDownload) }}</b></div>
      <div class="ac-kv" title="显式设置的应用权限（默认=继承允许；详情点「编辑」查看三态网格）"><span>应用权限</span><b>{{ permSummary(g) }}</b></div>
      <div class="ac-kv"><span>版本保留</span><b>{{ g.keepVersions === -1 ? '不限' : (g.keepVersions || 10) + ' 个' }}{{ g.versionRetentionDays ? ' / ' + g.versionRetentionDays + ' 天' : ' / 永久' }}</b></div>
      <div style="display: flex; gap: 8px; margin-top: 12px">
        <button class="btn" style="flex: 1" @click="openEditGroup(g)">编辑</button>
        <button class="btn danger" style="flex: 1" @click="delGroup(g)">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { groups, openNewGroup, openEditGroup, delGroup } from './state'
import { yn, permSummary } from './format'
</script>
