// 端到端加密分享的属主侧流水线：
// 创建加密分享后，逐个读取分享范围内文件（登录态直链）→ 本地 AES 加密 →
// 上传密文到 /shares/:id/encrypt-file（服务端只存密文）
import { get, post, getToken } from '../api/http'
import { genEncSalt, encEncryptBytes } from './crypto'

export interface ShareEncryptProgress {
  done: number
  total: number
  name: string
}

const MAX_FILES = 500 // 单分享加密文件数上限（个人场景足够，防误操作大目录）

export interface EncSharePlan {
  policyId: number
  path: string // 分享根（文件或目录全虚拟路径）
  isDir: boolean
  password: string
}

/** 收集分享范围内的普通文件（递归目录；返回 相对分享根路径 + 原路径 + mtime） */
async function collectFiles(plan: EncSharePlan): Promise<{ rel: string; path: string; mtime: number }[]> {
  const out: { rel: string; path: string; mtime: number }[] = []
  if (!plan.isDir) {
    out.push({ rel: '', path: plan.path, mtime: 0 })
    return out
  }
  async function walk(dir: string, rel: string) {
    if (out.length >= MAX_FILES) return
    const d: any = await get(`/fs/list?policyId=${plan.policyId}&path=${encodeURIComponent(dir)}`)
    const items: any[] = d?.items || []
    for (const it of items) {
      if (out.length >= MAX_FILES) return
      const childRel = rel ? rel + '/' + it.name : it.name
      if (it.isDir) {
        await walk(it.path, childRel)
      } else {
        out.push({ rel: childRel, path: it.path, mtime: it.modTime || 0 })
      }
    }
  }
  await walk(plan.path, '')
  return out
}

/**
 * 生成盐 → 创建加密分享 → 逐文件加密上传。
 * onProgress 回调展示进度；任一步失败抛出错误（分享记录保留，可取消删除）。
 */
export async function createEncryptedShare(
  plan: EncSharePlan,
  extra: { expireDays?: number; allowDownload?: boolean; previewEnabled?: boolean },
  onProgress?: (p: ShareEncryptProgress) => void
): Promise<{ token: string; id: number; salt: string; count: number }> {
  if (!plan.password || plan.password.length < 4) {
    throw new Error('加密分享的提取码至少 4 位（兼作解密密钥）')
  }
  const salt = genEncSalt()
  const s: any = await post('/shares', {
    policyId: plan.policyId, path: plan.path,
    password: plan.password,
    expireDays: extra.expireDays ?? 0,
    remainDownloads: 0,
    allowDownload: extra.allowDownload ?? true,
    previewEnabled: extra.previewEnabled ?? true,
    allowEdit: false,
    encrypted: true, encSalt: salt
  })
  const files = await collectFiles(plan)
  if (!files.length) throw new Error('分享范围内没有文件')
  if (files.length > MAX_FILES) throw new Error('文件数超过 ' + MAX_FILES + '，请缩小分享范围')
  // 逐个加密上传（顺序执行，避免并发拉流过大）
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    onProgress?.({ done: i, total: files.length, name: f.rel || '…' })
    // 直链拉取原文需要登录态（http 助手会附 token，原生 fetch 需手动附加）
    const r = await fetch(`/api/fs/raw?policyId=${plan.policyId}&path=${encodeURIComponent(f.path)}`, {
      headers: getToken() ? { Authorization: 'Bearer ' + getToken() } : {}
    })
    if (!r.ok) throw new Error('读取 ' + f.rel + ' 失败（HTTP ' + r.status + '）')
    const buf = new Uint8Array(await r.arrayBuffer())
    const ct = encEncryptBytes(plan.password, salt, buf)
    // 大文件加密上传可能超过默认 60s 超时
    await post(`/shares/${s.id}/encrypt-file?path=${encodeURIComponent(f.rel)}&mtime=${f.mtime}`, ct, { timeout: 30 * 60 * 1000 })
  }
  onProgress?.({ done: files.length, total: files.length, name: '完成' })
  return { token: s.token, id: s.id, salt, count: files.length }
}
