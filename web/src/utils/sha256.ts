// 纯 JS SHA-256 兜底实现
// 背景：crypto.subtle 仅在安全上下文（HTTPS 或 localhost）可用。
// 内网部署时用户常通过 http://<局域网IP>:18322 访问，此时 crypto.subtle 为 undefined，
// 文件哈希（秒传/去重）会直接抛错导致所有上传失败，故提供此同步兜底实现。

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotr(x: number, n: number) { return (x >>> n) | (x << (32 - n)) }

export function sha256Hex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const len = bytes.length
  const bitLen = len * 8
  // 填充：原数据 + 0x80 + 0x00... + 8 字节大端长度
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6)
  padded.set(bytes)
  padded[len] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000))
  dv.setUint32(padded.length - 4, bitLen >>> 0)

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  const w = new Uint32Array(64)

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => x.toString(16).padStart(8, '0')).join('')
}

/** 优先使用 crypto.subtle，非安全上下文回退到纯 JS 实现 */
export async function sha256(buf: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', buf)
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch { /* 回退到纯 JS 实现 */ }
  }
  return sha256Hex(buf)
}

// 空文件 SHA-256（0 字节上传的合法哈希，与任意实现一致）
export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

// ---- 增量 SHA-256（流式大文件哈希）----
// Web Crypto 的 subtle.digest 只能整块一次性哈希，大文件意味着整文件驻留内存；
// 这里提供纯 JS 的 update/digest 两阶段接口：上传泵按 4MB 片边读边喂，
// 峰值内存只有 1 个读取块（几 MB）。算法与上方 sha256Hex 完全一致。
const W = new Uint32Array(64)

export class Sha256 {
  private h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  private block = new Uint8Array(64)
  private blockLen = 0
  private totalLen = 0 // 已喂入的数据总字节数（不含填充）

  update(data: Uint8Array): void {
    this.totalLen += data.length
    let off = 0
    // 块内已有残留：先补齐
    if (this.blockLen > 0) {
      const n = Math.min(64 - this.blockLen, data.length)
      this.block.set(data.subarray(0, n), this.blockLen)
      this.blockLen += n
      off = n
      if (this.blockLen === 64) {
        this.processBlock(this.block, 0)
        this.blockLen = 0
      }
    }
    // 整块直接处理
    for (; off + 64 <= data.length; off += 64) this.processBlock(data, off)
    // 尾部留块
    if (off < data.length) {
      this.block.set(data.subarray(off), 0)
      this.blockLen = data.length - off
    }
  }

  digest(): string {
    // 填充：0x80 + 0x00…（至长度 ≡ 56 mod 64）+ 8 字节大端原始比特长度
    const bitLenHi = Math.floor(this.totalLen / 0x20000000) // (totalLen*8) >> 32
    const bitLenLo = (this.totalLen << 3) >>> 0
    this.block[this.blockLen++] = 0x80
    while (this.blockLen > 56) {
      if (this.blockLen === 64) { this.processBlock(this.block, 0); this.blockLen = 0 }
      this.block[this.blockLen++] = 0
    }
    while (this.blockLen < 56) {
      if (this.blockLen === 64) { this.processBlock(this.block, 0); this.blockLen = 0 }
      this.block[this.blockLen++] = 0
    }
    this.block[56] = (bitLenHi >>> 24) & 0xff
    this.block[57] = (bitLenHi >>> 16) & 0xff
    this.block[58] = (bitLenHi >>> 8) & 0xff
    this.block[59] = bitLenHi & 0xff
    this.block[60] = (bitLenLo >>> 24) & 0xff
    this.block[61] = (bitLenLo >>> 16) & 0xff
    this.block[62] = (bitLenLo >>> 8) & 0xff
    this.block[63] = bitLenLo & 0xff
    this.processBlock(this.block, 0)
    return Array.from(this.h).map(x => x.toString(16).padStart(8, '0')).join('')
  }

  private processBlock(src: Uint8Array, off: number): void {
    for (let i = 0; i < 16; i++) {
      W[i] = ((src[off + i * 4] << 24) | (src[off + i * 4 + 1] << 16) | (src[off + i * 4 + 2] << 8) | src[off + i * 4 + 3]) >>> 0
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3]
    let e = this.h[4], f = this.h[5], g = this.h[6], h2 = this.h[7]
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h2 + S1 + ch + K[i] + W[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h2 = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    this.h[0] = (this.h[0] + a) >>> 0; this.h[1] = (this.h[1] + b) >>> 0
    this.h[2] = (this.h[2] + c) >>> 0; this.h[3] = (this.h[3] + d) >>> 0
    this.h[4] = (this.h[4] + e) >>> 0; this.h[5] = (this.h[5] + f) >>> 0
    this.h[6] = (this.h[6] + g) >>> 0; this.h[7] = (this.h[7] + h2) >>> 0
  }
}
