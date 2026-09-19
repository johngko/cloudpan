// 拖拽文件收集：兼容三种浏览器行为
// 1) 标准展开：每个文件一个条目（带 webkitRelativePath）
// 2) 未展开文件夹：文件夹作为单个 0 字节条目，需 webkitGetAsEntry() 递归遍历
//    （部分 WebView/内嵌浏览器，直接读 dataTransfer.files 只会拿到 0 字节文件夹项）
// 3) 混合/不一致：部分内核把一部分内容放进 items、其余只在 files 里出现
//    —— 必须两个来源合并，否则落下的文件夹会静默丢失
// 任何一处读取失败都记录到 problems，调用方负责提示，避免整批静默丢失。

export interface DroppedFile {
  file: File
  // 相对路径："文件夹/子目录/文件名"（普通单文件 = 文件名）
  rel: string
}

export interface DropResult {
  files: DroppedFile[]
  // 无文件的目录（空目录/内容全部不可读）：需要显式建目录，否则不会出现在网盘里
  emptyDirs: string[]
  // 读取过程中遇到的错误（目录名/文件名为准），调用方提示用户
  problems: string[]
}

type EntryLike = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file: (cb: (f: File) => void, err?: (e: unknown) => void) => void
  createReader: () => { readEntries: (cb: (e: EntryLike[]) => void, err?: (e: unknown) => void) => void }
}

function entryFile(e: EntryLike): Promise<File> {
  return new Promise((res, rej) => e.file(res, rej))
}
function readEntries(r: { readEntries: (cb: (e: EntryLike[]) => void, err?: (e: unknown) => void) => void }): Promise<EntryLike[]> {
  // readEntries 每次最多返回 100 条，需循环读到空批
  return new Promise((res, rej) => r.readEntries(res, rej))
}

// 递归遍历目录，返回收集到的文件数（0 = 该目录无可用文件）
async function walkDir(e: EntryLike, prefix: string, out: DroppedFile[], emptyDirs: string[], problems: string[]): Promise<number> {
  const label = prefix.replace(/\/$/, '')
  const reader = e.createReader()
  let n = 0
  for (;;) {
    let batch: EntryLike[]
    try {
      batch = await readEntries(reader)
    } catch {
      problems.push(`无法读取目录「${label}」的内容`)
      return n
    }
    if (!batch.length) break
    for (const child of batch) {
      if (child.isFile) {
        try {
          const f = await entryFile(child)
          out.push({ file: f, rel: prefix + child.name })
          n++
        } catch {
          problems.push(`无法读取文件「${label}/${child.name}」`)
        }
      } else if (child.isDirectory) {
        const m = await walkDir(child, prefix + child.name + '/', out, emptyDirs, problems)
        if (m === 0) emptyDirs.push(prefix + child.name)
        n += m
      }
    }
  }
  if (n === 0) emptyDirs.push(label)
  return n
}

export async function collectDropFiles(dt: DataTransfer): Promise<DropResult> {
  const out: DroppedFile[] = []
  const emptyDirs: string[] = []
  const problems: string[] = []
  const items = Array.from((dt && dt.items) || [])
  const flat = Array.from((dt && dt.files) || [])
  const coveredKeys = new Set<string>()
  const traversedDirNames = new Set<string>()
  let usedEntry = false

  // 来源一：items（entries API 可用时可拿到真实的目录树）
  for (const raw of items) {
    const item = raw as any
    if (item.kind !== 'file') continue
    const entry: EntryLike | null = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    if (!entry) continue
    usedEntry = true
    if (entry.isDirectory) {
      // 浏览器未展开文件夹：按目录条目递归遍历
      traversedDirNames.add(entry.name)
      await walkDir(entry, entry.name + '/', out, emptyDirs, problems)
    } else if (entry.isFile) {
      const f: File | null = typeof item.getAsFile === 'function' ? item.getAsFile() : null
      if (f) out.push({ file: f, rel: (f as any).webkitRelativePath || entry.name })
    }
  }
  for (const d of out) coveredKeys.add(d.rel + '\0' + d.file.size)

  // 来源二：files（扁平列表）。entries 不可用时它是唯一来源；
  // entries 可用时补收未被覆盖的项（混合内核只把部分内容放进 items）
  if (!usedEntry) {
    for (const f of flat) {
      out.push({ file: f, rel: (f as any).webkitRelativePath || f.name })
    }
  } else {
    for (const f of flat) {
      const rel: string = (f as any).webkitRelativePath || f.name
      const key = rel + '\0' + f.size
      if (coveredKeys.has(key)) continue
      // 已被 entries 遍历过的文件夹的 0 字节占位项：内容已在遍历结果里，跳过
      if (f.size === 0 && !(f as any).webkitRelativePath && traversedDirNames.has(f.name)) continue
      out.push({ file: f, rel })
    }
  }
  return { files: out, emptyDirs, problems }
}
