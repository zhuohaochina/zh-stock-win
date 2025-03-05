import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  // 添加构建优化配置
  build: {
    // 禁用源码映射以减少内存消耗
    sourcemap: false,
    // 增加警告大小限制，避免大文件警告
    chunkSizeWarningLimit: 1500,
    // 优化commonjs模块处理
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // 分包策略
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 将node_modules的依赖单独打包
          if (id.includes('node_modules')) {
            // 将ant-design-vue单独打包，避免过大的块
            if (id.includes('ant-design-vue')) {
              return 'antd';
            }
            return 'vendor';
          }
        }
      }
    }
  }
}) 