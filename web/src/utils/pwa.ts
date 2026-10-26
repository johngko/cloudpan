// B9 PWA 前端件：SW 注册、Web Push 订阅、Share Target 收件箱排空。
// SW 只做「收」：share POST 落 IndexedDB / push 弹通知；「处理」（上传、落盘、订阅上报）
// 都在登录态应用内做——SW 里没有登录凭据。
import { pushApi, fsApi, clipApi } from '../api/modules'

export function swSupported(): boolean {
  return 'serviceWorker' in navigator && (window.isSecureContext || ['127.0.0.1', 'localhost'].includes(location.hostname))
}

export function registerSW(): void {
  if (!swSupported()) return
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* 不可用（无痕/旧内核）静默 */ })
}

// ---- Web Push ----

export function pushSupported(): boolean {
  return swSupported() && 'PushManager' in window && 'Notification' in window
}

/** 开启推送：请求系统权限 → 订阅 → 上报服务端。返回状态文案供 UI 展示 */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) return '当前浏览器不支持 Web Push'
  if (Notification.permission === 'denied') return '系统已拒绝通知权限，请在浏览器站点设置里允许'
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') return '未获得通知权限'
  }
  const reg = await navigator.serviceWorker.ready
  const { publicKey } = await pushApi.vapid()
  if (!publicKey) return '服务器未生成 VAPID 公钥'
  const key = urlBase64ToKey(publicKey)
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const j = sub.toJSON()
  await pushApi.subscribe({
    endpoint: sub.endpoint,
    p256dh: j.keys?.p256dh || '',
    auth: j.keys?.auth || ''
  })
  return '已开启浏览器推送'
}

/** 静默补订阅：权限已 granted 时重启后自动重新上报（幂等 upsert） */
export async function resubscribePush(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const old = await reg.pushManager.getSubscription()
    if (!old) return
    const j = old.toJSON()
    await pushApi.subscribe({ endpoint: old.endpoint, p256dh: j.keys?.p256dh || '', auth: j.keys?.auth || '' })
  } catch { /* 离线/未登录：下次再说 */ }
}

function urlBase64ToKey(b64u: string): Uint8Array {
  const bin = atob(b64u.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ---- Share Target 收件箱 ----

export interface ShareEntry {
  at: number
  files: { name: string; type: string; blob: Blob }[]
  text: string
  url: string
}

function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cp_share', 1)
    req.onupgradeneeded = () => { req.result.createObjectStore('queue', { keyPath: 'at' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function readShareQueue(): Promise<ShareEntry[]> {
  try {
    const db = await openShareDB()
    const list: ShareEntry[] = await new Promise((resolve, reject) => {
      const rq = db.transaction('queue', 'readonly').objectStore('queue').getAll()
      rq.onsuccess = () => resolve(rq.result as ShareEntry[])
      rq.onerror = () => reject(rq.error)
    })
    db.close()
    return list
  } catch { return [] }
}

/**
 * 排空收件箱：文件 → 上传队列（/来自分享）；文本/链接 → 同名时间戳 Markdown 落盘。
 * 每项成功后从 IDB 删除（幂等：崩溃重启后剩余项再来一遍）。返回处理条数。
 */
export async function drainShareInbox(policyId: number, transferAdd: (pid: number, parent: string, files: File[]) => void, toast?: { show?: (s: string, kind?: string) => void }): Promise<number> {
  const list = await readShareQueue()
  if (!list.length) return 0
  const dir = '/来自分享'
  let done = 0
  for (const e of list) {
    try {
      const files: File[] = []
      for (const f of e.files) {
        const file = new File([f.blob], f.name, { type: f.type })
        files.push(file)
      }
      if (files.length) transferAdd(policyId, dir, files)
      const parts = e.url ? [e.url] : []
      if (e.text) parts.push(e.text)
      if (parts.length) {
        const stamp = new Date(e.at).toISOString().replace(/[-:T]/g, '').slice(0, 14)
        if (e.url) {
          // C4：链接走服务端 readability 正文剪藏（比裸存 URL 有用得多）；失败退回原始记录
          try {
            await clipApi.clip({ url: e.url, policyId, dir, snapshot: false })
            window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId, path: dir } }))
          } catch {
            const fb = dir + '/剪藏-' + stamp + '.md'
            await fsApi.writeText(policyId, fb, parts.join('\n'))
            window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId, path: dir } }))
          }
        } else {
          const name = dir + '/剪藏-' + stamp + '.md'
          await fsApi.writeText(policyId, name, parts.join('\n'))
          window.dispatchEvent(new CustomEvent('cp-refresh-explorer', { detail: { policyId, path: dir } }))
        }
      }
      const db = await openShareDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('queue', 'readwrite')
        tx.objectStore('queue').delete(e.at)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
      done++
    } catch { /* 单项失败保留待下次（未登录/无权限等） */ }
  }
  if (done && toast?.show) toast.show(`已接收 ${done} 条分享（文件进上传队列，文本/链接存到 ${dir}）`, 'info')
  return done
}
