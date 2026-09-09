// 拖拽文件收集：兼容"浏览器自动展开文件夹"（每项带 webkitRelativePath）
// 与"文件夹作为单个条目"（需 webkitGetAsEntry 遍历目录）两种行为。
// 后者常见于部分 WebView/内嵌浏览器，直接读 dataTransfer.files 只会拿到
// 一个 0 字节的文件夹项，导致上传失败或结构丢失。

export interface DroppedFile {
  file: File
  // 相对路径："文件夹/子目录/文件名"（普通单文件 = 文件名）
  rel: string
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

async function walkDir(e: EntryLike, prefix: string, out: DroppedFile[]): Promise<void> {
  const reader = e.createReader()
  for (;;) {
    let batch: EntryLike[]
    try {
      batch = await readEntries(reader)
    } catch {
      return
    }
    if (!batch.length) break
    for (const child of batch) {
      if (child.isFile) {
        try {
          const f = await entryFile(child)
          out.push({ file: f, rel: prefix + child.name })
        } catch {
          /* 跳过不可读项 */
        }
      } else if (child.isDirectory) {
        await walkDir(child, prefix + child.name + '/', out)
      }
    }
  }
}

export async function collectDropFiles(dt: DataTransfer): Promise<DroppedFile[]> {
  const out: DroppedFile[] = []
  const items = Array.from((dt && dt.items) || [])
  let usedEntry = false
  for (const raw of items) {
    const item = raw as any
    if (item.kind !== 'file') continue
    const entry: EntryLike | null = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    if (!entry) continue
    usedEntry = true
    if (entry.isDirectory) {
      // 浏览器未展开文件夹：按目录条目递归遍历
      await walkDir(entry, entry.name + '/', out)
    } else if (entry.isFile) {
      const f: File | null = typeof item.getAsFile === 'function' ? item.getAsFile() : null
      if (f) out.push({ file: f, rel: (f as any).webkitRelativePath || entry.name })
    }
  }
  if (!usedEntry) {
    // 无 entries API 的旧浏览器：退回扁平文件列表（带 webkitRelativePath 的保留结构）
    for (const f of Array.from((dt && dt.files) || [])) {
      out.push({ file: f, rel: (f as any).webkitRelativePath || f.name })
    }
  }
  return out
}
