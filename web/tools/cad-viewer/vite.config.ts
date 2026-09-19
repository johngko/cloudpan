import { defineConfig } from 'vite'

// 重活分包：three / data-model / 渲染引擎独立 chunk，主入口保持轻量
function viewerManualChunk(id: string): string | undefined {
  const path = id.replace(/\\/g, '/')
  if (path.includes('vite/preload-helper') || path.includes('vite/modulepreload-polyfill')) return 'vite-preload'
  if (path.includes('/node_modules/three/') || path.includes('/node_modules/.pnpm/three@')) return 'three'
  if (path.includes('/@mlightcad/three-renderer/') || path.includes('/@mlightcad/mtext-renderer/') || path.includes('/@mlightcad/mtext-parser/') || path.includes('/@mlightcad/shx-parser/')) return 'three-renderer'
  if (path.includes('/@mlightcad/data-model/') || path.includes('/@mlightcad/geometry-engine/') || path.includes('/@mlightcad/graphic-interface/') || path.includes('/@mlightcad/common/')) return 'data-model'
  if (path.includes('/@mlightcad/cad-simple-viewer/')) return 'cad-simple-viewer'
  return undefined
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
    outDir: '../../public/webapps/cad',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: viewerManualChunk } }
  }
})
