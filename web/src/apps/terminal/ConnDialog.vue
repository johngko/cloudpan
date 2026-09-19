<script setup lang="ts">
import { ref } from 'vue'
import { termApi, type SshConnInput, type SshConnView } from '../../api/modules'

/**
 * SSH 连接管理：列表（测通/编辑/删除）+ 新增/编辑表单（密码 / 私钥）
 */
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', conns: SshConnView[], select?: number): void
  (e: 'toast', msg: string, type?: 'ok' | 'err'): void
}>()

const conns = ref<SshConnView[]>([])
const form = ref<SshConnInput>({ name: '', host: '', port: 22, username: '', authType: 'password', password: '', privateKey: '' })
const editing = ref<null | SshConnView>(null)
const saving = ref(false)
const testing = ref<0 | number>(0) // 正在测通的连接 id
const testResult = ref<Record<number, string>>({})

async function refresh() {
  conns.value = await termApi.conns()
}
refresh()

function newForm() {
  editing.value = null
  form.value = { name: '', host: '', port: 22, username: '', authType: 'password', password: '', privateKey: '' }
}
function editForm(c: SshConnView) {
  editing.value = c
  form.value = { name: c.name, host: c.host, port: c.port, username: c.username, authType: c.authType, password: '', privateKey: '' }
}

async function save() {
  const f = form.value
  if (!f.name.trim() || !f.host.trim() || !f.username.trim()) {
    emit('toast', '名称 / 主机 / 用户名为必填项', 'err')
    return
  }
  if (f.authType === 'password' && !f.password) {
    emit('toast', '请输入密码', 'err')
    return
  }
  if (f.authType === 'key' && !f.privateKey.trim()) {
    emit('toast', '请粘贴私钥（完整 PEM）', 'err')
    return
  }
  saving.value = true
  try {
    const payload: SshConnInput = { ...f, port: f.port || 22 }
    let saved: SshConnView
    if (editing.value) {
      saved = await termApi.connUpdate(editing.value.id, payload)
      emit('toast', '连接已更新')
    } else {
      saved = await termApi.connSave(payload)
      emit('toast', '连接已保存')
    }
    await refresh()
    view.value = 'list' // 保存成功后回到列表（新连接已自动选中并连接）
    emit('saved', conns.value, saved.id)
  } catch (e: any) {
    emit('toast', e.message, 'err')
  } finally {
    saving.value = false
  }
}

async function test(c: SshConnView) {
  testing.value = c.id
  delete testResult.value[c.id]
  try {
    const r = await termApi.connTest(c.id)
    testResult.value[c.id] = `连通 · ${r.latencyMs}ms${r.os ? ' · ' + r.os : ''}`
    emit('toast', `连接测试成功（${r.latencyMs}ms）`)
  } catch (e: any) {
    testResult.value[c.id] = '失败：' + e.message
    emit('toast', e.message, 'err')
  } finally {
    testing.value = 0
  }
}

async function del(c: SshConnView) {
  if (!confirm(`删除连接「${c.name}」？`)) return
  try {
    await termApi.connDelete(c.id)
    emit('toast', '已删除')
    await refresh()
    emit('saved', conns.value)
  } catch (e: any) {
    emit('toast', e.message, 'err')
  }
}

const view = ref<'list' | 'form'>('list')
</script>

<template>
  <Teleport to="body">
    <div class="dialog-mask cd-mask" @click.self="emit('close')">
      <div class="dialog cd-dialog">
        <header class="cd-head">
          <h3>SSH 连接管理</h3>
          <button class="cd-x" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <!-- 列表视图 -->
        <div v-if="view === 'list'" class="cd-body">
          <div v-if="!conns.length" class="cd-empty">
            还没有保存的连接
            <button class="btn primary" @click="view = 'form'; newForm()">新建连接</button>
          </div>
          <div v-else class="cd-list">
            <div v-for="c in conns" :key="c.id" class="cd-item">
              <div class="cd-item-ico">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2.4" /></svg>
              </div>
              <div class="cd-item-main">
                <div class="cd-item-name">
                  {{ c.name }}
                  <span class="cd-badge" :class="c.authType">{{ c.authType === 'key' ? '私钥' : '密码' }}</span>
                </div>
                <div class="cd-item-host">{{ c.username }}@{{ c.host }}:{{ c.port }}</div>
                <div v-if="testResult[c.id]" class="cd-test" :class="{ bad: testResult[c.id].startsWith('失败') }">{{ testResult[c.id] }}</div>
              </div>
              <div class="cd-item-ops">
                <button class="cd-op" :disabled="testing === c.id" @click="test(c)">{{ testing === c.id ? '测试中…' : '测通' }}</button>
                <button class="cd-op" @click="view = 'form'; editForm(c)">编辑</button>
                <button class="cd-op danger" @click="del(c)">删除</button>
              </div>
            </div>
          </div>
          <div class="cd-foot">
            <button class="btn primary" @click="view = 'form'; newForm()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
              新建连接
            </button>
          </div>
        </div>

        <!-- 表单视图 -->
        <div v-else class="cd-body">
          <div class="cd-f">
            <label>名称 <i>*</i></label>
            <input class="input" v-model="form.name" placeholder="如：生产服务器 1" maxlength="64">
          </div>
          <div class="cd-f-row">
            <div class="cd-f cd-f-host">
              <label>主机 <i>*</i></label>
              <input class="input" v-model="form.host" placeholder="IP 或域名">
            </div>
            <div class="cd-f">
              <label>端口</label>
              <input class="input" v-model.number="form.port" type="number" min="1" max="65535" placeholder="22">
            </div>
          </div>
          <div class="cd-f">
            <label>用户名 <i>*</i></label>
            <input class="input" v-model="form.username" placeholder="root / ubuntu …">
          </div>
          <div class="cd-f">
            <label>认证方式</label>
            <div class="cd-auth">
              <button class="cd-auth-btn" :class="{ on: form.authType === 'password' }" @click="form.authType = 'password'">密码</button>
              <button class="cd-auth-btn" :class="{ on: form.authType === 'key' }" @click="form.authType = 'key'">私钥</button>
            </div>
          </div>
          <div v-if="form.authType === 'password'" class="cd-f">
            <label>密码 <i v-if="!editing">*</i><span v-else class="cd-keep">留空保持不变</span></label>
            <input class="input" v-model="form.password" type="password" placeholder="SSH 密码">
          </div>
          <div v-else class="cd-f">
            <label>私钥 <i v-if="!editing">*</i><span v-else class="cd-keep">留空保持不变</span></label>
            <textarea class="input cd-key" v-model="form.privateKey" rows="5"
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;…（粘贴完整 PEM，支持 ed25519 / RSA / ECDSA）&#10;-----END OPENSSH PRIVATE KEY-----"></textarea>
          </div>
          <p class="cd-tip">凭证使用服务器密钥 AES-256 加密存储；主机密钥采用 TOFU（首次连接信任，变更即拒绝）。</p>
          <div class="cd-foot cd-foot-form">
            <button class="btn" @click="view = 'list'">返回列表</button>
            <button class="btn primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : (editing ? '保存修改' : '保存连接') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cd-mask { z-index: 250; }
.cd-dialog { width: 460px; max-width: calc(100vw - 40px); }
.cd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.cd-head h3 { margin: 0; font-size: 15px; }
.cd-x {
  border: none; background: transparent; color: var(--text-3);
  width: 26px; height: 26px; display: grid; place-items: center;
  border-radius: var(--radius-sm); cursor: pointer;
}
.cd-x:hover { background: var(--hover); color: var(--text); }

.cd-empty {
  padding: 30px 0;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.cd-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.cd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--stroke-b);
  border-radius: var(--radius);
  background: var(--card);
  transition: border-color .12s;
}
.cd-item:hover { border-color: var(--theme-1); }
.cd-item-ico {
  width: 32px; height: 32px; flex: none;
  display: grid; place-items: center;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--theme-1), var(--theme-2));
  color: #fff;
}
.cd-item-main { flex: 1; min-width: 0; }
.cd-item-name { font-size: 13px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 6px; }
.cd-item-host { font-size: 11.5px; color: var(--text-3); font-family: Consolas, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-test { font-size: 11px; margin-top: 2px; color: var(--theme-1); }
.cd-test.bad { color: var(--danger); }
.cd-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--hover);
  color: var(--text-2);
}
.cd-badge.key { background: color-mix(in srgb, var(--theme-1) 15%, transparent); color: var(--theme-1); }
.cd-item-ops { display: flex; gap: 4px; flex: none; }
.cd-op {
  font-size: 11.5px;
  padding: 3px 8px;
  border: 1px solid var(--stroke-b);
  background: transparent;
  color: var(--text-2);
  border-radius: 6px;
  cursor: pointer;
  transition: all .12s;
}
.cd-op:hover:not(:disabled) { border-color: var(--theme-1); color: var(--theme-1); }
.cd-op.danger:hover:not(:disabled) { border-color: var(--danger); color: var(--danger); }
.cd-op:disabled { opacity: .5; cursor: default; }

.cd-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.cd-foot-form { margin-top: 18px; }

.cd-f { margin-bottom: 12px; }
.cd-f label {
  display: block;
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 5px;
}
.cd-f label i { color: var(--danger); font-style: normal; }
.cd-keep { color: var(--text-3); font-size: 11px; margin-left: 6px; }
.cd-f-row { display: flex; gap: 10px; }
.cd-f-host { flex: 1; }
.cd-key { resize: vertical; font-family: Consolas, Menlo, monospace; font-size: 11.5px; line-height: 1.5; }
.cd-auth { display: flex; gap: 6px; }
.cd-auth-btn {
  flex: 1;
  padding: 6px 0;
  font-size: 12.5px;
  border: 1px solid var(--stroke-b);
  background: var(--card);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all .12s;
}
.cd-auth-btn.on {
  border-color: transparent;
  background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
  color: #fff;
  font-weight: 600;
}
.cd-tip { font-size: 11px; color: var(--text-3); line-height: 1.6; margin: 4px 0 0; }
</style>
