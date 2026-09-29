import { describe, it, expect } from 'vitest'
import {
  TB, fmt, fmtGB, fmtBytes, fmtRate, fmtUptime, yn,
  typeName, taskTypeName, taskStatusName, notifTypeName,
  permSummary, userQuotaText, quotaModeOf, quotaModeToMB, resolveUpdMode
} from './format'

describe('容量格式化', () => {
  it('fmt：空值给 -，三档单位', () => {
    expect(fmt(0)).toBe('-')
    expect(fmt(5 * (1 << 20))).toBe('5.0 MB')
    expect(fmt(3 * (1 << 30))).toBe('3.00 GB')
    expect(fmt(2 * TB)).toBe('2.00 TB')
  })

  it('fmtGB：空值给 0（不是 -），仅 GB 档', () => {
    expect(fmtGB(0)).toBe('0')
    expect(fmtGB(1.5 * (1 << 30))).toBe('1.5 GB')
  })

  it('fmtBytes：四档单位 + B 兜底', () => {
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(512)).toBe('512 B')
    expect(fmtBytes(2048)).toBe('2.0 KB')
    expect(fmtBytes(5 * (1 << 20))).toBe('5.0 MB')
    expect(fmtBytes(2 * (1 << 30))).toBe('2.00 GB')
  })

  it('fmtRate：网络速率，空值 0 B/s', () => {
    expect(fmtRate(0)).toBe('0 B/s')
    expect(fmtRate(300)).toBe('300 B/s')
    expect(fmtRate(4096)).toBe('4.0 KB/s')
    expect(fmtRate(3 * (1 << 20))).toBe('3.0 MB/s')
  })

  it('fmtUptime：天/时/分，不足一天省略天', () => {
    expect(fmtUptime(0)).toBe('-')
    expect(fmtUptime(3661)).toBe('1时1分')
    expect(fmtUptime(90061)).toBe('1天1时1分')
  })
})

describe('名称映射', () => {
  it('yn', () => {
    expect(yn(true)).toBe('✓')
    expect(yn(false)).toBe('✗')
  })

  it('存储类型：已知给中文，未知原样回显', () => {
    expect(typeName('local')).toBe('本地目录')
    expect(typeName('aliyun')).toBe('阿里云盘')
    expect(typeName('tianyi')).toBe('天翼云盘（实验性·暂不可用）')
    expect(typeName('unknown')).toBe('unknown')
  })

  it('任务类型/状态/通知类型', () => {
    expect(taskTypeName('bt')).toBe('BT/磁力链')
    expect(taskTypeName('zzz')).toBe('zzz')
    expect(taskStatusName('finished')).toBe('完成')
    expect(taskStatusName('canceled')).toBe('已取消')
    expect(notifTypeName('quota')).toBe('配额')
    expect(notifTypeName('other')).toBe('other')
  })
})

describe('权限摘要', () => {
  it('无显式设置 → 全部默认', () => {
    expect(permSummary({})).toBe('全部默认')
    expect(permSummary({ appPerms: {} })).toBe('全部默认')
    expect(permSummary({ appPerms: undefined })).toBe('全部默认')
  })

  it('统计允许/禁止条数', () => {
    expect(permSummary({ appPerms: { a: true, b: true, c: false } })).toBe('2 允许 / 1 禁止')
    expect(permSummary({ appPerms: { a: false } })).toBe('0 允许 / 1 禁止')
  })
})

describe('用户配额文案与模式', () => {
  it('userQuotaText', () => {
    expect(userQuotaText({ quotaMB: -1 })).toBe('随组')
    expect(userQuotaText({ quotaMB: 0 })).toBe('不限量')
    expect(userQuotaText({ quotaMB: 2048 })).toBe('2048 MB（专属）')
  })

  it('quotaModeOf：由 quotaMB 反推模式', () => {
    expect(quotaModeOf({ quotaMB: -1 })).toBe('group')
    expect(quotaModeOf({ quotaMB: 0 })).toBe('unlimited')
    expect(quotaModeOf({ quotaMB: 100 })).toBe('custom')
  })

  it('quotaModeToMB：模式 → 落库值', () => {
    expect(quotaModeToMB('group', 999)).toBe(-1)
    expect(quotaModeToMB('unlimited', 999)).toBe(0)
    expect(quotaModeToMB('custom', 2048)).toBe(2048)
    expect(quotaModeToMB('custom', 10.7)).toBe(10)
  })

  it('quotaModeToMB：自定义值非法（<=0/NaN）时按不限量处理', () => {
    expect(quotaModeToMB('custom', 0)).toBe(0)
    expect(quotaModeToMB('custom', -5)).toBe(0)
    expect(quotaModeToMB('custom', NaN)).toBe(0)
  })
})

describe('更新来源模式推导', () => {
  it('无覆盖时：由 update_url 是否有值决定', () => {
    expect(resolveUpdMode(undefined)).toBe('github')
    expect(resolveUpdMode('')).toBe('github')
    expect(resolveUpdMode('https://example.com/cp')).toBe('direct')
  })

  it('有覆盖时：以用户手动选择为准（空地址选直链也能显示直链面板）', () => {
    expect(resolveUpdMode('', 'direct')).toBe('direct')
    expect(resolveUpdMode('https://example.com/cp', 'github')).toBe('github')
  })

  it('覆盖为 null 表示不覆盖（保存后回到数据驱动）', () => {
    expect(resolveUpdMode('https://example.com/cp', null)).toBe('direct')
    expect(resolveUpdMode('', null)).toBe('github')
  })
})
