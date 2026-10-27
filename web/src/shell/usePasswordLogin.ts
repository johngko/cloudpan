// 口令登录的两步验证（A3）补层：三个主题的登录页共用。
// 服务端口令通过后若账号绑定了 TOTP，返回 {needTotp:true}（无 token）；
// 这里弹码输入（验证码或一次性恢复码）重发，直到通过或被取消。
import { authApi, type LoginResult } from '../api/modules'
import { useUiDialog } from '../stores/dialog'

export async function loginWithSecondFactor(username: string, password: string): Promise<LoginResult> {
  let res = await authApi.login(username, password)
  while ((res as { needTotp?: boolean }).needTotp) {
    let tip = '该账号已开启两步验证：请输入 6 位验证码（或一次性恢复码）'
    for (;;) {
      const code = await useUiDialog().prompt(tip, '', '验证并登录')
      if (code === null) throw new Error('已取消两步验证，未登录')
      try {
        res = await authApi.login(username, password, code.trim())
        break
      } catch (e: any) {
        // 服务端对错误码与错误口令返回同形响应（防枚举），此处按码验证失败重试即可
        tip = '验证失败，请重新输入验证码或恢复码'
      }
    }
  }
  return res
}
