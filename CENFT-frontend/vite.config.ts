import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    cors: true,
    // 允许所有trycloudflare.com子域名和其他常用本地开发域名
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.trycloudflare.com',  // 注意前缀点号，表示匹配所有子域名
      '.loca.lt',            // localtunnel格式
      '.ngrok.io',           // ngrok格式
      '.ngrok-free.app'      // 新版ngrok格式
    ]
  }
}) 