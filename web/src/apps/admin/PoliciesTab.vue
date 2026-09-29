<template>
  <!-- 存储策略 / 磁盘挂载 -->
  <div class="ac-head">
    <h2 class="ac-h2">存储策略 / 磁盘挂载</h2>
    <button class="btn primary" @click="newPolicy"><AppIcon name="plus" :size="15" />挂载存储</button>
  </div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>盘符</th><th>名称</th><th>类型</th><th>根目录 / 状态</th><th>用量</th><th style="width: 240px">操作</th></tr></thead>
      <tbody>
        <tr v-for="p in policies" :key="p.id">
          <td class="ac-strong">{{ p.letter }}:</td>
          <td>{{ p.name }}</td>
          <td><span class="ac-tag" :class="{ admin: p.type !== 'local' }">{{ typeName(p.type) }}</span></td>
          <td>
            <div style="font-size: 12px; max-width: 240px; overflow: hidden; text-overflow: ellipsis" :title="p.rootPath || ''">{{ p.rootPath || p.statusMsg || '-' }}</div>
            <div class="ac-status" :class="p.status"><span class="ac-dot" :class="{ off: p.status !== 'active' }"></span>{{ p.status === 'active' ? '正常' : p.status === 'disabled' ? '已停用' : '异常' }}</div>
          </td>
          <td>
            <div>{{ fmt(p.usageBytes) }}<span v-if="p.totalBytes > 0" style="color: var(--text-3)"> / {{ fmt(p.totalBytes) }}</span></div>
            <div style="font-size: 11px; color: var(--text-3)">{{ p.totalBytes > 0 ? '剩余 ' + fmt(Math.max(0, p.totalBytes - p.usageBytes)) : (p.type === 'local' ? '未设分区大小（按真实分区）' : '云盘配额') }}</div>
          </td>
          <td>
            <button class="btn" style="padding: 4px 10px" @click="editPolicyRow(p)">编辑</button>
            <button class="btn" style="padding: 4px 10px" @click="checkPolicy(p)">测通</button>
            <button class="btn" style="padding: 4px 10px" @click="togglePolicy(p)">{{ p.status === 'disabled' ? '启用' : '停用' }}</button>
            <button class="btn danger" style="padding: 4px 10px" @click="delPolicy(p)">卸载</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!policies.length" style="padding: 24px; text-align: center; color: var(--text-3); font-size: 13px">点击右上角「挂载存储」把服务器目录或云盘挂到此电脑</div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { policies, newPolicy, editPolicyRow, checkPolicy, togglePolicy, delPolicy } from './state'
import { fmt, typeName } from './format'
</script>
