import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    cors: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.trycloudflare.com',     // 注意前缀点号，表示匹配所有子域名
      '.loca.lt',               // localtunnel格式
      '.ngrok.io',              // ngrok格式
      '.ngrok-free.app',        // 新版ngrok格式
      // 您的特定域名（为兼容考虑保留）
      'cemetery-jim-arch-bird.trycloudflare.com',
      'oval-villas-insight-plymouth.trycloudflare.com',
      'asn-telecharger-bundle-equation.trycloudflare.com'
    ]
  }
})
