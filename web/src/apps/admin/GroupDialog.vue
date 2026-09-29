<template>
  <!-- 新建 / 编辑用户组 -->
  <div class="dialog-mask" v-if="groupShow" @click.self="groupShow = false">
    <div class="dialog" style="width: 560px">
      <h3>{{ editGroup.id ? '编辑' : '新建' }}用户组</h3>
      <div class="dialog-body">
      <div class="row"><label>名称</label><input class="input" v-model="editGroup.name" style="width: 100%" /></div>
      <div class="row"><label>配额 MB（-1 不限）</label><input class="input" type="number" v-model.number="editGroup.quotaMB" style="width: 100%" /></div>
      <div class="row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
        <div><label>下载速度 KB/s（0 不限速）</label><input class="input" type="number" v-model.number="editGroup.downloadSpeedKB" style="width: 100%" /></div>
        <div><label>回收站保留天数（0 永久）</label><input class="input" type="number" v-model.number="editGroup.recycleRetentionDays" style="width: 100%" /></div>
      </div>
      <div class="row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
        <div><label>版本保留数（-1 不限）</label><input class="input" type="number" v-model.number="editGroup.keepVersions" style="width: 100%" /></div>
        <div><label>版本保留天数（0 永久）</label><input class="input" type="number" v-model.number="editGroup.versionRetentionDays" style="width: 100%" /></div>
      </div>
      <div class="row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
        <label style="display: flex; gap: 6px; align-items: center"><input type="checkbox" v-model="editGroup.allowShare" />允许分享</label>
        <label style="display: flex; gap: 6px; align-items: center"><input type="checkbox" v-model="editGroup.allowWebdav" />允许 WebDAV</label>
        <label style="display: flex; gap: 6px; align-items: center"><input type="checkbox" v-model="editGroup.allowArchive" />允许压缩解压</label>
        <label style="display: flex; gap: 6px; align-items: center"><input type="checkbox" v-model="editGroup.allowOffline" />允许离线下载</label>
        <label style="display: flex; gap: 6px; align-items: center"><input type="checkbox" v-model="editGroup.shareAllowDownload" />分享可下载</label>
        <label style="display: flex; gap: 6px; align-items: center" title="成员仅可查看/下载自己的盘，不能新建/上传/移动/删除（管理员豁免；不影响他人授予的可写共享）"><input type="checkbox" v-model="editGroup.readOnly" />只读（仅查看/下载）</label>
      </div>
      <div class="row">
        <label>应用权限（组内所有用户生效，可被用户个人设置覆盖）</label>
        <div class="perm-grid">
          <div v-for="a in appDefs" :key="a.key" class="perm-item"
               :class="{ allow: (editGroup.appPerms || {})[a.key] === true, deny: (editGroup.appPerms || {})[a.key] === false }">
            <span class="perm-name">{{ a.name }}</span>
            <div class="perm-seg">
              <button class="perm-btn" :class="{ on: (editGroup.appPerms || {})[a.key] === undefined }" @click="setGroupPerm(a.key, 'inherit')">默认</button>
              <button class="perm-btn" :class="{ on: (editGroup.appPerms || {})[a.key] === true }" @click="setGroupPerm(a.key, 'allow')">允许</button>
              <button class="perm-btn" :class="{ on: (editGroup.appPerms || {})[a.key] === false }" @click="setGroupPerm(a.key, 'deny')">禁止</button>
            </div>
          </div>
        </div>
      </div>
      <div class="row"><label>备注</label><input class="input" v-model="editGroup.remark" style="width: 100%" /></div>
      </div>
      <div class="actions">
        <button class="btn" @click="groupShow = false" :disabled="savingGroup">取消</button>
        <button class="btn primary" @click="saveGroup" :disabled="savingGroup">{{ savingGroup ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { groupShow, editGroup, appDefs, setGroupPerm, saveGroup, savingGroup } from './state'
</script>
