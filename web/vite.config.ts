import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:18322', changeOrigin: true },
      '/dav': { target: 'http://localhost:18322', changeOrigin: true }
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 按第三方库拆包：单文件的库改动只失效对应 chunk（提升缓存命中率），
        // 且避免"改一个应用就把整包 vendor 缓存打掉"
        manualChunks: {
          react: ['react', 'react-dom'],
          xlsx: ['xlsx'],
          excalidraw: ['@excalidraw/excalidraw'],
          players: ['artplayer', 'aplayer'],
          xterm: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          officepreview: ['docx-preview', 'pptx-preview']
        }
      }
    }
  }
})