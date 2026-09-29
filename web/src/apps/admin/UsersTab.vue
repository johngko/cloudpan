<template>
  <!-- 用户管理：列表 + 配额/权限/启停/重置密码/删除 -->
  <div class="ac-head">
    <h2 class="ac-h2">用户管理</h2>
    <button class="btn primary" @click="openNewUser"><AppIcon name="plus" :size="15" />新建用户</button>
  </div>
  <div class="ac-card" style="padding: 4px 0">
    <table class="ac-table">
      <thead><tr><th>用户名</th><th>昵称</th><th>角色</th><th>用户组</th><th>配额</th><th>用量</th><th>状态</th><th style="width: 380px">操作</th></tr></thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td class="ac-strong">{{ u.username }}</td>
          <td>{{ u.nickname }}</td>
          <td><span class="ac-tag" :class="{ admin: u.role === 'admin' }">{{ u.role === 'admin' ? '管理员' : '用户' }}</span></td>
          <td>{{ groupName(u.groupId) }}</td>
          <td>{{ userQuotaText(u) }}</td>
          <td>{{ fmt(u.usedBytes) }}</td>
          <td><span class="ac-dot" :class="{ off: u.disabled }"></span>{{ u.disabled ? '已禁用' : '正常' }}</td>
          <td>
            <button class="btn" style="padding: 4px 10px" @click="openQuota(u)">配额</button>
            <button class="btn" style="padding: 4px 10px" @click="openPerms(u)">权限</button>
            <button class="btn" style="padding: 4px 10px" @click="toggleUser(u)">{{ u.disabled ? '启用' : '禁用' }}</button>
            <button class="btn" style="padding: 4px 10px" @click="resetPwd(u)">重置密码</button>
            <button class="btn danger" style="padding: 4px 10px" @click="delUser(u)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { users, groupName, openNewUser, openQuota, openPerms, toggleUser, resetPwd, delUser } from './state'
import { userQuotaText, fmt } from './format'
</script>
