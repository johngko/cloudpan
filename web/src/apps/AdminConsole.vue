<template>
  <div class="app-root">
    <div style="display: flex; flex: 1; overflow: hidden">
      <!-- 侧栏（win12 设置风格） -->
      <div class="ac-side">
        <div class="ac-user">
          <div class="mini-avatar">{{ (session.user?.nickname || 'A').charAt(0) }}</div>
          <div>
            <div style="font-size: 13px; font-weight: 600">{{ session.user?.nickname }}</div>
            <div style="font-size: 11px; color: var(--text-3)">管理员 · {{ session.site.siteName }}</div>
          </div>
        </div>
        <div style="padding: 4px">
          <div v-for="t in tabs" :key="t.id" class="ac-nav" :class="{ active: tab === t.id }" @click="switchTab(t.id)">
            <AppIcon :name="t.icon" :size="17" />
            <span style="flex: 1">{{ t.name }}</span>
            <span v-if="t.badge" class="ac-badge">{{ t.badge }}</span>
          </div>
        </div>
      </div>

      <!-- 内容区：按当前页签渲染对应子组件（数据与逻辑都在 ./admin/state） -->
      <div class="ac-content">
        <DashTab v-if="tab === 'dash'" />
        <UsersTab v-else-if="tab === 'users'" />
        <GroupsTab v-else-if="tab === 'groups'" />
        <PoliciesTab v-else-if="tab === 'policies'" />
        <SharesTab v-else-if="tab === 'shares'" />
        <UserSharesTab v-else-if="tab === 'usershares'" />
        <TasksTab v-else-if="tab === 'tasks'" />
        <SettingsTab v-else-if="tab === 'settings'" />
        <UpdateTab v-else-if="tab === 'update'" />
        <LogsTab v-else-if="tab === 'logs'" />
        <NotifyTab v-else-if="tab === 'notify'" />
      </div>
    </div>

    <!-- 对话框：各自内部按开关渲染，挂在壳上避免随页签销毁导致输入态丢失 -->
    <UserDialog />
    <QuotaDialog />
    <PermsDialog />
    <GroupDialog />
    <PolicyDialog />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSession } from '../stores/session'
import AppIcon from '../components/AppIcon.vue'
import { tab, tabs, switchTab, loadAll, startSysPoll, stopSysPoll, stopAuthPoll, stopUpdPoll } from './admin/state'
import DashTab from './admin/DashTab.vue'
import UsersTab from './admin/UsersTab.vue'
import GroupsTab from './admin/GroupsTab.vue'
import PoliciesTab from './admin/PoliciesTab.vue'
import SharesTab from './admin/SharesTab.vue'
import UserSharesTab from './admin/UserSharesTab.vue'
import TasksTab from './admin/TasksTab.vue'
import SettingsTab from './admin/SettingsTab.vue'
import UpdateTab from './admin/UpdateTab.vue'
import LogsTab from './admin/LogsTab.vue'
import NotifyTab from './admin/NotifyTab.vue'
import UserDialog from './admin/UserDialog.vue'
import QuotaDialog from './admin/QuotaDialog.vue'
import PermsDialog from './admin/PermsDialog.vue'
import GroupDialog from './admin/GroupDialog.vue'
import PolicyDialog from './admin/PolicyDialog.vue'
// 管理台样式（原 scoped 样式迁出为独立样式表，原因见文件头注释）
import './admin/console.css'

const session = useSession()

onMounted(() => { loadAll(); startSysPoll() })
onUnmounted(() => { stopSysPoll(); stopAuthPoll(); stopUpdPoll() })
</script>
