<template>
  <!-- 系统更新：当前版本 / 来源配置 / 检查与更新 / 更新记录 -->
  <div class="ac-card" style="padding: 20px 24px">
    <div class="ac-set-title">当前版本</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>运行版本</b><span>构建时注入的版本号（dev = 本地构建）</span></div>
      <b style="font-size: 14px">{{ updStatus.current || '…' }}</b>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">更新来源</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>来源类型</b><span>GitHub 仓库：自动拉取 latest release 并挑选 linux 资产；直链：update_url 直接指向二进制/压缩包</span></div>
      <select class="input" v-model="updMode" style="width: 220px">
        <option value="github">GitHub 仓库</option>
        <option value="direct">直链下载</option>
      </select>
    </div>
    <template v-if="updMode === 'github'">
      <div class="ac-set-row">
        <div class="ac-set-lbl"><b>GitHub 仓库</b><span>owner/repo，默认 johngko/cloudpan</span></div>
        <input class="input" v-model="settings.update_repo" style="width: 300px" placeholder="johngko/cloudpan" />
      </div>
      <div class="ac-set-row">
        <div class="ac-set-lbl"><b>下载代理前缀</b><span>可选，如 https://ghproxy.com 或自建镜像；拼接在资产 URL 之前，留空 = 直连 GitHub</span></div>
        <input class="input" v-model="settings.update_proxy" style="width: 340px" placeholder="留空 = 直连" />
      </div>
    </template>
    <template v-else>
      <div class="ac-set-row">
        <div class="ac-set-lbl"><b>下载地址</b><span>二进制或 .tar.gz/.zip 包（包内需含 cloudpan 可执行文件）</span></div>
        <input class="input" v-model="settings.update_url" style="width: 420px" placeholder="https://example.com/cloudpan-linux-amd64" />
      </div>
      <div class="ac-set-row">
        <div class="ac-set-lbl"><b>版本号</b><span>可选，用于显示与「是否有更新」判断</span></div>
        <input class="input" v-model="settings.update_version" style="width: 200px" placeholder="如 1.2.0" />
      </div>
    </template>
    <div style="margin-top: 14px">
      <button class="btn" @click="saveUpdSource"><AppIcon name="check" :size="14" />保存来源配置</button>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">检查与更新</div>
    <div class="ac-set-row" style="align-items: flex-start">
      <div class="ac-set-lbl"><b>最新可用版本</b><span>点击「检查更新」查询</span></div>
      <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start">
        <div style="display: flex; gap: 8px; align-items: center">
          <button class="btn" :disabled="updChecking" @click="checkUpdate">{{ updChecking ? '检查中…' : '检查更新' }}</button>
          <button v-if="updInfo.hasUpdate" class="btn primary" :disabled="updBusy" @click="startUpdate">
            <AppIcon name="download" :size="14" />{{ updBusy ? '更新中…' : '下载并更新' }}
          </button>
          <span v-if="updInfo.checkedAt && !updInfo.hasUpdate && !updBusy" style="font-size: 12px; color: var(--success)">已是最新版本</span>
        </div>
        <div v-if="updInfo.latest" style="font-size: 12.5px; color: var(--text-2)">
          最新 <b>{{ updInfo.latest }}</b>（当前 {{ updInfo.current }}）
          <span v-if="updInfo.release?.size"> · {{ fmtBytes(updInfo.release.size) }}</span>
        </div>
        <div v-if="updInfo.release?.notes" class="upd-notes">{{ updInfo.release.notes.slice(0, 400) }}{{ updInfo.release.notes.length > 400 ? '…' : '' }}</div>
        <!-- 更新进度 -->
        <div v-if="updBusy" style="width: 340px">
          <div style="height: 8px; border-radius: 4px; background: rgba(127,127,127,.18); overflow: hidden">
            <div style="height: 100%; background: var(--theme-1, #3b91d8); transition: width 300ms"
              :style="{ width: (updStatus.status === 'replacing' ? 100 : updStatus.progress) + '%' }"></div>
          </div>
          <div style="font-size: 12px; color: var(--text-3); margin-top: 5px">
            {{ updMsgText }} · {{ fmtBytes(updStatus.received) }}{{ updStatus.total ? ' / ' + fmtBytes(updStatus.total) : '' }}
            <span v-if="updStatus.speed"> · {{ fmtRate(updStatus.speed) }}</span>
          </div>
        </div>
        <div v-if="updStatus.status === 'error'" style="font-size: 12.5px; color: var(--danger)">{{ updStatus.msg }}</div>
      </div>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">更新记录</div>
    <table v-if="updHistory.length" class="file-list" style="width: 100%; border-collapse: collapse; font-size: 12.5px">
      <tr v-for="h in updHistory" :key="h.id">
        <td style="padding: 7px 10px">{{ new Date(h.createdAt).toLocaleString() }}</td>
        <td style="padding: 7px 10px">{{ h.from || '?' }} → <b>{{ h.to }}</b></td>
        <td style="padding: 7px 10px">{{ h.status === 'success' ? '✅ 成功' : '❌ ' + (h.error || '失败') }}</td>
      </tr>
    </table>
    <div v-else style="font-size: 12.5px; color: var(--text-3); padding: 8px 2px">暂无更新记录</div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import {
  settings, updStatus, updInfo, updHistory, updChecking, updBusy, updMsgText, updMode,
  checkUpdate, startUpdate, saveUpdSource
} from './state'
import { fmtBytes, fmtRate } from './format'
</script>
