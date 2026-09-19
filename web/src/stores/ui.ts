import { defineStore } from 'pinia'

export interface MenuItem {
  label?: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  checked?: boolean
  children?: MenuItem[]
  onClick?: () => void
}

export const useContextMenu = defineStore('ctxmenu', {
  state: () => ({
    visible: false, x: 0, y: 0, items: [] as MenuItem[]
  }),
  actions: {
    show(x: number, y: number, items: MenuItem[]) {
      this.items = items
      this.x = x
      this.y = y
      this.visible = true
    },
    hide() { this.visible = false }
  }
})

export interface ClipItem {
  policyId: number
  path: string
  name: string
  isDir: boolean
}

export const useClipboard = defineStore('clip', {
  state: () => ({
    mode: '' as '' | 'copy' | 'cut',
    items: [] as ClipItem[]
  }),
  actions: {
    set(mode: 'copy' | 'cut', items: ClipItem[]) {
      this.mode = mode
      this.items = items
    },
    clear() { this.mode = ''; this.items = [] }
  }
})
