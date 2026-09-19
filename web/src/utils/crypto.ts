// 端到端加密分享（客户端加密，服务端只存密文）
//
// 密钥派生：PBKDF2-SHA256(提取码, salt, 100000 次, 256bit)
// 加密：AES-256-CBC + PKCS7，随机 16B IV；密文格式 = base64(iv) + ':' + base64(ct)
// 盐由属主浏览器生成（16B 随机），随分享创建提交服务端保存（盐可公开，仅参与派生）
import CryptoJS from 'crypto-js'

const ITERATIONS = 100000

/** 生成 16 字节随机盐（base64，24 字符） */
export function genEncSalt(): string {
  return CryptoJS.enc.Base64.stringify(CryptoJS.lib.WordArray.random(16))
}

function deriveKey(password: string, saltB64: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(password, CryptoJS.enc.Base64.parse(saltB64), {
    keySize: 8, // 256 bit
    iterations: ITERATIONS
  })
}

function wordsFromBytes(bytes: Uint8Array): CryptoJS.lib.WordArray {
  // crypto-js WordArray 约定：每 32bit 字内字节为大端（首字节在最高位），与 bytesFromWords 对称
  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 4) {
    let w = 0
    for (let j = 0; j < 4; j++) {
      const b = bytes[i + j]
      if (b !== undefined) w |= b << (24 - j * 8)
    }
    words.push(w >>> 0)
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

function bytesFromWords(wa: CryptoJS.lib.WordArray): Uint8Array {
  const out = new Uint8Array(wa.sigBytes)
  for (let i = 0; i < wa.sigBytes; i++) {
    out[i] = (wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }
  return out
}

/** 加密任意字节流（二进制安全）→ base64(iv):base64(ct) 字符串 */
export function encEncryptBytes(password: string, saltB64: string, data: Uint8Array): string {
  const key = deriveKey(password, saltB64)
  const iv = CryptoJS.lib.WordArray.random(16)
  const ct = CryptoJS.AES.encrypt(wordsFromBytes(data), key, {
    iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
  }).ciphertext
  return CryptoJS.enc.Base64.stringify(iv) + ':' + CryptoJS.enc.Base64.stringify(ct)
}

/** 解密 encEncryptBytes 的产物；密码错误时 crypto-js 解出乱码（PKCS7 校验失败抛错或乱码） */
export function encDecryptBytes(cipherText: string, password: string, saltB64: string): Uint8Array {
  const i = cipherText.indexOf(':')
  if (i < 0) throw new Error('密文格式错误')
  const key = deriveKey(password, saltB64)
  const iv = CryptoJS.enc.Base64.parse(cipherText.slice(0, i))
  const ct = CryptoJS.enc.Base64.parse(cipherText.slice(i + 1))
  // AES.decrypt 直接返回明文 WordArray（已去填充），不是 CipherParams 对象
  const p = CryptoJS.AES.decrypt({ ciphertext: ct }, key, {
    iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
  })
  return bytesFromWords(p)
}

/** 文本解密（UTF-8） */
export function encDecryptText(cipherText: string, password: string, saltB64: string): string {
  return new TextDecoder('utf-8').decode(encDecryptBytes(cipherText, password, saltB64))
}

/** 解密为 Blob（保留 MIME 以便 <img>/媒体播放） */
export function encDecryptBlob(cipherText: string, password: string, saltB64: string, mime = 'application/octet-stream'): Blob {
  return new Blob([encDecryptBytes(cipherText, password, saltB64)], { type: mime })
}
