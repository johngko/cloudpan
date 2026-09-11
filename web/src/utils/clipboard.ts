// 复制文本到剪贴板。
// 注意：navigator.clipboard 仅在安全上下文（HTTPS / localhost）可用——
// 站点通过 http://公网IP 访问时（非安全上下文）它是 undefined，直接调用会静默失败，
// 必须回退到「隐藏 textarea + execCommand('copy')」，且要在点击手势内同步执行。
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* 落入 execCommand 回退 */
    }
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  document.body.removeChild(ta)
  return ok
}
