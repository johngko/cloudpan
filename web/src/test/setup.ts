// 测试环境兜底：Node 无 sessionStorage/location，用最小实现补齐
// （与 AGENTS.md §5 一致：token 存 sessionStorage、资源 URL 走 ?t= 查询参数）

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v))
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
  clear(): void {
    this.m.clear()
  }
  key(i: number): string | null {
    return Array.from(this.m.keys())[i] ?? null
  }
  get length(): number {
    return this.m.size
  }
}

const g = globalThis as any
g.sessionStorage = new MemoryStorage()
g.location = { hash: '' }
// 浏览器全局兜底：Node 无 window，而 store/组件里普遍用 window.setInterval 等
g.window = g