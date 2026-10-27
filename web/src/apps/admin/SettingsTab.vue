<template>
  <!-- 站点设置：基础 / 注册 / 登录 / ONLYOFFICE / 多 DS / WebDAV / 通知外发 / 转码 -->
  <h2 class="ac-h2">站点设置</h2>
  <div class="ac-card" style="padding: 20px 24px">
    <div class="ac-set-title">基础</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>站点名称</b><span>显示在登录页与开始菜单</span></div>
      <input class="input" v-model="settings.site_name" style="width: 260px" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>品牌 Logo</b><span>图片 URL（https 或站内路径，如 /uploads/brand.png）；登录页与分享页显示，留空不显示</span></div>
      <input class="input" v-model="settings.brand_logo" style="width: 360px" placeholder="https://…/logo.png" />
    </div>
    <div class="ac-set-row" style="flex-direction: column; align-items: flex-start; gap: 6px">
      <div class="ac-set-lbl"><b>公告</b><span>登录页展示，支持 Markdown（标题/加粗/链接/列表/图片等），留空则不显示</span></div>
      <textarea class="input" v-model="settings.announcement" rows="5" style="width: 100%; max-width: 560px; resize: vertical; line-height: 1.6"
        placeholder="支持 Markdown，例如：&#10;**系统升级通知**&#10;- 今晚 22:00 维护&#10;- 详情见 [公告](https://example.com)"></textarea>
    </div>
    <div class="ac-set-row" style="flex-direction: column; align-items: flex-start; gap: 6px">
      <div class="ac-set-lbl"><b>演示文档分享</b><span>填一个分享链接的 token（如 abc123），登录页显示「体验在线文档」入口；分享不存在或过期时自动隐藏。建议分享一个 Markdown 或 Office 演示文件</span></div>
      <input class="input" v-model="settings.demo_share" style="width: 300px" placeholder="分享 token，如 abc123；留空 = 不显示入口" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>站点主题</b><span>全局生效：游客/普通用户/管理员访问都渲染该主题（非管理员无设置入口）</span></div>
      <select class="input" v-model="settings.site_theme" style="width: 260px">
        <option value="win12">Windows 12 概念版</option>
        <option value="macos">macOS（Sonoma）</option>
        <option value="deepin">Deepin（DDE）</option>
      </select>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">注册</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>开放注册</b><span>关闭后只有管理员能创建账号</span></div>
      <label class="ac-switch"><input type="checkbox" :checked="settings.register_open === 'true'" @change="settings.register_open = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" /><span class="ac-slider"></span></label>
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>邀请码</b><span>开启注册时可要求邀请码（留空则不需要）</span></div>
      <input class="input" v-model="settings.register_invite_code" style="width: 260px" />
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">登录</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>游客登录</b><span>登录页提供「游客登录」，以共享游客账号（访客组，只读）进入；关闭后登录页不显示该入口</span></div>
      <label class="ac-switch"><input type="checkbox" :checked="settings.guest_login !== 'false'" @change="settings.guest_login = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" /><span class="ac-slider"></span></label>
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>独立应用模式</b><span>允许通过 #/app/&lt;应用ID&gt; 链接直接全屏打开单个应用（如 #/app/calculator），未登录时显示极简登录；关闭后访问显示拦截页</span></div>
      <label class="ac-switch"><input type="checkbox" :checked="settings.standalone_apps !== 'false'" @change="settings.standalone_apps = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" /><span class="ac-slider"></span></label>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">ONLYOFFICE 在线编辑</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>Document Server 地址</b><span>如 https://office.johngko.com，留空则用内置预览</span></div>
      <input class="input" v-model="settings.onlyoffice_url" style="width: 300px" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>公开地址</b><span>Document Server 回拉文件/回调用的本系统地址（须 DS 能访问，如 http://192.168.1.10:18322 或 https://pan.example.com）；留空按访客浏览器地址自动推导，也可用环境变量 CP_PUBLIC_URL 强制指定</span></div>
      <input class="input" v-model="settings.public_url" style="width: 300px" placeholder="留空 = 自动推导" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>JWT Secret</b><span>留空表示 Document Server 未启用 JWT（如 Cloudreve 部署）；启用 JWT 时须与 local.json 一致</span></div>
      <input class="input" v-model="settings.onlyoffice_jwt" style="width: 300px" placeholder="留空 = 免 JWT" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>连接测试</b><span>服务端探测 {{ settings.onlyoffice_url || '（未填地址）' }}/healthcheck；Document Server 必须能访问本系统地址（站点设置「公开地址」），否则编辑器无法回拉文件</span></div>
      <button class="tool-btn" :disabled="officeTesting" @click="testOffice">{{ officeTesting ? '探测中…' : '测试连接' }}</button>
      <span v-if="officeTestMsg" style="font-size: 12px; margin-left: 10px" :style="{ color: officeTestOk ? 'var(--accent)' : 'var(--danger)' }">{{ officeTestMsg }}</span>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">多 Document Server（健康检查 + 故障切换）</div>
    <div class="ac-set-row" style="font-size: 12px; color: var(--text-3)">
      列表非空时优先于上方单 DS 配置；编辑器自动选择「健康且优先级最高」的 DS，全部故障时回退第一台。每 60 秒自动探测 /healthcheck。
    </div>
    <div v-for="(d, i) in dsList" :key="i" class="ac-set-row" style="display: flex; gap: 8px; align-items: center">
      <input class="input" v-model="d.name" placeholder="名称" style="width: 110px" />
      <input class="input" v-model="d.url" placeholder="http://host:port" style="flex: 1" />
      <input class="input" v-model="d.jwt" placeholder="JWT（可空）" style="width: 130px" />
      <input class="input" v-model.number="d.priority" type="number" title="优先级（越小越优先）" style="width: 70px" />
      <span style="font-size: 11.5px; white-space: nowrap" :style="{ color: d._healthy ? 'var(--success)' : d._checked ? 'var(--danger)' : 'var(--text-3)' }">
        {{ d._healthy ? '● 健康' : d._checked ? '● 离线' : '○ 未检测' }}
        <b v-if="d._active" style="margin-left: 4px">（使用中）</b>
      </span>
      <button class="tool-btn" title="测试该地址" @click="testDsRow(d)">测试</button>
      <button class="tool-btn" title="移除" @click="dsList.splice(i, 1)">✕</button>
    </div>
    <div class="ac-set-row">
      <button class="btn" @click="dsList.push({ name: '', url: '', jwt: '', priority: dsList.length + 1 })">＋ 添加 DS</button>
      <button class="btn primary" :disabled="dsSaving" @click="saveDsList">{{ dsSaving ? '保存中…' : '保存 DS 列表' }}</button>
      <button class="btn" @click="loadDsList">刷新状态</button>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">WebDAV</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>启用 WebDAV</b><span>允许用户把网盘挂载进 Windows 资源管理器</span></div>
      <label class="ac-switch"><input type="checkbox" :checked="settings.webdav_enabled === 'true'" @change="settings.webdav_enabled = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" /><span class="ac-slider"></span></label>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">两步验证（TOTP）</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>全站强制两步验证</b><span>开启后：未绑定 TOTP 的用户被挡住全部写操作（仅可查看/下载），需先到「设置 → 账号」扫码绑定；管理员同样适用。已有恢复码兜底，不会永久锁死</span></div>
      <label class="ac-switch"><input type="checkbox" :checked="settings.totp_enforce === 'true'" @change="settings.totp_enforce = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" /><span class="ac-slider"></span></label>
    </div>
    <div class="ac-set-sep"></div>
    <div class="ac-set-title">通知外发</div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>Webhook 地址</b><span>通知产生时 POST JSON 到该地址（任务/配额/系统）；留空关闭</span></div>
      <input class="input" v-model="settings.notify_webhook_url" style="width: 340px" placeholder="https://example.com/hook" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>Webhook Token</b><span>可选，作为 Authorization 请求头发给接收端</span></div>
      <input class="input" v-model="settings.notify_webhook_token" style="width: 340px" placeholder="留空 = 不带" />
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>邮件通知</b><span>通过 SMTP 把通知发到固定邮箱</span></div>
      <label class="ac-switch"><input type="checkbox" :checked="settings.notify_email_enabled === 'true'" @change="settings.notify_email_enabled = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" /><span class="ac-slider"></span></label>
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>SMTP 服务器</b><span>主机与端口（支持 STARTTLS）</span></div>
      <div style="display: flex; gap: 8px">
        <input class="input" v-model="settings.notify_email_host" style="width: 220px" placeholder="smtp.example.com" />
        <input class="input" type="number" v-model="settings.notify_email_port" style="width: 90px" placeholder="465/587" />
      </div>
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>视频转码</b><span>浏览器播放不了的编码（HEVC 等）按需转码；auto=优先实测可用的硬件编码器，无 GPU 自动回落软编</span></div>
      <div style="display: flex; gap: 8px; align-items: center">
        <select class="input" v-model="settings.video_transcode" style="width: 200px">
          <option value="off">关闭（原盘直出）</option>
          <option value="auto">自动（优先硬件编码）</option>
          <option value="sw">强制软件编码</option>
        </select>
        <button class="mini-btn" @click="probeTranscode" :disabled="tcProbing">{{ tcProbing ? '检测中…' : '重新检测编码器' }}</button>
        <span v-if="tcInfo" style="font-size: 12px; color: var(--text-3)">{{ tcInfo }}</span>
      </div>
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>SMTP 账号</b><span>登录账号与密码（授权码）</span></div>
      <div style="display: flex; gap: 8px">
        <input class="input" v-model="settings.notify_email_user" style="width: 220px" placeholder="noreply@example.com" />
        <input class="input" type="password" v-model="settings.notify_email_pass" style="width: 150px" placeholder="密码/授权码" />
      </div>
    </div>
    <div class="ac-set-row">
      <div class="ac-set-lbl"><b>发件 / 收件人</b><span>收件人可用逗号分隔多个</span></div>
      <div style="display: flex; gap: 8px">
        <input class="input" v-model="settings.notify_email_from" style="width: 220px" placeholder="留空 = 同账号" />
        <input class="input" v-model="settings.notify_email_to" style="width: 220px" placeholder="admin@example.com" />
      </div>
    </div>
    <button class="btn primary" style="margin-top: 18px" @click="saveSettings"><AppIcon name="check" :size="15" />保存全部设置</button>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import {
  settings, dsList, dsSaving, officeTesting, officeTestMsg, officeTestOk,
  tcProbing, tcInfo, testOffice, saveSettings, testDsRow, saveDsList, loadDsList, probeTranscode
} from './state'
</script>
