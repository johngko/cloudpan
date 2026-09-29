import { describe, it, expect } from 'vitest'
import {
  genEncSalt,
  encEncryptBytes,
  encDecryptBytes,
  encDecryptText
} from './crypto'

// 端到端加密分享（AGENTS.md 安全红线：PBKDF2 10 万轮 + AES-256-CBC，密钥不过服务端）
// 这里只验证客户端加解密的正确性与二进制安全性，不涉及传输层。

function bytes(n: number, seed = 1): Uint8Array {
  const a = new Uint8Array(n)
  for (let i = 0; i < n; i++) a[i] = (i * 31 + seed) & 0xff
  return a
}

describe('crypto(E2E 分享)', () => {
  it('genEncSalt 生成 16 字节盐（base64 24 字符且互不相同）', () => {
    const s1 = genEncSalt()
    const s2 = genEncSalt()
    expect(s1).toHaveLength(24)
    expect(s2).toHaveLength(24)
    expect(s1).not.toBe(s2)
  })

  it('二进制往返一致（含 0x00/0xff 等边界字节）', () => {
    const salt = genEncSalt()
    const data = new Uint8Array([0, 1, 255, 254, 0, 127, 128, 0])
    const ct = encEncryptBytes('1234', salt, data)
    const out = encDecryptBytes(ct, '1234', salt)
    expect(Array.from(out)).toEqual(Array.from(data))
  })

  it('密文格式为 base64(iv):base64(ct)，IV 每次随机', () => {
    const salt = genEncSalt()
    const data = bytes(32)
    const c1 = encEncryptBytes('pw', salt, data)
    const c2 = encEncryptBytes('pw', salt, data)
    expect(c1).toMatch(/^[^:]+:[^:]+$/)
    expect(c1.split(':')[0]).toHaveLength(24) // 16B → base64 24 字符
    expect(c1).not.toBe(c2) // 随机 IV
  })

  it('大文件分块往返一致（跨 WordArray 边界）', () => {
    const salt = genEncSalt()
    const data = bytes(70000)
    const out = encDecryptBytes(encEncryptBytes('pw', salt, data), 'pw', salt)
    expect(out.length).toBe(data.length)
    expect(out[69999]).toBe(data[69999])
  })

  it('密码错误时解不出原文（拒绝或乱码，绝不等于明文）', () => {
    const salt = genEncSalt()
    const data = bytes(48)
    const ct = encEncryptBytes('right', salt, data)
    let out: Uint8Array | null = null
    try {
      out = encDecryptBytes(ct, 'wrong', salt)
    } catch {
      out = null
    }
    if (out) expect(Array.from(out)).not.toEqual(Array.from(data))
  })

  it('盐不同则同一密码解不出原文', () => {
    const data = bytes(48)
    const ct = encEncryptBytes('pw', genEncSalt(), data)
    let out: Uint8Array | null = null
    try {
      out = encDecryptBytes(ct, 'pw', genEncSalt())
    } catch {
      out = null
    }
    if (out) expect(Array.from(out)).not.toEqual(Array.from(data))
  })

  it('密文缺少分隔符时报错', () => {
    expect(() => encDecryptBytes('not-a-cipher', 'pw', genEncSalt())).toThrow()
  })

  it('UTF-8 文本往返一致（中文/emoji）', () => {
    const salt = genEncSalt()
    const text = '云盘 E2E 加密 🔐 分享'
    const ct = encEncryptBytes('pw', salt, new TextEncoder().encode(text))
    expect(encDecryptText(ct, 'pw', salt)).toBe(text)
  })
})