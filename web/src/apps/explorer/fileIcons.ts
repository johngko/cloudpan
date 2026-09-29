// 文件条目 → 图标名 的纯映射（从 Explorer.vue 抽出，便于单测）
//
// 两套映射：win12 用 Windows 风格文件类型图标，其余主题用通用矢量图标。
// 注意既有差异，抽取时原样保留：
//   - win12 的压缩包判定用 ARCHIVE_EXTS（含 tgz/tbz2/txz），通用分支用另一组（含 gz）。

import { ARCHIVE_EXTS } from './exts'

export interface IconEntry {
  isDir: boolean
  ext?: string
}

/** 返回 AppIcon 的 name；调用方无需再判空（未知类型回落 'file'） */
export function fileIcon(f: IconEntry, osTheme: string): string {
  const e = (f.ext || '').toLowerCase()
  if (osTheme === 'win12') {
    if (f.isDir) return 'fileFolder'
    if (['docx', 'doc'].includes(e)) return 'fileWord'
    if (['xlsx', 'xls'].includes(e)) return 'fileExcel'
    if (['pptx', 'ppt'].includes(e)) return 'filePpt'
    if (e === 'pdf') return 'filePdf'
    if (['smm', 'xmind'].includes(e)) return 'fileMindmap'
    if (e === 'excalidraw') return 'fileWhiteboard'
    if (e === 'drawio') return 'fileFlowchart'
    if (ARCHIVE_EXTS.includes(e)) return 'fileZip'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(e)) return 'fileImg'
    if (['dxf', 'dwg'].includes(e)) return 'cad'
    if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(e)) return 'fileVidio'
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return 'fileMusic'
    if (['exe', 'msi', 'bat', 'ps1'].includes(e)) return 'fileExe'
    if (['txt', 'md', 'log', 'ini', 'json', 'xml', 'js', 'ts', 'go', 'py', 'c', 'cpp', 'h', 'sh', 'css', 'html', 'yml', 'yaml', 'toml'].includes(e)) return 'fileTxt'
    return 'file'
  }
  if (f.isDir) return 'folder'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(e)) return 'image'
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(e)) return 'media'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return 'media'
  if (['dxf', 'dwg'].includes(e)) return 'cad'
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'].includes(e)) return 'office'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive'
  if (['smm', 'xmind'].includes(e)) return 'mindmap'
  if (e === 'excalidraw') return 'whiteboard'
  if (e === 'drawio') return 'flowchart'
  return 'file'
}