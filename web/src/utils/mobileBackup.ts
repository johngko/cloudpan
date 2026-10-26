// B9 相册自动备份（纯前端，本地游标增量）：
//   支持 File System Access 的浏览器（Chrome/Edge，桌面与 Android）：选定相册目录句柄存 IndexedDB，
//   之后在应用打开期间定时扫描，只上传游标（name|size|lastModified）里没见过的文件。
//   不支持的浏览器（Safari/Firefox）退化为「手动增量」：每次手选照片，游标自动跳过已备份的。
// 开关存用户设置 KV（换设备登录偏好还在），目录句柄与游标存 IndexedDB（句柄无法进 localStorage）。
import { settingsApi } from '../api/modules'

const IMG = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp']
const VID = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']
const WALK_MAX = 3000
const WALK_DEPTH = 4

export const BACKUP_DIR = '/手机备份'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('cp_backup', 1)
    rq.onupgradeneeded = () => {
      rq.result.createObjectStore('cfg')
      rq.result.createObjectStore('seen', { keyPath: 'k' })
    }
    rq.onsuccess = () => resolve(rq.result)
    rq.onerror = () => reject(rq.error)
  })
}

async function idbGet(store: string, key: string): Promise<any> {
  const db = await idb()
  const v = await new Promise((res, rej) => {
    const rq = db.transaction(store, 'readonly').objectStore(store).get(key)
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
  db.close()
  return v
}
async function idbPut(store: string, val: any, key?: string): Promise<void> {
  const db = await idb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    if (key === undefined) tx.objectStore(store).put(val)
    else tx.objectStore(store).put(val, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

export function fsApiSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function'
}

/** 选相册目录（需用户手势）；句柄持久化 IndexedDB，下次启动申请一次权限即可续用 */
export async function pickBackupDir(): Promise<'ok' | 'unsupported' | 'cancelled'> {
  if (!fsApiSupported()) return 'unsupported'
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
    await idbPut('cfg', handle, 'dirHandle')
    await settingsApi.set('mobile_backup', 'on')
    return 'ok'
  } catch { return 'cancelled' }
}

export async function getBackupHandle(): Promise<any | null> {
  try { return await idbGet('cfg', 'dirHandle') || null } catch { return null }
}

export async function clearBackupDir(): Promise<void> {
  await idbPut('cfg', null, 'dirHandle')
  await settingsApi.set('mobile_backup', 'off')
}

async function seenKeys(): Promise<Set<string>> {
  const db = await idb()
  const all: { k: string }[] = await new Promise((res, rej) => {
    const rq = db.transaction('seen', 'readonly').objectStore('seen').getAll()
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
  db.close()
  return new Set(all.map(x => x.k))
}
async function markSeen(keys: string[]): Promise<void> {
  const db = await idb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('seen', 'readwrite')
    for (const k of keys) tx.objectStore('seen').put({ k })
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

function keyOf(f: { name: string; size: number; lastModified: number }): string {
  return `${f.name}|${f.size}|${f.lastModified}`
}
function isMedia(name: string): boolean {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return IMG.includes(ext) || VID.includes(ext)
}

async function walkDir(dirHandle: any, depth: number, out: File[], seen: Set<string>): Promise<void> {
  if (out.length >= WALK_MAX || depth > WALK_DEPTH) return
  for await (const entry of (dirHandle as any).values()) {
    if (out.length >= WALK_MAX) return
    if (entry.kind === 'directory') {
      await walkDir(entry, depth + 1, out, seen)
    } else if (isMedia(entry.name)) {
      const file = await entry.getFile()
      if (!seen.has(keyOf(file))) out.push(file)
    }
  }
}

/**
 * 扫描/上传入口：传 files（手动模式）或省略（自动模式，用已存目录句柄）。
 * 返回 { scannedNew }（新文件数）。上传走 transfer 泵（含秒传/分片/并发设置）。
 */
export async function runBackup(
  policyId: number,
  addFiles: (pid: number, parent: string, files: File[]) => void,
  manualFiles?: File[]
): Promise<number> {
  const seen = await seenKeys()
  let fresh: File[] = []
  if (manualFiles) {
    fresh = manualFiles.filter(f => isMedia(f.name) && !seen.has(keyOf(f)))
  } else {
    const handle = await getBackupHandle()
    if (!handle) return 0
    if (handle.queryPermission) {
      let p = await handle.queryPermission({ mode: 'read' })
      if (p !== 'granted') p = await handle.requestPermission({ mode: 'read' })
      if (p !== 'granted') return 0
    }
    await walkDir(handle, 0, fresh, seen)
  }
  if (!fresh.length) return 0
  // 先记游标再上传：半途刷新不会重复上传统一大摞（漏的上次靠下次重选手动补）
  await markSeen(fresh.map(keyOf))
  addFiles(policyId, BACKUP_DIR, fresh)
  return fresh.length
}

/** 桌面激活时的自动扫描循环（间隔 10 分钟；无句柄/无权限时静默跳过） */
export function startBackupLoop(shouldRun: () => boolean, once: () => Promise<unknown>): number {
  const timer = window.setInterval(() => {
    if (shouldRun()) once().catch(() => {})
  }, 10 * 60 * 1000)
  // 进入桌面后 20s 先扫一轮（刚开机手机在充电场景最常见）
  setTimeout(() => { if (shouldRun()) once().catch(() => {}) }, 20 * 1000)
  return timer
}
