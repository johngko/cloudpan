<script setup lang="ts">
// B8 任务视图的桌面条：Win 任务栏 / Mac 菜单栏 / Deepin Dock 共用（主题皮肤差异走各自容器类）
import { useWindows } from '../stores/windows'
const store = useWindows()
</script>

<template>
  <div class="dsk-strip" @click.stop>
    <div
      v-for="d in store.desktops" :key="d.id"
      class="dsk-chip" :class="{ on: d.id === store.currentDesktop }"
      @click="store.switchDesktop(d.id)"
    >
      <span>{{ d.name }}</span>
      <button
        v-if="store.desktops.length > 1" class="dsk-x" title="合并到其他桌面"
        @click.stop="store.removeDesktop(d.id)"
      >×</button>
    </div>
    <div v-if="store.desktops.length < 6" class="dsk-chip dsk-add" title="新建桌面（Alt+Ctrl+PageDown）" @click="store.addDesktop()">＋</div>
    <div class="dsk-hint">Alt+Ctrl+PageUp / PageDown 切换</div>
  </div>
</template>
