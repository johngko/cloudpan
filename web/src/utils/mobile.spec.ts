import { describe, it, expect } from 'vitest'
import { resolveMobile, parseOverride } from './mobile'

describe('resolveMobile · 布局偏好优先级', () => {
  it('auto 跟随窄屏判定', () => {
    expect(resolveMobile('auto', true)).toBe(true)
    expect(resolveMobile('auto', false)).toBe(false)
  })

  it('on 强制手机布局（宽屏也生效，便于平板/桌面验手机样式）', () => {
    expect(resolveMobile('on', false)).toBe(true)
    expect(resolveMobile('on', true)).toBe(true)
  })

  it('off 强制桌面布局（窄屏也不启用）', () => {
    expect(resolveMobile('off', true)).toBe(false)
    expect(resolveMobile('off', false)).toBe(false)
  })
})

describe('parseOverride · 设置 KV 解析', () => {
  it('正常值原样返回', () => {
    expect(parseOverride(JSON.stringify('on'))).toBe('on')
    expect(parseOverride(JSON.stringify('off'))).toBe('off')
    expect(parseOverride(JSON.stringify('auto'))).toBe('auto')
  })

  it('空值/非法值一律回退 auto（不能被坏 KV 卡死在手机布局）', () => {
    expect(parseOverride(undefined)).toBe('auto')
    expect(parseOverride('')).toBe('auto')
    expect(parseOverride('on')).toBe('auto')      // 非 JSON 的裸字符串
    expect(parseOverride('"weird"')).toBe('auto') // 合法 JSON 但值不认识
    expect(parseOverride('{bad json')).toBe('auto')
    expect(parseOverride('null')).toBe('auto')
  })
})
