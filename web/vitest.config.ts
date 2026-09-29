import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 独立于 vite.config.ts：测试配置不污染生产构建（build.sh 只走 vite build）
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.spec.ts']
  }
})