import { describe, it, expect, vi } from 'vitest'
import { newEntries, blankMenu, itemMenu, policyMenu, isExtractable, type ItemMenuOpts } from './menus'
import type { MenuItem } from '../../stores/ui'

/** blankMenu 参数：回调全部换成空函数，测试里按需覆盖 */
function blankOver(o: Partial<Parameters<typeof blankMenu>[0]> = {}): Parameters<typeof blankMenu>[0] {
  return {
    noPolicy: false, shared: false, writable: false, readOnly: false,
    viewGrid: true, sortMode: 'name', hasClip: false,
    canOffline: false, canTerminal: false, newItems: [],
    on: {
      setView: () => {}, setSort: () => {}, refresh: () => {}, paste: () => {},
      sharedMkdir: () => {}, sharedPickFiles: () => {}, pickFiles: () => {}, pickFolder: () => {},
      offline: () => {}, terminal: () => {}, props: () => {}
    },
    ...o
  } as Parameters<typeof blankMenu>[0]
}

/** itemMenu 参数：默认一个普通未选中文件 */
function itemOver(o: Partial<ItemMenuOpts> = {}): ItemMenuOpts {
  return {
    f: { isDir: false, path: '/a.txt', ext: 'txt', name: 'a.txt' },
    multi: false, multiCount: 1, shared: false, writable: false, readOnly: false,
    guest: false, canSharePub: false, canShareUser: false, allowArchive: false, hasClip: false,
    on: {
      open: () => {}, openWith: () => [{ label: '记事本' }], copyPath: () => {}, download: () => {},
      share: () => {}, shareUser: () => {}, dlink: () => {}, toggleStar: () => {},
      cut: () => {}, copy: () => {}, pasteInto: () => {}, rename: () => {},
      archive: () => {}, extract: () => {}, del: () => {}, props: () => {}, sharedMkdir: () => {}
    },
    ...o
  } as ItemMenuOpts
}

const im = (o: Partial<ItemMenuOpts> = {}): MenuItem[] => itemMenu(itemOver(o))
const labels = (m: MenuItem[]) => m.filter(x => !x.separator).map(x => x.label)

describe('newEntries · 新建子菜单', () => {
  it('基础两项恒在，创意文档按开关显隐', () => {
    expect(labels(newEntries({ mindmap: false, whiteboard: false, flowchart: false, onNew: () => {} })))
      .toEqual(['文件夹', '文本文档'])
    expect(labels(newEntries({ mindmap: true, whiteboard: false, flowchart: true, onNew: () => {} })))
      .toEqual(['文件夹', '文本文档', '思维导图', '流程图'])
  })

  it('onNew 收到对应类型', () => {
    const onNew = vi.fn()
    newEntries({ mindmap: true, whiteboard: true, flowchart: true, onNew })[2].onClick!()
    expect(onNew).toHaveBeenCalledWith('mindmap')
  })
})

describe('blankMenu · 空白右键', () => {
  it('未打开任何盘：无排序方式，粘贴恒禁用，属性进设置', () => {
    const m = blankMenu(blankOver({ noPolicy: true, hasClip: true }))
    expect(labels(m)).toEqual(['查看', '刷新', '粘贴', '属性'])
    expect(m.find(x => x.label === '粘贴')!.disabled).toBe(true)
  })

  it('普通盘：查看/排序/刷新/粘贴/新建/上传/属性，粘贴看剪贴板与只读', () => {
    const m = blankMenu(blankOver({ hasClip: true, readOnly: false }))
    expect(labels(m)).toEqual(['查看', '排序方式', '刷新', '粘贴', '新建', '上传', '属性'])
    expect(m.find(x => x.label === '粘贴')!.disabled).toBe(false)
    expect(blankMenu(blankOver({ hasClip: true, readOnly: true })).find(x => x.label === '粘贴')!.disabled).toBe(true)
    expect(blankMenu(blankOver({ readOnly: false })).find(x => x.label === '粘贴')!.disabled).toBe(true)
  })

  it('只读：新建/上传整体禁用；排序勾选态跟随 sortMode', () => {
    const m = blankMenu(blankOver({ readOnly: true, sortMode: 'modTime' }))
    expect(m.find(x => x.label === '新建')!.disabled).toBe(true)
    expect(m.find(x => x.label === '上传')!.disabled).toBe(true)
    const sort = m.find(x => x.label === '排序方式')!.children!
    expect(sort.find(x => x.label === '修改时间')!.checked).toBe(true)
    expect(sort.find(x => x.label === '名称')!.checked).toBe(false)
  })

  it('离线下载/终端按开关显隐，位置在分隔线之前', () => {
    expect(labels(blankMenu(blankOver({ canOffline: true, canTerminal: true }))))
      .toEqual(['查看', '排序方式', '刷新', '粘贴', '新建', '上传', '离线下载到此', '在终端中打开', '属性'])
    expect(labels(blankMenu(blankOver()))).toEqual(['查看', '排序方式', '刷新', '粘贴', '新建', '上传', '属性'])
  })

  it('可写共享：追加 新建文件夹/上传文件+分隔线，没有新建/上传/属性', () => {
    const m = blankMenu(blankOver({ shared: true, writable: true }))
    expect(labels(m)).toEqual(['查看', '排序方式', '刷新', '新建文件夹', '上传文件…'])
    expect(m[m.length - 1].separator).toBe(true)
  })

  it('只读共享：到刷新后的分隔线为止', () => {
    const m = blankMenu(blankOver({ shared: true, writable: false }))
    expect(labels(m)).toEqual(['查看', '排序方式', '刷新'])
    expect(m[m.length - 1].separator).toBe(true)
  })
})

describe('itemMenu · 条目右键', () => {
  it('共享盘：文件=预览/打开+下载，目录=打开+下载 (zip)；只读共享没有删除', () => {
    expect(labels(im({ shared: true, f: { isDir: false, path: '/a', name: 'a' } })))
      .toEqual(['预览/打开', '复制路径', '下载'])
    expect(labels(im({ shared: true, f: { isDir: true, path: '/d', name: 'd' } })))
      .toEqual(['打开', '复制路径', '下载 (zip)'])
  })

  it('可写共享：追加 新建文件夹（仅目录）/删除（标红）', () => {
    const d = im({ shared: true, writable: true, f: { isDir: true, path: '/d', name: 'd' } })
    expect(labels(d)).toEqual(['打开', '复制路径', '下载 (zip)', '新建文件夹', '删除'])
    expect(d.find(x => x.label === '删除')!.danger).toBe(true)
    expect(labels(im({ shared: true, writable: true, f: { isDir: false, path: '/a', name: 'a' } })))
      .toEqual(['预览/打开', '复制路径', '下载', '删除'])
  })

  it('多选：只留批量操作，带数量；压缩按 allowArchive 显隐', () => {
    const m = im({ multi: true, multiCount: 3, allowArchive: true })
    expect(labels(m)).toEqual(['下载 3 项', '剪切', '复制', '压缩打包', '删除', '属性'])
    expect(im({ multi: true, multiCount: 2 }).find(x => x.label === '压缩打包')).toBeUndefined()
  })

  it('目录：分享/共享/粘贴到内部/收藏，只读禁用写操作', () => {
    const m = im({
      f: { isDir: true, path: '/d', name: 'd' },
      canSharePub: true, canShareUser: true, allowArchive: true
    })
    expect(labels(m)).toEqual([
      '打开', '复制路径', '下载 (zip)', '分享', '共享…',
      '收藏到快速访问', '剪切', '复制', '粘贴到内部', '重命名', '压缩打包', '删除', '属性'
    ])
    expect(m.find(x => x.label === '粘贴到内部')!.disabled).toBe(true)
    const clip = im({ f: { isDir: true, path: '/d', name: 'd' }, hasClip: true })
    expect(clip.find(x => x.label === '粘贴到内部')!.disabled).toBe(false)
    const ro = im({ f: { isDir: true, path: '/d', name: 'd' }, readOnly: true })
    expect(ro.find(x => x.label === '重命名')!.disabled).toBe(true)
    expect(ro.find(x => x.label === '删除')!.disabled).toBe(true)
  })

  it('游客：目录与文件都不显示收藏；已收藏显示「取消收藏」', () => {
    expect(im({ guest: true, f: { isDir: true, path: '/d', name: 'd' } }).find(x => x.label === '收藏到快速访问')).toBeUndefined()
    expect(im({ f: { isDir: false, path: '/a', name: 'a', starred: true } }).find(x => x.label === '取消收藏')).toBeDefined()
  })

  it('文件：打开方式子菜单、提取直链恒在；解压只对压缩包且允许归档时出现', () => {
    const zip = im({ f: { isDir: false, path: '/a.zip', ext: 'zip', name: 'a.zip' }, allowArchive: true })
    expect(zip.find(x => x.label === '打开方式')!.children).toEqual([{ label: '记事本' }])
    expect(labels(zip)).toContain('提取直链')
    expect(labels(zip)).toContain('解压到当前目录')
    const tgz = im({ f: { isDir: false, path: '/a.tar.gz', ext: 'gz', name: 'a.tar.gz' }, allowArchive: true })
    expect(labels(tgz)).toContain('解压到当前目录')
    const txt = im({ f: { isDir: false, path: '/a.txt', ext: 'txt', name: 'a.txt' }, allowArchive: true })
    expect(labels(txt)).not.toContain('解压到当前目录')
    const noArc = im({ f: { isDir: false, path: '/a.zip', ext: 'zip', name: 'a.zip' }, allowArchive: false })
    expect(labels(noArc)).not.toContain('解压到当前目录')
    expect(labels(noArc)).not.toContain('压缩打包')
  })

  it('文件与目录的分享图标区分（share / share2）', () => {
    expect(im({ canSharePub: true }).find(x => x.label === '分享')!.icon).toBe('share')
    expect(im({ canSharePub: true, f: { isDir: true, path: '/d', name: 'd' } }).find(x => x.label === '分享')!.icon).toBe('share2')
  })
})

describe('policyMenu · 盘卡片右键', () => {
  const on = { open: () => {}, shareRoot: () => {}, terminal: () => {}, admin: () => {} }
  it('按开关显隐，管理员追加管理存储', () => {
    expect(labels(policyMenu({ isAdmin: false, canShareUser: false, canTerminal: false, on }))).toEqual(['打开'])
    expect(labels(policyMenu({ isAdmin: false, canShareUser: true, canTerminal: true, on })))
      .toEqual(['打开', '共享整个磁盘…', '在终端中打开'])
    const m = policyMenu({ isAdmin: true, canShareUser: false, canTerminal: false, on })
    expect(labels(m)).toEqual(['打开', '管理存储'])
    expect(m[1].separator).toBe(true)
  })
})

describe('isExtractable · 解压判定', () => {
  it('zip 与 tar 系可解压，其余不行', () => {
    expect(isExtractable('zip', 'a.zip')).toBe(true)
    expect(isExtractable('ZIP', 'a.zip')).toBe(true)
    expect(isExtractable('gz', 'a.tar.gz')).toBe(true)
    expect(isExtractable('tgz', 'a.tgz')).toBe(true)
    expect(isExtractable('tbz2', 'a.tbz2')).toBe(true)
    expect(isExtractable('tar', 'a.tar')).toBe(true)
    expect(isExtractable('txt', 'a.txt')).toBe(false)
    expect(isExtractable('rar', 'b.rar')).toBe(false)
  })
})
