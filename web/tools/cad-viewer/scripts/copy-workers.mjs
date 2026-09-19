// 将 CAD worker / wasm 拷到产物 assets/（libredwg worker 通过 import.meta.url 就近解析 wasm）
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const out = resolve(root, '../../public/webapps/cad/assets')
mkdirSync(out, { recursive: true })
const files = [
  ['node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js', 'mtext-renderer-worker.js'],
  ['node_modules/@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js', 'libredwg-parser-worker.js'],
  ['node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm', 'libredwg-web.wasm']
]
for (const [src, name] of files) {
  copyFileSync(resolve(root, src), resolve(out, name))
  console.log('[copy-workers]', name)
}

// 同步 SHX/TTF 字体（baseUrl './cad-data/' 离线取用；源 = 仓库内 cad-data 检出）
import { cpSync, rmSync } from 'node:fs'
const fontsOut = resolve(out, '../cad-data')
rmSync(fontsOut, { recursive: true, force: true })
mkdirSync(fontsOut, { recursive: true })
cpSync(resolve(root, 'cad-data/fonts'), resolve(fontsOut, 'fonts'), { recursive: true })
console.log('[copy-workers] cad-data/fonts synced')
