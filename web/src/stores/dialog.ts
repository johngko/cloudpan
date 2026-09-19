import { defineStore } from 'pinia'

interface DialogState {
  kind: 'confirm' | 'prompt' | 'alert'
  title: string
  message: string
  inputValue: string
  okText: string
  cancelText: string
  danger: boolean
  resolver: (v: any) => void
}

// 系统内对话框（替代浏览器原生 prompt/alert/confirm —— 原生弹窗会被内嵌浏览器/自动化环境拦截）
export const useUiDialog = defineStore('uiDialog', {
  state: () => ({ d: null as DialogState | null }),
  actions: {
    confirm(title: string, message = '', opts: { danger?: boolean; okText?: string } = {}): Promise<boolean> {
      return new Promise(resolve => {
        this.d = { kind: 'confirm', title, message, inputValue: '', okText: opts.okText || '确定', cancelText: '取消', danger: !!opts.danger, resolver: resolve }
      })
    },
    prompt(title: string, defaultValue = '', okText = '确定'): Promise<string | null> {
      return new Promise(resolve => {
        this.d = { kind: 'prompt', title, message: '', inputValue: defaultValue, okText, cancelText: '取消', danger: false, resolver: resolve }
      })
    },
    alert(title: string, message = ''): Promise<void> {
      return new Promise(resolve => {
        this.d = { kind: 'alert', title, message, inputValue: '', okText: '确定', cancelText: '', danger: false, resolver: resolve }
      })
    },
    ok() {
      const d = this.d
      if (!d) return
      d.resolver(d.kind === 'prompt' ? d.inputValue : true)
      this.d = null
    },
    cancel() {
      const d = this.d
      if (!d) return
      d.resolver(d.kind === 'prompt' ? null : false)
      this.d = null
    }
  }
})

export const useToast = defineStore('toast', {
  state: () => ({ list: [] as { id: number; text: string; kind: string }[] }),
  actions: {
    show(text: string, kind = 'info') {
      const id = Date.now() + Math.random()
      this.list.push({ id, text, kind })
      setTimeout(() => { this.list = this.list.filter(t => t.id !== id) }, 3200)
    },
    error(text: string) { this.show(text, 'error') },
    success(text: string) { this.show(text, 'success') }
  }
})
