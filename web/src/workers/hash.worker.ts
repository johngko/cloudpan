// B14：SHA-256 哈希彻底移出主线程——上传泵的哈希原先跑在 UI 线程，
// 大文件（纯 JS 增量实现）期间虚拟滚动/窗口拖拽/动画全部卡顿。
// Worker 内：≤16MB 整块走 crypto.subtle（安全上下文下原生速度），
// http://IP 非安全上下文回退纯 JS；大文件逐块喂入增量实现，峰值内存 1 个读取块。
// ≤16MB 时整块 buffer 以 transferable 回传（零拷贝）：上传分片循环直接复用，不再重读盘。
import { Sha256, EMPTY_SHA256, sha256Hex } from '../utils/sha256'

const READ_CHUNK = 4 << 20
const SMALL = 16 << 20

interface HashReq { file: File; size: number }

// 模块 Worker 全局：类型上借用 any 绕开 Window.postMessage 的重载签名（transfer 在第 2 参）
const ctx = self as unknown as {
  postMessage(msg: unknown, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<HashReq>) => void) | null
}

ctx.onmessage = async (e) => {
  const { file, size } = e.data
  try {
    if (size === 0) { ctx.postMessage({ hash: EMPTY_SHA256 }); return }
    if (size <= SMALL) {
      const buf = await file.slice(0, size).arrayBuffer()
      let hash: string
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const dg = await crypto.subtle.digest('SHA-256', buf)
        hash = Array.from(new Uint8Array(dg)).map(b => b.toString(16).padStart(2, '0')).join('')
      } else {
        hash = sha256Hex(buf)
      }
      ctx.postMessage({ hash, buf }, [buf])
      return
    }
    const h = new Sha256()
    for (let off = 0; off < size; off += READ_CHUNK) {
      const end = Math.min(off + READ_CHUNK, size)
      const chunk = await file.slice(off, end).arrayBuffer()
      h.update(new Uint8Array(chunk))
    }
    ctx.postMessage({ hash: h.digest() })
  } catch (err) {
    ctx.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
