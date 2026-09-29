#!/usr/bin/env node
// 生成 PWA 图标（一次性脚本，不接入构建链）。
// 源：web/public/icons/win12/logo.svg（仓库内已有的四格彩色标）
// 产物：web/public/icons/pwa/{icon-180,icon-192,icon-512,maskable-512}.png
//
// 为什么用 Chromium 而不是 ImageMagick：logo.svg 的主体是渐变填充（fill=url(#grad)），
// ImageMagick 内置 SVG 渲染器不解析渐变与滤镜，实测只画出红色阴影层（整图变纯红）。
// 无头 Chromium 能正确渲染，且可输出透明背景（--default-background-color=00000000）。
//
// 依赖系统 Chromium。改 logo 后重跑：node scripts/gen-pwa-icons.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = resolve(root, 'public/icons/win12/logo.svg')
const outDir = resolve(root, 'public/icons/pwa')
const tmpHtml = '/tmp/cloudpan-pwa-icon.html'

const CHROME = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
  .find(p => existsSync(p))
if (!CHROME) {
  console.error('[gen-pwa-icons] 未找到 Chromium，无法生成图标')
  process.exit(1)
}

// maskable 安全区：核心内容落在中心 80% 圆内，这里按 70% 更稳
const MASKABLE_FILL = '#2473DC'
const MASKABLE_INNER = Math.round(512 * 0.7)

const raw = readFileSync(srcPath, 'utf8')

/** 把 logo svg 注入指定尺寸的页面；bg 传 null 表示透明背景 */
function render(size, outPath, { bg = null, inner = null } = {}) {
  const svgSize = inner ?? size
  const svg = raw.replace('<svg ', `<svg width="${svgSize}" height="${svgSize}" `, 1)
  const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:${bg ?? 'transparent'}}
.wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg ?? 'transparent'}}
</style><div class="wrap">${svg}</div>`
  writeFileSync(tmpHtml, html, 'utf8')
  execFileSync(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${outPath}`,
    tmpHtml
  ], { stdio: 'ignore' })
}

mkdirSync(outDir, { recursive: true })

for (const size of [180, 192, 512]) {
  render(size, resolve(outDir, `icon-${size}.png`))
}
// maskable：实底 + 内容缩到 70%，保证各平台圆形/方形裁切后主体完整
render(512, resolve(outDir, 'maskable-512.png'), { bg: MASKABLE_FILL, inner: MASKABLE_INNER })

console.log('[gen-pwa-icons] 完成 →', outDir)
