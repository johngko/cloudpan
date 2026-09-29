import { describe, it, expect } from 'vitest'
import { fileIcon } from './fileIcons'

// 图标映射是"文件名 → 视觉"的集中约定，容易在改扩展名清单时被改错，这里把行为钉住

describe('fileIcon · win12', () => {
  it('文件夹与 Office 家族', () => {
    expect(fileIcon({ isDir: true }, 'win12')).toBe('fileFolder')
    expect(fileIcon({ isDir: false, ext: 'docx' }, 'win12')).toBe('fileWord')
    expect(fileIcon({ isDir: false, ext: 'xlsx' }, 'win12')).toBe('fileExcel')
    expect(fileIcon({ isDir: false, ext: 'pptx' }, 'win12')).toBe('filePpt')
    expect(fileIcon({ isDir: false, ext: 'pdf' }, 'win12')).toBe('filePdf')
  })

  it('压缩包用 win12 专属清单（含 tgz/txz）', () => {
    expect(fileIcon({ isDir: false, ext: 'zip' }, 'win12')).toBe('fileZip')
    expect(fileIcon({ isDir: false, ext: 'tgz' }, 'win12')).toBe('fileZip')
    expect(fileIcon({ isDir: false, ext: 'txz' }, 'win12')).toBe('fileZip')
    // 通用分支才认 gz，win12 不认 —— 既有差异，勿"顺手统一"
    expect(fileIcon({ isDir: false, ext: 'gz' }, 'win12')).toBe('file')
  })

  it('扩展名大小写不敏感；未知类型回落 file', () => {
    expect(fileIcon({ isDir: false, ext: 'PNG' }, 'win12')).toBe('fileImg')
    expect(fileIcon({ isDir: false, ext: '' }, 'win12')).toBe('file')
    expect(fileIcon({ isDir: false }, 'win12')).toBe('file')
  })
})

describe('fileIcon · 通用主题（macos/deepin）', () => {
  it('文件夹与图片/媒体/办公/压缩', () => {
    expect(fileIcon({ isDir: true }, 'macos')).toBe('folder')
    expect(fileIcon({ isDir: false, ext: 'jpg' }, 'macos')).toBe('image')
    expect(fileIcon({ isDir: false, ext: 'mp4' }, 'deepin')).toBe('media')
    expect(fileIcon({ isDir: false, ext: 'mp3' }, 'deepin')).toBe('media')
    expect(fileIcon({ isDir: false, ext: 'docx' }, 'macos')).toBe('office')
    expect(fileIcon({ isDir: false, ext: 'gz' }, 'macos')).toBe('archive')
  })

  it('创意文档容器类型各有专属图标', () => {
    expect(fileIcon({ isDir: false, ext: 'smm' }, 'macos')).toBe('mindmap')
    expect(fileIcon({ isDir: false, ext: 'excalidraw' }, 'macos')).toBe('whiteboard')
    expect(fileIcon({ isDir: false, ext: 'drawio' }, 'macos')).toBe('flowchart')
  })

  it('未知类型回落 file', () => {
    expect(fileIcon({ isDir: false, ext: 'unknown' }, 'deepin')).toBe('file')
  })
})