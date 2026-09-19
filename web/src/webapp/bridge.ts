// CloudPan 宿主桥（父窗口侧）——供移植的 v9os 商店 webapps 使用（方案见 docs/DOCS-v9os应用移植.md）。
// 暴露 window.$v9os：应用包自带 js/v9os-webos-compat.js 只依赖这一个契约面：
//   file.selectFile / file.saveFile / file.saveFileNoSelect  → FilePicker + 保存通道
//   api.webDataPost(code,'get'|'set',{key,val})              → 用户设置 KV（app.<code>.<key>）
//   msg.success / msg.error                                   → 全局 toast
//   invoke('$wins','closeWindow',id)                          → 关窗
// iframe 侧入口：web/public/webapps/_bridge/cloudpan.js（替换原 sdk.js 标签）
import { ref, type Ref } from 'vue'
import { fsApi, uploadApi, settingsApi, rawUrl, type Policy } from '../api/modules'
import { useWindows } from '../stores/windows'
import { useSession } from '../stores/session'

export interface PickFileResult {
  policyId: number
  path: string        // 文件模式 = 文件完整相对路径；文件夹模式 = 目录相对路径
  name: string
  ext: string
  size: number
  url: string         // rawUrl（带 ?t= token），供 <img>/<video>/fetch 直接使用
}
export interface PickOpts {
  title?: string
  filter?: string | null   // 逗号分隔扩展名，空 = 全部
  folder?: boolean         // true = 选目录
  initial?: { policyId?: number; dir?: string }
}

// ---- 文件选择请求队列（FilePickerHost.vue 消费）----
interface Pending { opts: PickOpts; resolve: (v: PickFileResult | null) => void }
const queue: Ref<Pending[]> = ref([])
export function requestFilePick(opts: PickOpts): Promise<PickFileResult | null> {
  return new Promise(resolve => {
    // 整体替换数组而非 push：watch(pickQueue) 只响应 .value 替换（无 deep），
    // 原地 push 不会触发对话框打开
    queue.value = [...queue.value, { opts, resolve }]
  })
}
export const pickQueue = queue

// ---- 保存通道 ----
const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'log', 'js', 'mjs', 'ts', 'vue', 'css', 'scss', 'html', 'htm', 'xml', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'bat', 'ps1', 'py', 'go', 'java', 'c', 'h', 'cpp', 'sql', 'excalidraw', 'drawio', 'smm', 'svg', 'txtx'])
function isTextLike(name: string, type: string): boolean {
  if ((type || '').startsWith('text/')) return true
  const i = name.lastIndexOf('.')
  return i >= 0 && TEXT_EXT.has(name.slice(i + 1).toLowerCase())
}
async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const d = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function saveBlob(policyId: number, path: string, blob: Blob): Promise<void> {
  const norm = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!norm) throw new Error('保存路径为空')
  const i = norm.lastIndexOf('/')
  const dir = i > 0 ? norm.slice(0, i) : ''
  const name = i >= 0 ? norm.slice(i + 1) : norm
  if (!name) throw new Error('保存文件名不能为空')
  // 小文本走 writeText（免分片会话）；其余走标准上传泵（单分片）
  if (isTextLike(name, blob.type) && blob.size < 2 * 1024 * 1024) {
    await fsApi.writeText(policyId, norm, await blob.text())
    return
  }
  const r = await uploadApi.init({ policyId, parent: dir, name, size: blob.size, hash: await sha256Hex(blob), chunkSize: Math.max(blob.size, 1) })
  if (r.instant) return
  if (!r.sessionId) throw new Error('上传会话创建失败')
  await uploadApi.chunk(r.sessionId, 0, blob)
  await uploadApi.complete(r.sessionId)
}

// ---- 轻量 DOM toast（不依赖 Vue 响应式，桥接层是纯 JS 调用点）----
function toast(text: string, ok: boolean) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = `position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 18px;border-radius:8px;font-size:13px;color:#fff;background:${ok ? '#2e7d32' : '#c62828'};box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:70vw;pointer-events:none`
  document.body.appendChild(el)
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0' }, 2200)
  setTimeout(() => el.remove(), 2700)
}

export function installHostBridge(): void {
  if ((window as any).$v9os) return
  const api = {
    host: location.origin,
    file: {
      // 契约（v9os compat 层）：selectFile(winId, title, filter, writable)
      selectFile: async (_winId: unknown, title: string, filter: string | null, writable: unknown) => {
        const f = (filter || '').replace(/^\./, '').split(',').map(s => s.trim()).filter(Boolean)
        const r = await requestFilePick({ title, filter: f.length ? f.join(',') : null, initial: {} })
        if (!r) return r
        // saveData：移植应用的「写回原文件」凭证（saveFileNoSelect 第一参数），
        // 对象形态 {policyId, path, name}——ace/svg_editor 等据此进入可编辑模式
        return { ...r, saveData: { policyId: r.policyId, path: r.path, name: r.name } }
      },
      // saveFile(title, name, blob)：blob 为空 = 仅选保存目录（compat 层惯用法）
      saveFile: async (title: string, name: string, blob: Blob) => {
        const r = await requestFilePick({ title, folder: true })
        if (!r) return false
        if (!blob || blob.size === 0) return true
        const dir = (r.path || '').replace(/\/+$/, '')
        await saveBlob(r.policyId, (dir ? dir + '/' : '') + (name || 'untitled'), blob)
        toast(`已保存 ${name || '文件'}`, true)
        return true
      },
      // saveFileNoSelect(target, blob[, ctx])：target 为 CloudPan 相对路径字符串，
      // 或选择器回传的 {policyId, path, name}（对象形态优先——跨盘选择时 ctx 的
      // policyId 是「打开上下文」的盘，不一定与所选文件同盘）
      saveFileNoSelect: async (target: string | { policyId?: number; path?: string; name?: string } | null, blob: Blob, ctx?: { policyId?: number; path?: string } | null) => {
        const t = typeof target === 'string' ? { path: target } : target || {}
        let pid = Number(t.policyId) || Number(ctx && ctx.policyId) || 0
        if (!pid) {
          const ps: Policy[] = await fsApi.policies()
          pid = ps[0]?.id || 0
        }
        if (!pid) throw new Error('没有可用云盘')
        await saveBlob(pid, t.path || (ctx && ctx.path) || '', blob)
        return true
      }
    },
    api: {
      // webDataPost(code, 'get'|'set', {key, val}) → 用户设置 KV，key 前缀 app.<code>.
      webDataPost: async (code: string, op: string, param: { key?: string; val?: unknown }) => {
        const key = `app.${code}.${param && param.key}`
        if (op === 'set') {
          await settingsApi.set(key, JSON.stringify(param.val))
          return param.val
        }
        const got = await settingsApi.get([key])
        const raw = got && (got as Record<string, string>)[key]
        if (raw == null) return null
        try { return JSON.parse(raw) } catch { return raw }
      }
    },
    msg: {
      success: (t: string) => toast(String(t), true),
      error: (t: string) => toast(String(t), false)
    },
    wallpaper: {
      // 移植 webapp 通用契约面：应用静态图壁纸（ext:<url>，桌面外壳 CSS 渲染）；
      // 视频壁纸桌面外壳暂不支持，toast 提示而非静默失败
      canChange: () => true,
      set: async (url: string, type: string) => {
        if (!url || !/^https?:\/\//.test(url)) { toast('无效的壁纸地址', false); return false }
        if (type === 'video') { toast('桌面暂不支持动态（视频）壁纸', false); return false }
        useSession().setWallpaper('ext:' + url)
        toast('壁纸已应用（可在壁纸中心更换/重置）', true)
        return true
      }
    },
    invoke: (entity: string, method: string, ...args: unknown[]) => {
      if (entity === '$wins' && method === 'closeWindow') {
        const id = Number(Array.isArray(args) && args[0] ? args[0] : 0)
        if (id) useWindows().close(id)
        return true
      }
      return false
    }
  }
  ;(window as any).$v9os = api
}

export function webAppSrc(code: string, winId: number, file?: { policyId?: number; path?: string; name?: string; ext?: string } | null): string {
  const q = new URLSearchParams()
  if (file && file.policyId && file.path) {
    q.set('action', 'open')
    q.set('ext', (file.ext || '').toLowerCase())
    q.set('name', file.name || '')
    q.set('path', file.path)
    q.set('pid', String(file.policyId))
    q.set('url', rawUrl(file.policyId, file.path))
  }
  q.set('winId', String(winId))
  return `/webapps/${code}/index.html?${q.toString()}`
}
