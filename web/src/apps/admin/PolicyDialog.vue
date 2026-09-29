<template>
  <!-- 挂载 / 编辑存储（本地目录 / 各云盘 + 扫码授权） -->
  <div class="dialog-mask" v-if="policyShow" @click.self="closePolicy">
    <div class="dialog" style="width: 480px">
      <h3>{{ editPolicy.id ? '编辑' : '挂载' }}存储</h3>
      <div class="row">
        <label>类型</label>
        <select class="input" v-model="editPolicy.type" style="width: 100%">
          <option value="local">本地磁盘目录</option>
          <option value="pan123">123云盘（官方开放平台）</option>
          <option value="aliyun">阿里云盘（开放平台）</option>
          <option value="baidu">百度网盘（官方 API，默认只读）</option>
          <option v-if="editPolicy.type === 'tianyi'" value="tianyi" disabled>天翼云盘（实验性·暂不可用）</option>
        </select>
      </div>
      <div class="row"><label>显示名称</label><input class="input" v-model="editPolicy.name" placeholder="如：我的阿里云盘" style="width: 100%" /></div>
      <div class="row"><label>虚拟盘符</label><input class="input" v-model="editPolicy.letter" placeholder="C / D / X / 阿里 ..." style="width: 100%" /></div>
      <div class="row" v-if="editPolicy.type === 'local'">
        <label>服务器上的物理目录</label>
        <input class="input" v-model="editPolicy.rootPath" placeholder="如 E:\cloudpan\storage" style="width: 100%" />
      </div>
      <div class="row" v-if="editPolicy.type === 'local'">
        <label>分区大小（GB）</label>
        <input class="input" v-model.number="editPolicy.quotaGB" type="number" min="0" step="1"
          placeholder="留空 = 自动（根目录所在分区的真实大小）" style="width: 100%" />
        <div class="ac-guide" style="margin-top: 4px">管理员视角的分区总容量：留空取磁盘真实大小；填写则按此标称值显示「已用 / 总 / 剩余」（如整盘 5TB 中划 500GB 给此盘）</div>
      </div>
      <template v-if="editPolicy.type === 'pan123'">
        <div class="row"><label>ClientID（123 开放平台）</label><input class="input" v-model="pOpts.client_id" style="width: 100%" /></div>
        <div class="row"><label>ClientSecret</label><input class="input" v-model="pOpts.client_secret" style="width: 100%" /></div>
      </template>
      <template v-else-if="editPolicy.type === 'aliyun'">
        <div class="row"><label>ClientID（开放平台应用 ID）</label><input class="input" v-model="pOpts.client_id" style="width: 100%" /></div>
        <div class="row"><label>ClientSecret</label><input class="input" v-model="pOpts.client_secret" style="width: 100%" /></div>
        <div class="row">
          <label>refresh_token</label>
          <div style="display: flex; gap: 8px"><input class="input" v-model="pOpts.refresh_token" placeholder="扫码授权后自动填入，也可手动粘贴" style="flex: 1" /><button class="btn" @click="startAuth()">扫码授权</button></div>
        </div>
      </template>
      <template v-else-if="editPolicy.type === 'baidu'">
        <div class="row"><label>AppKey</label><input class="input" v-model="pOpts.client_id" style="width: 100%" /></div>
        <div class="row"><label>SecretKey</label><input class="input" v-model="pOpts.client_secret" style="width: 100%" /></div>
        <div class="row">
          <label>access_token</label>
          <div style="display: flex; gap: 8px"><input class="input" v-model="pOpts.access_token" placeholder="扫码授权后自动填入，也可手动粘贴" style="flex: 1" /><button class="btn" @click="startAuth()">扫码授权</button></div>
        </div>
      </template>
      <template v-else-if="editPolicy.type === 'tianyi'">
        <div class="row"><label>网页版 Cookie（实验性）</label><input class="input" v-model="pOpts.cookie" style="width: 100%" /></div>
      </template>
      <!-- 扫码授权面板：二维码 = 厂商授权页地址（带签名 state），手机扫码→授权→厂商重定向回 /api/cloud/callback 自动完成 -->
      <div v-if="qrImg" class="qr-panel">
        <img :src="qrImg" alt="授权二维码" />
        <div class="qr-actions">
          <a :href="qrUrl" target="_blank" rel="noopener">手机不便？点此在电脑浏览器打开授权页</a>
          <button class="btn" style="padding: 2px 10px" @click="stopQr">取消</button>
        </div>
        <div class="qr-actions" style="justify-content: center">
          <a href="#" @click.prevent="startAuth(true)">手机无法访问本站？改用「粘贴授权码」模式</a>
        </div>
      </div>
      <div v-if="authMsg" style="font-size: 12px; color: var(--theme-2); margin-bottom: 10px; word-break: break-all">{{ authMsg }}</div>
      <div class="ac-guide">
        <template v-if="editPolicy.type === 'pan123'">
          <b>123云盘开通步骤：</b>
          ① 访问 <a href="https://www.123pan.com/developer" target="_blank">123 开放平台</a> 注册开发者
          ② 创建应用获取 ClientID / ClientSecret 填入上方
          ③ 挂载后点「测通」验证连通
        </template>
        <template v-else-if="editPolicy.type === 'aliyun'">
          <b>阿里云盘挂载教程：</b>
          ① 前往 <a href="https://open.alipan.com" target="_blank">阿里云盘开放平台</a> 注册开发者并创建应用，获得 ClientID / ClientSecret 填入上方
          ② 确认「站点设置 → 公开地址」为手机可访问的地址（纯内网部署填内网地址即可，手机需与服务器同网段）
          ③ 点「扫码授权」→ 用阿里云盘 App / 手机浏览器扫二维码 → 登录并确认授权 → 手机显示绑定成功，本页 token 自动填入
          ④ 保存后点列表「测通」验证连通
        </template>
        <template v-else-if="editPolicy.type === 'baidu'">
          <b>百度网盘挂载教程：</b>
          ① 前往 <a href="https://console.bce.baidu.com" target="_blank">百度智能云控制台</a>（开放平台）创建应用，获得 AppKey / SecretKey 填入上方
          ② 在应用的「回调地址」里登记 <code>本站公开地址 + /api/cloud/callback</code>（与站点设置一致，百度要求回调地址预先登记）
          ③ 点「扫码授权」→ 手机扫码登录百度账号并确认授权 → 绑定成功自动回填
          ④ 上传/写操作需申请接口白名单，未获批前为只读挂载（查看/下载不受限）
        </template>
        <template v-else-if="editPolicy.type === 'tianyi'">
          <b>天翼云盘（实验性·暂不可用）：</b>
          接口仍处于联调阶段（当前所有操作都会返回“接口联调中”），新建策略已不再提供该类型。
          此策略为历史遗留，仅保留配置信息；如需使用请先改用其他存储类型。
        </template>
      </div>
      <div class="actions">
        <button class="btn" @click="closePolicy">取消</button>
        <button class="btn primary" @click="createPolicy">{{ editPolicy.id ? '保存' : '挂载' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { policyShow, editPolicy, pOpts, authMsg, qrImg, qrUrl, startAuth, stopQr, closePolicy, createPolicy } from './state'
</script>
