<template>
  <!-- 新建用户 -->
  <div class="dialog-mask" v-if="userShow" @click.self="userShow = false">
    <div class="dialog">
      <h3>新建用户</h3>
      <div class="row"><label>用户名</label><input class="input" v-model="userForm.username" style="width: 100%" /></div>
      <div class="row"><label>密码</label><input class="input" v-model="userForm.password" style="width: 100%" /></div>
      <div class="row"><label>昵称</label><input class="input" v-model="userForm.nickname" style="width: 100%" /></div>
      <div class="row">
        <label>角色 / 用户组</label>
        <div style="display: flex; gap: 8px">
          <select class="input" v-model="userForm.role" style="flex: 1">
            <option value="user">用户</option><option value="admin">管理员</option>
          </select>
          <select class="input" v-model.number="userForm.groupId" style="flex: 1">
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button class="btn" @click="userShow = false">取消</button>
        <button class="btn primary" @click="createUser">创建</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { userShow, userForm, groups, createUser } from './state'
</script>
