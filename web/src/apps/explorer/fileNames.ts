// 文件名纯逻辑：扩展名拆分 / 新建重名递增 / 批量重命名
// （从 Explorer.vue 抽出，便于单测，也避免组件继续膨胀）

/** 拆分扩展名：'a.tar.gz' → { base: 'a.tar', ext: '.gz' }；无扩展名/隐藏文件不拆 */
export function splitName(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.')
  if (i <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, i), ext: name.slice(i) }
}

/** Windows 同款重名递增：新建文件夹 → 新建文件夹 (2) → 新建文件夹 (3) */
export function uniqueName(base: string, ext: string, existing: Iterable<string>): string {
  const taken = new Set(existing)
  let final = base + ext
  let i = 2
  while (taken.has(final)) { final = `${base} (${i})${ext}`; i++ }
  return final
}

export type BatchRenameMode = 'replace' | 'prefix' | 'suffix' | 'seq' | 'case'
export type BatchRenameCase = 'lower' | 'upper' | 'lowername' | 'uppername'

export interface BatchRenameOpts {
  mode: BatchRenameMode
  /** replace：查找内容（为空则不改名） */
  find?: string
  /** replace：替换为（空字符串 = 删除匹配内容） */
  repl?: string
  /** prefix/suffix：前缀或后缀文本（后缀插在扩展名之前） */
  text?: string
  /** seq：序号模板，支持 {n} / {n:2}（补零位数） */
  seqFmt?: string
  /** case：大小写模式（lowername/uppername 只改主名，保留扩展名） */
  caseMode?: BatchRenameCase
}

/** 按模式生成新文件名；index 从 0 计（序号模式下文件名中的序号为 index+1） */
export function batchRename(name: string, index: number, o: BatchRenameOpts): string {
  const { base, ext } = splitName(name)
  switch (o.mode) {
    case 'replace': {
      if (!o.find) return name
      return base.split(o.find).join(o.repl || '') + ext
    }
    case 'prefix':
      return (o.text || '') + name
    case 'suffix': {
      if (!o.text) return name
      return base + o.text + ext
    }
    case 'seq': {
      const fmt = o.seqFmt || '{n}'
      const m = fmt.match(/\{n(?::(\d+))?\}/)
      const num = m ? String(index + 1).padStart(parseInt(m[1] || '1', 10), '0') : String(index + 1)
      return name.replace(/\{n(?::\d+)?\}/g, num)
    }
    case 'case': {
      if (o.caseMode === 'lower') return name.toLowerCase()
      if (o.caseMode === 'upper') return name.toUpperCase()
      if (o.caseMode === 'lowername') return base.toLowerCase() + ext
      return base.toUpperCase() + ext
    }
    default:
      return name
  }
}