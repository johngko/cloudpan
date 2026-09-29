<template>
  <!-- 用户配额设置（随组 / 不限量 / 自定义） -->
  <div class="dialog-mask" v-if="quotaShow" @click.self="quotaShow = false">
    <div class="dialog" style="min-width: 380px">
      <h3>设置配额 — {{ quotaUser?.username }}</h3>
      <div class="row">
        <label>配额覆盖</label>
        <div style="width: 100%">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: normal">
            <input type="radio" v-model="quotaMode" value="group" />跟随用户组（{{ groupName(quotaUser?.groupId) }}{{ groupQuotaMB(quotaUser?.groupId) > 0 ? `，${groupQuotaMB(quotaUser?.groupId)}MB` : '，不限量' }}）
          </label>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: normal; margin-top: 8px">
            <input type="radio" v-model="quotaMode" value="unlimited" />不限量
          </label>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: normal; margin-top: 8px">
            <input type="radio" v-model="quotaMode" value="custom" />自定义上限
            <input class="input" type="number" min="1" v-model.number="quotaCustom" :disabled="quotaMode !== 'custom'" style="width: 120px" /> MB
          </label>
        </div>
      </div>
      <div class="row" style="color: var(--text-2); font-size: 12px">当前用量：{{ quotaUser?.usedBytes ? fmt(quotaUser.usedBytes) : '0' }}</div>
      <div class="actions">
        <button class="btn" @click="quotaShow = false">取消</button>
        <button class="btn primary" @click="saveQuota">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { quotaShow, quotaUser, quotaMode, quotaCustom, groupName, groupQuotaMB, saveQuota } from './state'
import { fmt } from './format'
</script>
