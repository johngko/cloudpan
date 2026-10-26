/* CloudPan Service Worker（B9 移动端闭环）：
 * 1) Web Share Target：manifest share_target POST /share-target → 文件/文本/链接暂存 IndexedDB，
 *    重定向回桌面；应用启动后由 useShareInbox 排入上传队列/落盘剪藏。
 * 2) Web Push：push 事件弹系统通知（载荷由服务端 VAPID 加密推送），点击聚焦窗口/打开桌面。
 * 不做预缓存：应用 chunk 带 hash 由 HTTP 缓存管理，SW 预缓存会造成更新后旧壳长期驻留。 */
'use strict'

const DB_NAME = 'cp_share'
const STORE = 'queue'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'at' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()))
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method === 'POST' && new URL(req.url).pathname === '/share-target') {
    event.respondWith(handleShare(req))
  }
})

async function handleShare(req) {
  let fd
  try {
    fd = await req.formData()
  } catch {
    return Response.redirect(new URL('/#/desktop?share=bad', self.location).href, 303)
  }
  const entry = { at: Date.now(), files: [], text: String(fd.get('text') || ''), url: String(fd.get('url') || '') }
  for (const [, v] of fd.entries()) {
    if (v instanceof File) entry.files.push({ name: v.name || 'shared', type: v.type || '', blob: v })
  }
  if (!entry.files.length && !entry.text && !entry.url) {
    return Response.redirect(new URL('/#/desktop?share=bad', self.location).href, 303)
  }
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(entry)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return Response.redirect(new URL('/#/desktop?share=' + entry.at, self.location).href, 303)
}

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { /* 非 JSON 载荷退回空 */ }
  const title = d.title || 'CloudPan 通知'
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || 'cloudpan',
    icon: '/icons/pwa/icon-192.png',
    badge: '/icons/pwa/icon-192.png',
    data: { notify: true }
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of cs) {
      await c.focus()
      c.postMessage({ type: 'cp-notify-open' })
      return
    }
    await self.clients.openWindow('/#/desktop')
  })())
})

// 订阅轮换（pushsubscriptionchange）：SW 内无登录凭据，不做 DELETE；
// 应用端（SettingsApp/启动补订阅）会 PUT 覆盖同端点，服务端对 410 自动清理失效订阅。
