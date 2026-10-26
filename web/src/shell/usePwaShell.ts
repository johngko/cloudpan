// 桌面激活期间的 PWA 后台件：分享收件箱排空、推送静默补订阅、相册备份循环。
// 由 ShellHost 在 Desktop 挂载后调用（登录态 + 数据门就绪之后），离开桌面即停。
import { drainShareInbox, resubscribePush } from '../utils/pwa'
import { runBackup, startBackupLoop, BACKUP_DIR } from '../utils/mobileBackup'
import { fsApi } from '../api/modules'
import { useTransfer } from '../stores/transfer'
import { useToast } from '../stores/dialog'
import { useNotify } from '../stores/notify'

let backupTimer = 0
let bootstrapped = false
let swMsgBound = false

async function firstLocalPolicyId(): Promise<number> {
  try {
    const ps = await fsApi.policies()
    const local = ps.find(p => p.type === 'local') || ps[0]
    return local?.id || 0
  } catch { return 0 }
}

export function pwaDesktopStart(): void {
  if (bootstrapped) return
  bootstrapped = true
  const transfer = useTransfer()
  const toast = useToast()
  // 系统推送通知被点击 → SW 给聚焦窗口发消息 → 打开站内通知面板（只绑一次）
  if (!swMsgBound && 'serviceWorker' in navigator) {
    swMsgBound = true
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      if (e.data && e.data.type === 'cp-notify-open') {
        const notify = useNotify()
        if (!notify.open) void notify.openPanel()
      }
    })
  }
  void (async () => {
    // 1) Share Target 收件箱（手机系统「分享到 CloudPan」攒下的文件/文本/链接）
    const pid = await firstLocalPolicyId()
    if (pid) await drainShareInbox(pid, (p, parent, files) => transfer.addFiles(p, parent, files), toast)
    // 2) 已授权用户静默补订阅（服务端重启/换 VAPID 后自愈）
    await resubscribePush()
    // 3) 相册自动备份循环（开关/句柄不在时 runBackup 自行 0 跳过）
    if (!backupTimer) {
      backupTimer = startBackupLoop(
        () => location.hash.startsWith('#/desktop'),
        async () => {
          const p = await firstLocalPolicyId()
          if (!p) return
          const n = await runBackup(p, (pid2, parent, files) => transfer.addFiles(pid2, parent, files))
          if (n) toast.show(`相册自动备份：新增 ${n} 个文件已加入上传队列（${BACKUP_DIR}）`, 'info')
        }
      )
    }
  })()
}

export function pwaDesktopStop(): void {
  if (backupTimer) { clearInterval(backupTimer); backupTimer = 0 }
  bootstrapped = false
}
