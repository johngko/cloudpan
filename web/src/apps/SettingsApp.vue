<template>
  <div class="app-root">
    <div style="display: flex; flex: 1; overflow: hidden">
      <div style="width: 220px; flex: none; border-right: 1px solid var(--stroke); padding: 14px 8px">
        <div v-for="t in tabs" :key="t.id" class="side-item" :class="{ active: tab === t.id }" @click="tab = t.id">
          <AppIcon :name="t.icon" :size="17" /><span>{{ t.name }}</span>
        </div>
      </div>
      <div style="flex: 1; overflow: auto; padding: 26px 34px">
        <!-- 个性化 -->
        <template v-if="tab === 'person'">
          <h2 style="font-size: 19px; margin-bottom: 20px">个性化</h2>
          <div style="font-size: 13px; color: var(--text-2); margin-bottom: 10px">站点主题（管理员设置，对全体用户生效——游客与普通用户访问都看到该主题，且无此设置入口）</div>
          <div style="display: flex; gap: 12px; margin-bottom: 22px">
            <div v-for="t in themes" :key="t.id"
              style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: var(--radius); border: 1.5px solid var(--stroke); background: var(--card)"
              :style="session.osTheme === t.id ? { borderColor: 'var(--theme-2)', background: 'var(--hover-b)' } : {}"
              @click="session.setOsTheme(t.id)">
              <AppIcon :name="t.icon" :size="34" />
              <div>
                <div style="font-size: 14px; font-weight: 600">{{ t.name }}</div>
                <div style="font-size: 11.5px; color: var(--text-3)">{{ session.osTheme === t.id ? '当前使用' : '点击切换' }}</div>
              </div>
              <AppIcon v-if="session.osTheme === t.id" name="check" :size="16" style="color: var(--theme-2)" />
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 22px">
            <span style="font-size: 13px; color: var(--text-2)">深色模式</span>
            <button class="btn" @click="session.setDark(!session.dark)">{{ session.dark ? '开' : '关' }}</button>
          </div>
          <div style="font-size: 13px; color: var(--text-2); margin-bottom: 10px">选择壁纸（{{ theme.name }}）</div>
          <div style="display: flex; flex-wrap: wrap; gap: 12px; overflow: hidden">
            <div v-for="w in theme.wallpapers" :key="w.key" style="cursor: pointer" @click="session.setWallpaper(w.key)">
              <div class="wp-thumb" :class="wallpaperClass(w.key)" :style="{ outline: session.wallpaper === w.key ? '2px solid var(--theme-2)' : 'none' }"></div>
              <div style="font-size: 12px; color: var(--text-2); text-align: center; margin-top: 5px">{{ w.name }}</div>
            </div>
          </div>
        </template>

        <!-- 外观：布局偏好（所有用户可用；也是手机布局的"逃生口"——自动判断不合适时可强制关闭） -->
        <template v-else-if="tab === 'display'">
          <h2 style="font-size: 19px; margin-bottom: 20px">外观</h2>
          <div style="font-size: 13px; color: var(--text-2); margin-bottom: 10px">
            界面布局。窄屏（手机）会自动切换为手机布局：应用窗口铺满屏幕、触屏单击即打开文件。
            若自动判定不合适（平板、触屏笔记本等），可在此强制指定。
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; max-width: 560px">
            <div v-for="m in layoutModes" :key="m.id"
              style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--radius); border: 1.5px solid var(--stroke); background: var(--card)"
              :style="viewport.override === m.id ? { borderColor: 'var(--theme-2)', background: 'var(--hover-b)' } : {}"
              @click="viewport.setOverride(m.id)">
              <div style="flex: 1">
                <div style="font-size: 14px; font-weight: 600">{{ m.name }}</div>
                <div style="font-size: 11.5px; color: var(--text-3); margin-top: 2px">{{ m.desc }}</div>
              </div>
              <AppIcon v-if="viewport.override === m.id" name="check" :size="16" style="color: var(--theme-2)" />
            </div>
          </div>
          <div style="font-size: 12px; color: var(--text-3); margin-top: 12px">
            屏幕宽度：{{ viewport.narrow ? '≤ 640px（窄屏）' : '> 640px（宽屏）' }}；
            当前生效：<b>{{ viewport.mobile ? '手机布局' : '桌面布局' }}</b>
          </div>
          <div style="font-size: 13px; color: var(--text-2); margin: 24px 0 10px">
            深色模式。跟随系统时，界面深浅随操作系统的深浅色设置实时切换（Windows/macOS/Android/iOS 的深色时间表或手动切换都会生效）。
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; max-width: 560px">
            <div v-for="m in darkModes" :key="m.id"
              style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--radius); border: 1.5px solid var(--stroke); background: var(--card)"
              :style="session.darkMode === m.id ? { borderColor: 'var(--theme-2)', background: 'var(--hover-b)' } : {}"
              @click="session.setDarkMode(m.id)">
              <div style="flex: 1">
                <div style="font-size: 14px; font-weight: 600">{{ m.name }}</div>
                <div style="font-size: 11.5px; color: var(--text-3); margin-top: 2px">{{ m.desc }}</div>
              </div>
              <AppIcon v-if="session.darkMode === m.id" name="check" :size="16" style="color: var(--theme-2)" />
            </div>
          </div>
        </template>

        <!-- 账号 -->
        <template v-else-if="tab === 'account'">
          <h2 style="font-size: 19px; margin-bottom: 20px">账号信息</h2>
          <div style="display: flex; align-items: center; gap: 18px; margin-bottom: 24px">
            <div class="avatar" style="width: 72px; height: 72px; font-size: 30px">{{ initial }}</div>
            <div>
              <div style="font-size: 17px">{{ session.user?.nickname }}</div>
              <div style="font-size: 12.5px; color: var(--text-3)">@{{ session.user?.username }} · {{ session.group?.name }}</div>
              <div style="font-size: 12.5px; color: var(--text-3)">
                已用 {{ fmt(session.user?.usedBytes || 0) }} / {{ session.group?.quotaMB && session.group.quotaMB > 0 ? session.group.quotaMB + ' MB' : '不限量' }}
              </div>
            </div>
          </div>
          <!-- 游客为 24 小时临时工作区身份（全体访客共用一个账号），不提供昵称/密码/WebDAV 自管理入口 -->
          <div v-if="session.isGuest" class="form-row">
            <label>临时空间说明</label>
            <div style="font-size: 13px; color: var(--text-3); max-width: 560px; line-height: 1.7">
              当前为游客临时空间身份：所有访客共用同一账号，可以上传文件、离线下载、在线编辑与预览
              Office / PDF / 图片；文件会在 24 小时后自动清除，请及时下载重要内容。
              账号管理（修改昵称/密码等）不适用，如需长期保存请使用账号登录。
            </div>
          </div>
          <template v-else>
            <div class="form-row">
              <label>昵称</label>
              <input class="input" v-model="nickname" style="width: 260px" />
              <button class="btn" @click="saveProfile">保存</button>
            </div>
            <div class="form-row" style="margin-top: 22px">
              <label>修改密码</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <input class="input" type="password" v-model="oldPwd" placeholder="原密码" style="width: 180px" />
                <input class="input" type="password" v-model="newPwd" placeholder="新密码（至少6位）" style="width: 180px" />
                <button class="btn" @click="doChangePwd">修改密码</button>
              </div>
            </div>
            <div class="form-row" style="margin-top: 22px">
              <label>WebDAV 独立密码（用于挂载到 Windows 资源管理器）</label>
              <div style="display: flex; gap: 8px">
                <input class="input" v-model="davPwd" placeholder="设置/重置 WebDAV 密码" style="width: 260px" />
                <button class="btn" @click="doDavPwd">保存</button>
              </div>
              <div v-if="session.group && session.group.allowWebdav" style="font-size: 12px; color: var(--text-3); margin-top: 6px">
                挂载地址：http://你的服务器地址/dav/{{ session.user?.username }}
              </div>
              <div v-else style="font-size: 12px; color: var(--text-3); margin-top: 6px">当前用户组未启用 WebDAV</div>
            </div>
            <div class="form-row" style="margin-top: 22px">
              <label>API 令牌（第三方工具/脚本的独立凭据）</label>
              <div style="font-size: 12px; color: var(--text-3); max-width: 620px; line-height: 1.7; margin-bottom: 10px">
                用于 rclone、CLI、自动化脚本等第三方访问，支持 <code>Authorization: Bearer 令牌</code> 请求头与 <code>?t=令牌</code> 参数；
                只读令牌会拒绝一切写操作。令牌可单独撤销、可设有效期；明文仅在创建时显示一次，丢失只能撤销重建。
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
                <input class="input" v-model="tokName" placeholder="令牌名称（如 rclone）" style="width: 170px" />
                <select class="input" v-model="tokScope">
                  <option value="rw">读写</option>
                  <option value="ro">只读</option>
                </select>
                <select class="input" v-model="tokExpire">
                  <option :value="0">永久有效</option>
                  <option :value="30">30 天</option>
                  <option :value="90">90 天</option>
                  <option :value="365">1 年</option>
                </select>
                <button class="btn" @click="createToken">创建令牌</button>
              </div>
              <div v-if="newToken" style="margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--accent-weak); font-size: 13px; max-width: 620px">
                ⚠️ 请立即保存令牌，此后不再显示：<br />
                <code style="word-break: break-all">{{ newToken }}</code>
                <button class="btn" style="margin-left: 8px" @click="copyText(newToken); toast.success('已复制')">复制</button>
              </div>
              <table class="file-list" style="position: static; margin-top: 12px; max-width: 720px">
                <thead><tr><th>名称</th><th>权限</th><th>令牌</th><th>到期</th><th>最近使用</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="t in tokens" :key="t.id">
                    <td>{{ t.name }}</td>
                    <td>{{ t.scopes === 'ro' ? '只读' : '读写' }}</td>
                    <td><code>{{ t.prefix }}</code></td>
                    <td>{{ t.expiresAt ? String(t.expiresAt).slice(0, 10) : '永久' }}</td>
                    <td>{{ t.lastUsedAt ? String(t.lastUsedAt).slice(0, 16).replace('T', ' ') : '从未使用' }}</td>
                    <td><button class="btn" @click="removeToken(t)">撤销</button></td>
                  </tr>
                  <tr v-if="!tokens.length"><td colspan="6" style="color: var(--text-3)">暂无令牌</td></tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <!-- 共享管理 -->
        <template v-else-if="tab === 'shares'">
          <h2 style="font-size: 19px; margin-bottom: 20px">我的分享</h2>
          <div class="ac-sub">外链分享</div>
          <table class="file-list" style="position: static">
            <thead><tr><th>名称</th><th>提取码</th><th>浏览/下载</th><th>到期</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="s in shares" :key="s.id">
                <td>{{ s.name }}</td>
                <td>{{ s.hasPassword ? '有密码' : '公开' }}</td>
                <td>{{ s.views }} / {{ s.downloads }}</td>
                <td>{{ s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : '永久' }}</td>
                <td>
                  <button class="tool-btn" style="padding: 3px 8px" @click="copyShare(s)">复制链接</button>
                  <button class="tool-btn danger" style="padding: 3px 8px" @click="cancelShare(s)">取消</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!shares.length" style="color: var(--text-3); padding: 16px; text-align: center">暂无外链分享</div>
          <div class="ac-sub" style="margin-top: 24px">共享给用户</div>
          <table class="file-list" style="position: static">
            <thead><tr><th>目录</th><th>共享给</th><th>权限</th><th>时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="s in userShares" :key="s.id">
                <td>{{ s.name }}</td>
                <td>{{ s.owner }}（{{ s.ownerName }}）</td>
                <td><span class="tag" :class="{ admin: s.perm === 'rw' }">{{ s.perm === 'rw' ? '可写' : '只读' }}</span></td>
                <td>{{ new Date(s.createdAt).toLocaleDateString() }}</td>
                <td><button class="tool-btn danger" style="padding: 3px 8px" @click="cancelUserShare(s)">取消共享</button></td>
              </tr>
            </tbody>
          </table>
          <div v-if="!userShares.length" style="color: var(--text-3); padding: 16px; text-align: center">在资源管理器中右键文件夹 →「共享给用户」即可创建</div>
        </template>

        <!-- 上传设置 -->
        <template v-else-if="tab === 'upload'">
          <h2 style="font-size: 19px; margin-bottom: 20px">上传设置</h2>
          <div class="form-row" style="margin-bottom: 22px">
            <label>上传并发</label>
            <select class="input" v-model.number="upConc" style="width: 180px" @change="saveUploadSettings">
              <option v-for="n in CONC_MAX" :key="n" :value="n">{{ n }} 个文件同时上传</option>
            </select>
            <div style="font-size: 11.5px; color: var(--text-3); margin-top: 6px">
              同时上传的文件数。网络与磁盘余量充足时调高可提升批量大文件速度；受限（内存小/带宽窄）时调低
            </div>
          </div>
          <div class="form-row">
            <label>分片大小</label>
            <select class="input" v-model.number="upChunk" style="width: 180px" @change="saveUploadSettings">
              <option v-for="mb in CHUNK_OPTIONS" :key="mb" :value="mb">{{ mb }} MB</option>
            </select>
            <div style="font-size: 11.5px; color: var(--text-3); margin-top: 6px">
              较大分片 = 请求次数少（高延迟/远程服务器更快）；较小分片 = 单片失败重传代价低。
              对新建的上传任务生效，进行中的任务保持原分片
            </div>
          </div>
          <div v-if="upSaved" style="font-size: 12px; color: var(--success); margin-top: 14px">已保存</div>
        </template>

        <!-- 离线下载 -->
        <template v-else-if="tab === 'offline'">
          <h2 style="font-size: 19px; margin-bottom: 20px">离线下载</h2>
          <div style="display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap">
            <select class="input" v-model.number="offPolicyId" style="width: 150px">
              <option v-for="p in policies" :key="p.id" :value="p.id">{{ p.name }} ({{ p.letter }})</option>
            </select>
            <input class="input" v-model="offUrl" placeholder="支持 HTTP 直链 / 磁力链(magnet:) / .torrent 种子" style="flex: 1; min-width: 260px" />
            <input class="input" v-model="offName" placeholder="文件名(可选)" style="width: 150px" />
            <select class="input" v-model="offDest" style="width: 130px">
              <option value="/">根目录</option>
              <option v-for="s in stars" :key="s.id" :value="s.path">{{ s.name }}</option>
            </select>
            <button class="btn primary" @click="addOffline" :disabled="!offUrl">添加任务</button>
          </div>
          <div style="font-size: 11.5px; color: var(--text-3); margin-top: 8px">
            磁力链/.torrent 由内置 BT 引擎（DHT+Tracker）下载，完成后自动导入所选磁盘；HTTP 链接为服务器代下载。
          </div>
          <table class="file-list" style="position: static">
            <thead><tr><th>文件</th><th>状态</th><th>进度</th><th>时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="t in offTasks" :key="t.id">
                <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis">{{ taskName(t) }}</td>
                <td><span class="tag" :style="t.status === 'error' ? 'color:var(--danger)' : ''">{{ taskStatus(t.status) }}</span></td>
                <td style="width: 160px">
                  <div class="progress-track"><div class="progress-fill" :style="{ width: t.progress + '%' }"></div></div>
                </td>
                <td style="color: var(--text-3)">{{ new Date(t.createdAt).toLocaleTimeString() }}</td>
                <td><button v-if="t.status === 'queued' || t.status === 'processing'" class="tool-btn danger" style="padding: 3px 8px" @click="cancelOffline(t)">取消</button></td>
              </tr>
            </tbody>
          </table>
          <div v-if="!offTasks.length" style="color: var(--text-3); padding: 30px; text-align: center">暂无离线任务</div>
        </template>

        <!-- B16 文件事件 Webhook -->
        <template v-else-if="tab === 'webhook'">
          <h2 style="font-size: 19px; margin-bottom: 6px">文件事件 Webhook</h2>
          <div style="font-size: 12.5px; color: var(--text-3); margin-bottom: 14px">
            文件创建/改名/删除/分享等变更实时 POST 到你的自动化服务（n8n、HomeAssistant、自建接收端）。
            请求带 <code>X-CloudPan-Event</code> 与可选 <code>X-CloudPan-Signature: sha256=HMAC(secret)</code>；
            失败自动重试（5 次退避），投递记录保留 7 天。默认禁止内网目标，服务端设
            <code>CP_WEBHOOK_ALLOW_PRIVATE=1</code> 可放开（同局域网 HA/n8n 场景）。
          </div>
          <table class="file-list" style="position: static; max-width: 860px">
            <thead><tr><th>名称</th><th>URL</th><th>事件</th><th>路径过滤</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="h in hooks" :key="h.id">
                <td>{{ h.name }}<span v-if="h.userId === 0" style="color:var(--warn)"> · 全局</span></td>
                <td style="font-size:12px">{{ h.url }}</td>
                <td style="font-size:12px">{{ h.events ? JSON.parse(h.events).length + ' 项' : '全部' }}</td>
                <td style="font-size:12px">{{ h.pathRegex || '—' }}</td>
                <td>
                  <label style="cursor:pointer"><input type="checkbox" :checked="h.enabled" @change="toggleHook(h)" /> 启用</label>
                </td>
                <td style="white-space:nowrap">
                  <button class="btn" @click="testHook(h)">测试</button>
                  <button class="btn" @click="removeHook(h)">删除</button>
                </td>
              </tr>
              <tr v-if="!hooks.length"><td colspan="6" style="color: var(--text-3)">暂无钩子，用下方表单创建一个</td></tr>
            </tbody>
          </table>
          <div style="margin-top: 18px; padding: 14px 16px; border: 1px solid var(--stroke); border-radius: 10px; max-width: 860px">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px">新建钩子</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px">
              <input class="input" v-model="whForm.name" placeholder="名称" style="width:150px" />
              <input class="input" v-model="whForm.url" placeholder="https://n8n.example.com/webhook/xxx" style="flex:1;min-width:280px" />
              <input class="input" v-model="whForm.secret" placeholder="签名密钥（可选）" style="width:180px" />
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px">
              <input class="input" v-model="whForm.pathRegex" placeholder="路径正则过滤，如 \.docx$（留空 = 不过滤）" style="flex:1;min-width:280px" />
              <label v-if="isAdmin" style="font-size:12.5px;display:flex;align-items:center;gap:4px"><input type="checkbox" v-model="whForm.global" /> 全局钩子（对所有用户生效）</label>
            </div>
            <div style="display: flex; gap: 10px 14px; flex-wrap: wrap; font-size: 12.5px; margin-bottom: 10px">
              <label v-for="e in whEvents" :key="e" style="display:flex;align-items:center;gap:4px;cursor:pointer">
                <input type="checkbox" :checked="whForm.events.includes(e)" @change="toggleEv(e)" /> {{ e }}
              </label>
              <span v-if="!whForm.events.length" style="color:var(--text-3)">（不勾 = 订阅全部事件）</span>
            </div>
            <button class="btn primary" :disabled="whBusy" @click="createHook">创建</button>
          </div>
          <div style="font-size: 13px; font-weight: 600; margin: 18px 0 8px">最近投递</div>
          <table class="file-list" style="position: static; max-width: 860px">
            <thead><tr><th>时间</th><th>钩子</th><th>状态</th><th>次数</th><th>错误</th></tr></thead>
            <tbody>
              <tr v-for="d in whDeliveries" :key="d.id">
                <td>{{ String(d.createdAt).slice(0, 19).replace('T', ' ') }}</td>
                <td>#{{ d.hookId }}</td>
                <td :style="d.status === 'failed' ? 'color:var(--danger)' : d.status === 'pending' ? 'color:var(--warn)' : ''">{{ d.status }}</td>
                <td>{{ d.attempts }}</td>
                <td style="font-size:12px">{{ d.lastError || '' }}</td>
              </tr>
              <tr v-if="!whDeliveries.length"><td colspan="5" style="color: var(--text-3)">暂无投递记录</td></tr>
            </tbody>
          </table>
        </template>

        <!-- 我的操作记录 -->
        <template v-else-if="tab === 'logs'">
          <h2 style="font-size: 19px; margin-bottom: 6px">操作记录</h2>
          <div style="font-size: 12.5px; color: var(--text-3); margin-bottom: 16px">仅显示你自己的操作（文件写入、分享、登录等），管理员可查全量记录。</div>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 14px">
            <input class="input" v-model="logKeyword" placeholder="搜索操作或详情" style="width: 260px" @keyup.enter="loadLogs(1)" />
            <button class="btn" @click="loadLogs(1)">搜索</button>
          </div>
          <div v-if="logLoading" style="font-size: 13px; color: var(--text-3)">加载中…</div>
          <div v-else-if="!logItems.length" style="font-size: 13px; color: var(--text-3)">暂无操作记录</div>
          <template v-else>
            <div v-for="l in logItems" :key="l.id" style="padding: 10px 12px; border-bottom: 1px solid var(--stroke-b); font-size: 12.5px">
              <div style="display: flex; justify-content: space-between; gap: 12px">
                <span style="font-weight: 600">{{ l.action }}</span>
                <span style="color: var(--text-3); flex: none">{{ new Date(l.createdAt).toLocaleString() }}</span>
              </div>
              <div v-if="l.detail" style="color: var(--text-2); margin-top: 3px; word-break: break-all">{{ l.detail }}</div>
              <div v-if="l.ip" style="color: var(--text-3); margin-top: 2px">IP {{ l.ip }}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 16px">
              <button class="btn" :disabled="logPage <= 1 || logLoading" @click="loadLogs(logPage - 1)">上一页</button>
              <span style="font-size: 12.5px; color: var(--text-3)">第 {{ logPage }} 页 · 共 {{ logTotal }} 条</span>
              <button class="btn" :disabled="logPage * LOG_PAGE_SIZE >= logTotal || logLoading" @click="loadLogs(logPage + 1)">下一页</button>
            </div>
          </template>
        </template>
        <!-- 关于 -->
        <template v-else>
          <h2 style="font-size: 19px; margin-bottom: 20px">关于</h2>
          <div style="display: flex; align-items: center; gap: 16px">
            <AppIcon name="windows" :size="52" />
            <div>
              <div style="font-size: 18px; font-weight: 600">CloudPan 网盘</div>
              <div style="font-size: 12.5px; color: var(--text-3)">Go + Vue 仿 Windows12 桌面网盘系统 · v1.0.0</div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useSession } from '../stores/session'
import { canUseOffline } from '../stores/apps'
import { useTransfer, CHUNK_MB_OPTIONS, CONCURRENCY_MAX } from '../stores/transfer'
import { wallpaperClass } from '../assets/wallpapers'
import { availableThemes, resolveTheme } from '../themes/registry'
import { fsApi, shareApi, authApi, userShareApi, auditApi, tokenApi, type AuditItem, type ApiTokenItem, webhookApi } from '../api/modules'
import { get as aget, post as apost, del as adel } from '../api/http'
import { useToast, useUiDialog } from '../stores/dialog'
import { copyText } from '../utils/clipboard'
import AppIcon from '../components/AppIcon.vue'
import { useViewport } from '../stores/viewport'

const toast = useToast()
const uiDlg = useUiDialog()

const session = useSession()
// 主题
const themes = availableThemes()
const theme = computed(() => resolveTheme(session.osTheme))
// 离线下载
const policies = ref<any[]>([])
const stars = ref<any[]>([])
const offTasks = ref<any[]>([])
const offUrl = ref(''); const offName = ref(''); const offDest = ref('/')
const offPolicyId = ref(0)
let pollTimer = 0

function taskName(t: any) {
  try { const p = JSON.parse(t.props); return p.name || p.url } catch { return t.props }
}
function taskStatus(s: string) {
  return ({ queued: '排队中', processing: '下载中', finished: '完成', error: '失败', canceled: '已取消' } as any)[s] || s
}
async function loadOffline() {
  try {
    policies.value = await fsApi.policies()
    stars.value = await fsApi.starList()
    offTasks.value = await aget('/offline')
    if (!offPolicyId.value && policies.value.length) offPolicyId.value = policies.value[0].id
  } catch {}
}
async function addOffline() {
  try {
    await apost('/offline', { policyId: offPolicyId.value, dest: offDest.value, url: offUrl.value, name: offName.value || undefined })
    offUrl.value = ''; offName.value = ''
    loadOffline()
  } catch (e: any) { toast.error(e.message) }
}
async function cancelOffline(t: any) {
  try { await adel(`/offline/${t.id}`); loadOffline() } catch (e: any) { alert(e.message) }
}
// 个性化（站点主题/壁纸/深色）为管理员全局设置：仅管理员可见此 tab，
// 游客与普通用户从所有入口都看不到主题个性化功能
const isAdmin = computed(() => session.user?.role === 'admin')
// 离线下载页签：无权限用户（如游客）整体不显示，与后端 403 语义一致
const canOffline = computed(() => canUseOffline())
const viewport = useViewport()
/** 布局偏好三选一（值与 utils/mobile 的 MobileOverride 一致） */
const layoutModes = [
  { id: 'auto', name: '跟随屏幕宽度', desc: '窄屏自动用手机布局，宽屏用桌面布局（推荐）' },
  { id: 'on', name: '始终使用手机布局', desc: '窗口铺满屏幕、触屏交互；适合手机与小平板' },
  { id: 'off', name: '始终使用桌面布局', desc: '保留浮动窗口与桌面图标双击；适合宽屏' }
] as const
/** 深色模式偏好三选一（本机偏好，存 localStorage，不影响其他用户） */
const darkModes = [
  { id: 'auto', name: '跟随系统', desc: '随操作系统的深浅色设置实时切换（推荐）' },
  { id: 'light', name: '浅色', desc: '始终使用浅色界面' },
  { id: 'dark', name: '深色', desc: '始终使用深色界面' }
] as const

const tabs = computed(() => [
  ...(isAdmin.value ? [{ id: 'person', name: '个性化', icon: 'sun' }] : []),
  { id: 'display', name: '外观', icon: 'grid' },
  { id: 'account', name: '账号', icon: 'user' },
  { id: 'shares', name: '我的分享', icon: 'share' },
  { id: 'upload', name: '上传', icon: 'upload' },
  ...(canOffline.value ? [{ id: 'offline', name: '离线下载', icon: 'download' }] : []),
  { id: 'webhook', name: 'Webhook', icon: 'share' },
  { id: 'logs', name: '操作记录', icon: 'list' },
  { id: 'about', name: '关于', icon: 'info' }
])
const winProps = defineProps<{ winId: number; props: any }>()
const tab = ref('person')
// 当前 tab 不可见时（非管理员无个性化 / 角色异步到位）回落到第一个可见 tab
watch([tabs, () => session.user?.role], () => {
  if (!tabs.value.some(t => t.id === tab.value)) tab.value = tabs.value[0]?.id || 'account'
}, { immediate: true })
// 深链：搜索面板「设置」分类 / 其他入口带 { tab } 打开时直接跳到对应页（仍受可见性约束）
watch(() => winProps.props?.tab, v => { if (v && tabs.value.some(t => t.id === v)) tab.value = v }, { immediate: true })
const nickname = ref(session.user?.nickname || '')
const oldPwd = ref(''); const newPwd = ref(''); const davPwd = ref('')
const shares = ref<any[]>([])

// API 令牌管理（懒加载：切到账号页签才请求）
const tokens = ref<ApiTokenItem[]>([])
const tokName = ref(''); const tokScope = ref<'rw' | 'ro'>('rw'); const tokExpire = ref(0)
const newToken = ref('')
async function loadTokens() {
  try { tokens.value = await tokenApi.list() } catch { tokens.value = [] }
}
async function createToken() {
  if (!tokName.value.trim()) { toast.error('请填写令牌名称'); return }
  try {
    const r = await tokenApi.create(tokName.value.trim(), tokScope.value, Number(tokExpire.value))
    newToken.value = r.token
    tokName.value = ''
    await loadTokens()
  } catch (e: any) { toast.error(e?.message || '创建失败') }
}
async function removeToken(t: ApiTokenItem) {
  if (!await uiDlg.confirm('撤销令牌', `撤销「${t.name}」后使用该令牌的第三方工具将立即无法访问，确定？`, { danger: true, okText: '撤销' })) return
  try {
    await tokenApi.remove(t.id)
    if (newToken.value) newToken.value = ''
    await loadTokens()
  } catch (e: any) { toast.error(e?.message || '撤销失败') }
}
watch(tab, v => { if (v === 'account' && !session.isGuest) loadTokens() }, { immediate: true })

// ---- B16 Webhook tab ----
const hooks = ref<any[]>([])
const whEvents = ref<string[]>([])
const whDeliveries = ref<any[]>([])
const whBusy = ref(false)
const whForm = ref<{ name: string; url: string; secret: string; pathRegex: string; events: string[]; global: boolean }>(
  { name: '', url: '', secret: '', pathRegex: '', events: [], global: false })
async function loadHooks() {
  try {
    const mine = await webhookApi.list()
    let all = mine
    if (session.user?.role === 'admin') {
      try { all = [...(await webhookApi.list('global')), ...mine] } catch { /* 保留自己的 */ }
    }
    hooks.value = all
    whDeliveries.value = await webhookApi.deliveries()
  } catch { /* ignore */ }
}
async function createHook() {
  whBusy.value = true
  try {
    await webhookApi.create(whForm.value)
    whForm.value = { name: '', url: '', secret: '', pathRegex: '', events: [], global: whForm.value.global }
    toast.success('钩子已创建')
    await loadHooks()
  } catch (e: any) { toast.error(e.message || '创建失败') }
  whBusy.value = false
}
async function toggleHook(h: any) {
  try {
    await webhookApi.update(h.id, { name: h.name, url: h.url, secret: h.secret, pathRegex: h.pathRegex, events: h.events ? JSON.parse(h.events) : [], enabled: !h.enabled })
    h.enabled = !h.enabled
  } catch (e: any) { toast.error(e.message || '更新失败') }
}
async function toggleEv(e: string) {
  const i = whForm.value.events.indexOf(e)
  if (i >= 0) whForm.value.events.splice(i, 1); else whForm.value.events.push(e)
}
async function testHook(h: any) {
  try { await webhookApi.test(h.id); toast.success('测试事件已入队，稍后看投递记录') } catch (e: any) { toast.error(e.message) }
}
async function removeHook(h: any) {
  try { await webhookApi.remove(h.id); await loadHooks() } catch (e: any) { toast.error(e.message) }
}
watch(tab, v => {
  if (v === 'webhook') {
    if (!whEvents.value.length) webhookApi.events().then(x => whEvents.value = x).catch(() => {})
    loadHooks()
  }
})

// 我的操作记录（懒加载：切到该页签才请求，避免打开设置就多打一次接口）
const LOG_PAGE_SIZE = 20
const logItems = ref<AuditItem[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const logKeyword = ref('')
const logLoading = ref(false)
async function loadLogs(page = logPage.value) {
  logLoading.value = true
  try {
    const r = await auditApi.mine(page, LOG_PAGE_SIZE, logKeyword.value.trim())
    logItems.value = r.items || []
    logTotal.value = r.total || 0
    logPage.value = page
  } catch (e: any) {
    toast.error(e?.message || '加载失败')
  } finally {
    logLoading.value = false
  }
}
// 懒加载 + immediate：深链直接打开 { tab: 'logs' } 时也能立即拉取
watch(tab, t => { if (t === 'logs' && !logItems.value.length) loadLogs(1) }, { immediate: true })

const initial = computed(() => (session.user?.nickname || 'C').charAt(0).toUpperCase())

// 上传设置（并发/分片大小，用户级、跟随账号）
const transfer = useTransfer()
const upConc = ref(transfer.prefs.concurrency)
const upChunk = ref(transfer.prefs.chunkMB)
const upSaved = ref(false)
const CONC_MAX = CONCURRENCY_MAX
const CHUNK_OPTIONS = [...CHUNK_MB_OPTIONS]
let upSavedTimer = 0
async function saveUploadSettings() {
  try {
    await transfer.savePrefs({ concurrency: upConc.value, chunkMB: upChunk.value })
    upSaved.value = true
    clearTimeout(upSavedTimer)
    upSavedTimer = window.setTimeout(() => { upSaved.value = false }, 2000)
  } catch (e: any) { toast.error('保存失败: ' + (e?.message || '未知错误')) }
}
onMounted(() => {
  loadShares()
  loadUserShares()
  loadOffline()
  void transfer.loadPrefs().then(() => { upConc.value = transfer.prefs.concurrency; upChunk.value = transfer.prefs.chunkMB })
  pollTimer = window.setInterval(() => { if (tab.value === 'offline') loadOffline() }, 3000)
})
onBeforeUnmount(() => clearInterval(pollTimer))
async function loadShares() {
  try { shares.value = await shareApi.mine() } catch {}
}
const userShares = ref<any[]>([])
async function loadUserShares() {
  try { userShares.value = await userShareApi.mine() } catch {}
}
async function cancelUserShare(s: any) {
  if (!(await uiDlg.confirm('取消共享', `取消共享「${s.name}」？对方将立即失去访问权限。`, { danger: true, okText: '取消共享' }))) return
  try { await userShareApi.cancel(s.id); loadUserShares() } catch (e: any) { toast.error(e.message) }
}
async function saveProfile() {
  try { await authApi.updateMe({ nickname: nickname.value }); await session.loadMe() } catch (e: any) { alert(e.message) }
}
async function doChangePwd() {
  try { await authApi.changePassword(oldPwd.value, newPwd.value); toast.success('密码已修改'); oldPwd.value = newPwd.value = '' } catch (e: any) { toast.error(e.message) }
}
async function doDavPwd() {
  try { await authApi.setWebdavPassword(davPwd.value); toast.success('WebDAV 密码已设置'); davPwd.value = '' } catch (e: any) { toast.error(e.message) }
}
function copyShare(s: any) {
  // HTTP 环境（非安全上下文）下 navigator.clipboard 不可用，copyText 内部回退 execCommand
  copyText(location.origin + location.pathname + '#/s/' + s.token + (s.hasPassword ? '  提取码见分享设置' : ''))
    .then(ok => ok ? toast.success('链接已复制') : toast.error('复制失败，请手动选择链接复制'))
}
async function cancelShare(s: any) {
  try { await shareApi.cancel(s.id); loadShares() } catch (e: any) { alert(e.message) }
}
function fmt(n: number) {
  if (n > 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  return (n / 1024).toFixed(1) + ' KB'
}
</script>

<style scoped>
.side-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px;
  font-size: 13.5px; cursor: pointer; color: var(--text-2); margin-bottom: 2px;
}
.side-item:hover { background: var(--hover-b); color: var(--text); }
.side-item.active { background: var(--accent-weak); color: var(--text); }
.form-row label { display: block; font-size: 12.5px; color: var(--text-2); margin-bottom: 8px; }
.ac-sub { font-size: 13px; font-weight: 600; color: var(--theme-2); margin: 6px 0 10px; }
.ac-sub + .file-list { margin-bottom: 8px; }
.wp-thumb { width: 130px; height: 78px; border-radius: 8px; border: 1px solid var(--stroke); }
</style>
