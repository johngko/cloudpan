<template>
  <!-- 用户个人应用权限（三态：继承 / 允许 / 禁止） -->
  <div class="dialog-mask" v-if="permShow" @click.self="permShow = false">
    <div class="dialog" style="width: 560px">
      <h3>应用权限 — {{ permUser?.username }}</h3>
      <div class="dialog-body">
      <div class="row" style="color: var(--text-3); font-size: 12px">
        个人设置优先于用户组；「继承」表示跟随该用户所属用户组的设置。
      </div>
      <div class="row">
        <div class="perm-grid">
          <div v-for="a in appDefs" :key="a.key" class="perm-item"
               :class="{ allow: permForm[a.key] === true, deny: permForm[a.key] === false }">
            <span class="perm-name">{{ a.name }}</span>
            <div class="perm-seg">
              <button class="perm-btn" :class="{ on: permForm[a.key] === undefined }" @click="setPerm(a.key, 'inherit')">继承</button>
              <button class="perm-btn" :class="{ on: permForm[a.key] === true }" @click="setPerm(a.key, 'allow')">允许</button>
              <button class="perm-btn" :class="{ on: permForm[a.key] === false }" @click="setPerm(a.key, 'deny')">禁止</button>
            </div>
          </div>
        </div>
      </div>
      </div>
      <div class="actions">
        <button class="btn" @click="permShow = false" :disabled="savingPerms">取消</button>
        <button class="btn primary" @click="savePerms" :disabled="savingPerms">{{ savingPerms ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { permShow, permUser, appDefs, permForm, setPerm, savePerms, savingPerms } from './state'
</script>
