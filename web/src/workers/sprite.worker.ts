// B7：视频 sprite 拼图移出主线程——主线程只负责 <video> seek 取帧
// （createImageBitmap 可跨线程 transfer），这里的 OffscreenCanvas 完成
// 网格拼图 + PNG 编码（解码/编码都不占用 UI 线程）。
interface SpriteReq { frames: ImageBitmap[]; cols: number; cellW: number; cellH: number }

const ctx = self as unknown as {
  postMessage(msg: unknown, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<SpriteReq>) => void) | null
}

ctx.onmessage = async (e) => {
  const { frames, cols, cellW, cellH } = e.data
  try {
    const rows = Math.ceil(frames.length / cols)
    const canvas = new OffscreenCanvas(cols * cellW, rows * cellH)
    const c2d = canvas.getContext('2d')
    if (!c2d) throw new Error('OffscreenCanvas 2d 不可用')
    c2d.fillStyle = '#000'
    c2d.fillRect(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]
      const x = (i % cols) * cellW
      const y = Math.floor(i / cols) * cellH
      // contain 适配 + 黑边：不同长宽比的视频拼进同一网格不变形
      const s = Math.min(cellW / f.width, cellH / f.height)
      const w = Math.round(f.width * s)
      const h = Math.round(f.height * s)
      c2d.drawImage(f, x + ((cellW - w) >> 1), y + ((cellH - h) >> 1), w, h)
      f.close()
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    // Blob 可克隆但不可 transfer（Chromium），直接克隆回传即可（几百 KB）
    ctx.postMessage({ blob, rows })
  } catch (err) {
    ctx.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
