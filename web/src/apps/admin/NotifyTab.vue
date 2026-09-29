<template>
  <!-- 通知记录（含软清除，审计用） -->
  <div class="ac-head">
    <h2 class="ac-h2">通知记录</h2>
    <div style="display: flex; gap: 8px; align-items: center">
      <input class="input" v-model="notifKw" style="width: 180px" placeholder="搜索用户/类型/标题/内容" @keyup.enter="notifPage = 1; loadNotif()" />
      <button class="btn" @click="notifPage = 1; loadNotif()">查询</button>
      <label style="font-size: 12.5px; color: var(--text-2); display: flex; align-items: center; gap: 5px; cursor: pointer">
        <input type="checkbox" v-model="notifClearedOnly" @change="notifPage = 1; loadNotif()" />只看已清除
      </label>
      <button class="btn" :disabled="notifPage <= 1" @click="notifPage--; loadNotif()">上一页</button>
      <span style="font-size: 12px; color: var(--text-3)">第 {{ notifPage }} 页 / 共 {{ Math.ceil(notifTotal / 20) || 1 }} 页</span>
      <button class="btn" :disabled="notifPage >= Math.ceil(notifTotal / 20)" @click="notifPage++; loadNotif()">下一页</button>
    </div>
  </div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>时间</th><th>用户</th><th>类型</th><th>标题</th><th>内容</th><th>状态</th></tr></thead>
      <tbody>
        <tr v-for="n in notifList" :key="n.id">
          <td style="color: var(--text-3)">{{ new Date(n.createdAt).toLocaleString() }}</td>
          <td class="ac-strong">{{ n.username || n.userId }}</td>
          <td><span class="ac-tag">{{ notifTypeName(n.type) }}</span></td>
          <td>{{ n.title }}</td>
          <td style="color: var(--text-2); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap" :title="n.content">{{ n.content }}</td>
          <td>
            <span v-if="n.cleared" class="ac-tag" style="color: var(--danger, #e05252)">已清除</span>
            <span v-else-if="n.read" class="ac-tag">已读</span>
            <span v-else class="ac-tag" style="color: var(--theme-2)">未读</span>
          </td>
        </tr>
        <tr v-if="!notifList.length"><td colspan="6" style="text-align: center; color: var(--text-3); padding: 24px">暂无通知记录</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { notifList, notifKw, notifPage, notifTotal, notifClearedOnly, loadNotif } from './state'
import { notifTypeName } from './format'
</script>
