#!/usr/bin/env node
// 构建前对账：APPS（stores/apps.ts）里每个应用 id 必须在主题注册表（themes/registry.ts）
// 的 APP_LOADERS 有对应加载器，否则该应用窗口会静默回落成记事本（appComponent 的
// notepad 兜底）——photopea 曾因删除 birdpaper 时被连带误删而触发此事故（2026-09-19）。
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const apps = readFileSync(root + 'src/stores/apps.ts', 'utf8')
const registry = readFileSync(root + 'src/themes/registry.ts', 'utf8')

const ids = [...apps.matchAll(/id: '([a-z_]+)'/g)].map(m => m[1])
const section = registry.slice(registry.indexOf('APP_LOADERS'))
const loaders = [...section.matchAll(/^  ([a-z_]+): (?:\(\) => import|webappLoader)/gm)].map(m => m[1])

const missing = ids.filter(id => !loaders.includes(id))
if (missing.length) {
  console.error(`[check-app-registry] 以下应用缺少注册表加载器（会回落成记事本）：${missing.join(', ')}`)
  process.exit(1)
}
console.log(`[check-app-registry] OK: ${ids.length} 个应用全部有加载器`)
