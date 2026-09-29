import { describe, it, expect } from 'vitest'
import { splitName, uniqueName, batchRename } from './fileNames'

describe('splitName', () => {
  it('拆最后一个点作为扩展名', () => {
    expect(splitName('a.tar.gz')).toEqual({ base: 'a.tar', ext: '.gz' })
    expect(splitName('a.txt')).toEqual({ base: 'a', ext: '.txt' })
  })

  it('无扩展名与隐藏文件不拆（点在第 0 位视为无扩展名）', () => {
    expect(splitName('README')).toEqual({ base: 'README', ext: '' })
    expect(splitName('.bashrc')).toEqual({ base: '.bashrc', ext: '' })
  })

  it('尾部单点视为扩展名分隔', () => {
    expect(splitName('a.')).toEqual({ base: 'a', ext: '.' })
  })
})

describe('uniqueName', () => {
  it('无重名时直接用默认名', () => {
    expect(uniqueName('新建文件夹', '', [])).toBe('新建文件夹')
    expect(uniqueName('新建文本文档', '.txt', ['其他.txt'])).toBe('新建文本文档.txt')
  })

  it('重名递增（Windows 同款格式，含空格）', () => {
    expect(uniqueName('新建文件夹', '', ['新建文件夹'])).toBe('新建文件夹 (2)')
    expect(uniqueName('新建文件夹', '', ['新建文件夹', '新建文件夹 (2)'])).toBe('新建文件夹 (3)')
  })

  it('扩展名在序号之后', () => {
    expect(uniqueName('新建文本文档', '.txt', ['新建文本文档.txt'])).toBe('新建文本文档 (2).txt')
  })
})

describe('batchRename', () => {
  it('replace：只替换主名的查找内容，保留扩展名', () => {
    expect(batchRename('IMG_001.jpg', 0, { mode: 'replace', find: 'IMG', repl: '照片' })).toBe('照片_001.jpg')
    expect(batchRename('a-a.txt', 0, { mode: 'replace', find: 'a', repl: '' })).toBe('-.txt')
  })

  it('replace：查找内容为空时原名返回', () => {
    expect(batchRename('a.txt', 0, { mode: 'replace', find: '' })).toBe('a.txt')
  })

  it('prefix 加在最前；suffix 插在扩展名之前', () => {
    expect(batchRename('a.txt', 0, { mode: 'prefix', text: '新_' })).toBe('新_a.txt')
    expect(batchRename('a.txt', 0, { mode: 'suffix', text: '_旧' })).toBe('a_旧.txt')
    expect(batchRename('a.txt', 0, { mode: 'suffix', text: '' })).toBe('a.txt')
  })

  it('seq：{n} 从 1 开始；补零位数取自「序号模板」里的 {n:2}', () => {
    expect(batchRename('照片{n}.jpg', 0, { mode: 'seq', seqFmt: '{n}' })).toBe('照片1.jpg')
    expect(batchRename('照片{n}.jpg', 4, { mode: 'seq', seqFmt: '{n:2}' })).toBe('照片05.jpg')
    // 文件名里的多个 {n} 都替换为同一个序号；补零位数只看模板，不看文件名里怎么写
    expect(batchRename('a{n:3}{n}.txt', 9, { mode: 'seq', seqFmt: '{n}' })).toBe('a1010.txt')
    expect(batchRename('a{n:3}{n}.txt', 9, { mode: 'seq', seqFmt: '{n:3}' })).toBe('a010010.txt')
  })

  it('case：只改主名时保留扩展名', () => {
    expect(batchRename('AbC.TXT', 0, { mode: 'case', caseMode: 'lowername' })).toBe('abc.TXT')
    expect(batchRename('AbC.TXT', 0, { mode: 'case', caseMode: 'uppername' })).toBe('ABC.TXT')
    expect(batchRename('AbC.TXT', 0, { mode: 'case', caseMode: 'lower' })).toBe('abc.txt')
    expect(batchRename('AbC.TXT', 0, { mode: 'case', caseMode: 'upper' })).toBe('ABC.TXT')
  })
})