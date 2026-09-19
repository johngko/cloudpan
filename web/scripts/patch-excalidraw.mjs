#!/usr/bin/env node
// Excalidraw 字体离线化补丁（重装 node_modules 后必须重新执行；build.sh 自动调用）：
// ① ASSETS_FALLBACK_URL：esm.sh CDN → /excalidraw-assets/（本地 vendored 字体）
// ② 字体候选列表末项 new URL(n, ASSETS_FALLBACK_URL) 的相对 base 会抛 Invalid base URL，
//    改经 normalizeBaseUrl 规范化
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const dir = new URL('../node_modules/@excalidraw/excalidraw/dist/prod/', import.meta.url).pathname
let patched = 0
for (const f of readdirSync(dir)) {
  if (!/^chunk-.*\.js$/.test(f)) continue
  const p = dir + f
  let s = readFileSync(p, 'utf8')
  const before = s
  s = s.replace(
    /P\((\w+),"ASSETS_FALLBACK_URL",`https:\/\/esm\.sh\/\$\{[^`]*\}\/dist\/prod\/`\)/,
    'P($1,"ASSETS_FALLBACK_URL","/excalidraw-assets/")'
  )
  s = s.replace(
    /new URL\((\w+),(\w+)\.ASSETS_FALLBACK_URL\)/g,
    'new URL($1,$2.normalizeBaseUrl($2.ASSETS_FALLBACK_URL))'
  )
  if (s !== before) { writeFileSync(p, s); patched++ }
}
console.log(`[patch-excalidraw] 已处理 ${patched} 个 chunk（esm.sh 引用应清零）`)
