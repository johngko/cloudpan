<template>
  <div class="transfer-panel glass">
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--stroke)">
      <div style="font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px">
        传输任务 ({{ transfer.tasks.length }})
        <span v-if="transfer.activeCount > 0" style="font-size: 11.5px; font-weight: 500; color: var(--text-3)">{{ transfer.activeCount }} 进行中</span>
        <span v-if="transfer.totalSpeed > 0 && transfer.activeCount > 0" style="font-size: 12px; font-weight: 500; color: var(--theme-2); font-variant-numeric: tabular-nums">↑ {{ fmtSpeed(transfer.totalSpeed) }}</span>
      </div>
      <button class="win-ctrl" style="width: 30px; height: 26px; border-radius: 5px" @click="transfer.panel(false)">
        <AppIcon name="close" :size="13" />
      </button>
    </div>
    <div style="overflow: auto">
      <div v-if="!transfer.tasks.length" class="empty-hint" style="position: static; padding: 30px 0">暂无传输任务</div>
      <div v-for="t in transfer.tasks" :key="t.id" class="transfer-item">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 7px">
          <div style="font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1">{{ t.name }}</div>
          <div style="display: flex; gap: 2px; flex: none">
            <button v-if="t.status === 'queued' || t.status === 'hashing' || t.status === 'uploading' || t.status === 'merging'" class="tool-btn" style="padding: 3px" title="暂停" @click="transfer.pause(t.id)"><AppIcon name="pause" :size="14" /></button>
            <button v-if="t.status === 'paused'" class="tool-btn" style="padding: 3px" title="继续" @click="transfer.resume(t.id)"><AppIcon name="play" :size="14" /></button>
            <!-- 失败即给重试入口（复用已算哈希与会话断点，续传不从头） -->
            <button v-if="t.status === 'error'" class="tool-btn" style="padding: 3px" title="重试" @click="transfer.retry(t.id)"><AppIcon name="refresh" :size="14" /></button>
            <button class="tool-btn" style="padding: 3px" title="取消" @click="transfer.cancel(t.id)"><AppIcon name="close" :size="13" /></button>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPct(t) + '%', background: progressColor(t) }"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-3); margin-top: 4px">
          <span>{{ statusText(t) }}</span>
          <span v-if="t.status === 'uploading' || t.status === 'hashing'">
            {{ progressPct(t) }}% ({{ fmt(t.uploaded) }} / {{ fmt(t.size) }})
            <template v-if="t.status === 'uploading' && t.speed > 0"> · {{ fmtSpeed(t.speed) }}</template>
          </span>
          <span v-else-if="t.status === 'paused'">{{ progressPct(t) }}% (已暂停)</span>
          <span v-else-if="t.status === 'error'">{{ fmt(t.uploaded) }} / {{ fmt(t.size) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTransfer, type TransferTask } from '../stores/transfer'
import AppIcon from '../components/AppIcon.vue'

const transfer = useTransfer()

function progressPct(t: TransferTask) {
  if (t.status === 'done' || t.status === 'instant') return 100
  if (t.progress && t.progress > 0) return Math.min(100, Math.round(t.progress))
  if (!t.size) return 0
  return Math.min(100, Math.round((t.uploaded / t.size) * 100))
}
function progressColor(t: TransferTask) {
  if (t.status === 'error') return 'var(--danger)'
  if (t.status === 'done' || t.status === 'instant') return '#3fbf6f'
  return 'linear-gradient(90deg, #3b91d8, #5ba0e6)'
}
function statusText(t: TransferTask) {
  switch (t.status) {
    case 'queued': return '排队中（等待并发槽位）'
    case 'hashing': return '计算校验中...'
    case 'uploading': return '上传中'
    case 'merging': return '服务端合并中...'
    case 'paused': return '已暂停'
    case 'done': return '上传完成'
    case 'instant': return '秒传完成'
    case 'error': return t.errMsg || '失败'
    default: return ''
  }
}
function fmtSpeed(n: number) {
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB/s'
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB/s'
  return n + ' B/s'
}
function fmt(n: number) {
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}
</script>
