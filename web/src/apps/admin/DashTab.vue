<template>
  <!-- 仪表盘：统计卡 + 系统资源（实时采样）+ 存储概览 -->
  <h2 class="ac-h2">仪表盘</h2>
  <div class="ac-cards">
    <div class="ac-card ac-stat">
      <div class="ac-stat-num">{{ dash.users ?? '-' }}</div>
      <div class="ac-stat-lbl">用户总数</div>
    </div>
    <div class="ac-card ac-stat">
      <div class="ac-stat-num">{{ dash.policies ?? '-' }}</div>
      <div class="ac-stat-lbl">已挂载存储</div>
    </div>
    <div class="ac-card ac-stat">
      <div class="ac-stat-num">{{ dash.shares ?? '-' }}</div>
      <div class="ac-stat-lbl">分享总数</div>
    </div>
    <div class="ac-card ac-stat">
      <div class="ac-stat-num">{{ fmtGB(dash.usedBytes) }}</div>
      <div class="ac-stat-lbl">全站用量</div>
    </div>
  </div>
  <!-- 系统资源（实时采样，3s 轮询） -->
  <div class="ac-card sys-card" style="margin-top: 14px; padding: 16px 20px">
    <div class="ac-row-title">
      系统资源
      <span class="sys-live" v-if="sys && !sysMsg">实时</span>
      <span class="sys-live off" v-else-if="sysMsg">已停用</span>
    </div>
    <div v-if="sysMsg" class="sys-muted">{{ sysMsg }}</div>
    <div v-else-if="!sys" class="sys-muted">正在采样…</div>
    <div v-else class="sys-grid">
      <div class="sys-col">
        <div class="sys-block">
          <div class="sys-line"><span class="sys-name">CPU</span><span class="sys-val">{{ sys.cpuPct }}%</span></div>
          <div class="ac-progress"><div class="ac-progress-fill" :style="{ width: Math.min(100, sys.cpuPct) + '%' }"></div></div>
          <div class="sys-sub">{{ sys.model || '处理器' }} · {{ sys.cores }} 核</div>
          <div class="sys-cores" v-if="sys.perCore?.length">
            <div v-for="(p, i) in sys.perCore.slice(0, 16)" :key="i" class="sys-core" :title="'核心 ' + (Number(i) + 1) + ': ' + p + '%'">
              <div class="sys-core-fill" :style="{ height: Math.max(5, Math.min(100, p)) + '%' }"></div>
            </div>
            <span v-if="sys.perCore.length > 16" class="sys-core-more">×{{ sys.perCore.length }}</span>
          </div>
        </div>
        <div class="sys-block">
          <div class="sys-line"><span class="sys-name">内存</span><span class="sys-val">{{ fmt(sys.memUsed) }} / {{ fmt(sys.memTotal) }} · {{ sys.memPct }}%</span></div>
          <div class="ac-progress"><div class="ac-progress-fill" :style="{ width: Math.min(100, sys.memPct) + '%' }"></div></div>
        </div>
        <div class="sys-block">
          <div class="ac-kv"><span>主机名</span><b>{{ sys.hostname }}</b></div>
          <div class="ac-kv"><span>系统</span><b>{{ sys.platform }} {{ sys.kernel }}</b></div>
          <div class="ac-kv"><span>运行时长</span><b>{{ fmtUptime(sys.uptime) }}</b></div>
        </div>
      </div>
      <div class="sys-col">
        <div class="sys-block">
          <div class="sys-line"><span class="sys-name">磁盘</span></div>
          <div v-for="d in sys.disks" :key="d.mount" class="sys-disk">
            <div class="sys-disk-head">
              <span class="sys-disk-name" :title="d.mount">{{ d.mount }}{{ d.label ? ' · ' + d.label : '' }}</span>
              <span class="sys-disk-num">{{ fmt(d.used) }} / {{ fmt(d.total) }} · {{ d.pct }}%</span>
            </div>
            <div class="ac-progress"><div class="ac-progress-fill" :class="{ warn: d.pct > 85 }" :style="{ width: Math.max(2, Math.min(100, d.pct)) + '%' }"></div></div>
          </div>
          <div v-if="!sys.disks.length" class="sys-muted">未检测到磁盘</div>
        </div>
        <div class="sys-block">
          <div class="sys-line"><span class="sys-name">网络</span></div>
          <div v-for="n in sys.nets" :key="n.name" class="sys-net">
            <span class="sys-net-name">{{ n.name }}</span>
            <span class="sys-rx">↓ {{ fmtRate(n.rxRate) }}</span>
            <span class="sys-tx">↑ {{ fmtRate(n.txRate) }}</span>
          </div>
          <div v-if="!sys.nets.length" class="sys-muted">暂无活动的网络接口</div>
        </div>
      </div>
    </div>
  </div>

  <div class="ac-card" style="margin-top: 14px; padding: 16px 20px">
    <div class="ac-row-title">存储概览</div>
    <div v-for="p in policies" :key="p.id" style="margin: 12px 0">
      <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 6px">
        <span style="font-weight: 600">{{ p.name }} ({{ p.letter }})</span>
        <span style="color: var(--text-3)">{{ fmt(p.usageBytes) }} 已用 · {{ typeName(p.type) }}</span>
      </div>
      <div class="ac-progress"><div class="ac-progress-fill" :style="{ width: Math.max(3, Math.min(100, p.usageBytes / ((1<<30)*10) * 100)) + '%' }"></div></div>
    </div>
    <div v-if="!policies.length" style="color: var(--text-3); font-size: 12.5px">尚未挂载存储</div>
  </div>
</template>

<script setup lang="ts">
import { dash, sys, sysMsg, policies } from './state'
import { fmt, fmtGB, fmtUptime, fmtRate, typeName } from './format'
</script>
