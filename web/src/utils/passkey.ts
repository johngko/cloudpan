// B5 WebAuthn 辅助：base64url ↔ ArrayBuffer（go-webauthn 协议层用 base64url JSON）
// 与登录页/设置页共享。navigator.credentials 仅在安全上下文可用（https 或 localhost）。

export function b64uToBuf(s: string): ArrayBuffer {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return bytes.buffer
}

export function bufToB64u(b: ArrayBuffer | Uint8Array | undefined | null): string {
  if (!b) return ''
  const u = b instanceof Uint8Array ? b : new Uint8Array(b)
  let bin = ''
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 服务端 CredentialCreation/Assertion JSON → navigator.credentials 可用参数 */
export function parsePKOptions(options: any) {
  const pk = options.publicKey
  if (pk.challenge) pk.challenge = b64uToBuf(pk.challenge)
  if (pk.user?.id) pk.user.id = b64uToBuf(pk.user.id)
  for (const key of ['excludeCredentials', 'allowCredentials'] as const) {
    if (Array.isArray(pk[key])) pk[key] = pk[key].map((c: any) => ({ ...c, id: b64uToBuf(c.id) }))
  }
  return pk
}

/** navigator.credentials 返回的 PublicKeyCredential → 服务端可解析 JSON */
export function credToJSON(cred: any): any {
  const resp: any = { clientDataJSON: bufToB64u(cred.response?.clientDataJSON) }
  if (cred.response?.attestationObject) resp.attestationObject = bufToB64u(cred.response.attestationObject)
  if (cred.response?.authenticatorData) resp.authenticatorData = bufToB64u(cred.response.authenticatorData)
  if (cred.response?.signature) resp.signature = bufToB64u(cred.response.signature)
  if (cred.response?.userHandle) resp.userHandle = bufToB64u(cred.response.userHandle)
  return {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    response: resp
  }
}

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential &&
    (window.isSecureContext || location.hostname === '127.0.0.1' || location.hostname === 'localhost')
}
