// B5 Passkey 登录共享逻辑：三主题登录页共用（用户名 + 断言）。
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setToken } from '../api/http'
import { useSession } from '../stores/session'
import { passkeyApi } from '../api/modules'
import { parsePKOptions, credToJSON, passkeySupported } from '../utils/passkey'

export function usePasskeyLogin(opts: {
  getUsername: () => string
  onErr: (msg: string) => void
  enter?: () => void
}) {
  const router = useRouter()
  const session = useSession()
  const pkBusy = ref(false)
  const pkSupported = passkeySupported()

  async function passkeyLogin() {
    if (pkBusy.value) return
    const username = opts.getUsername().trim()
    if (!username) { opts.onErr('请先输入用户名'); return }
    pkBusy.value = true
    try {
      const b = await passkeyApi.loginBegin(username)
      const pk = parsePKOptions(b.options)
      const cred: any = await navigator.credentials.get({ publicKey: pk })
      if (!cred) { opts.onErr('已取消 Passkey 验证'); return }
      const res = await passkeyApi.loginFinish(username, b.sid, credToJSON(cred))
      setToken(res.token, res.refreshToken)
      await session.loadMe()
      if (opts.enter) opts.enter()
      else router.replace('/desktop')
    } catch (e: any) {
      const msg = e && e.name === 'NotAllowedError' ? 'Passkey 验证超时或被取消' : (e?.message || 'Passkey 登录失败')
      opts.onErr(msg)
    } finally {
      pkBusy.value = false
    }
  }

  return { pkBusy, pkSupported, passkeyLogin }
}
