import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '#weaver/core': path.resolve(__dirname, '../core/src'),
      '#weaver/runtime': path.resolve(__dirname, '../runtime/src'),
      '#weaver/adapters': path.resolve(__dirname, '../adapters/src'),
      '#weaver/glamour': path.resolve(__dirname, '../glamour/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4444',
        changeOrigin: true,
      },
      '/comfyui': {
        target: 'http://127.0.0.1:4188',
        changeOrigin: true,
        ws: true,
        rewrite: (path: string) => path.replace(/^\/comfyui/, ''),
        configure: (proxy: any) => {
          // Rewrite Origin header so ComfyUI's origin check passes
          proxy.on('proxyReq', (proxyReq: any) => {
            proxyReq.setHeader('Origin', 'http://127.0.0.1:4188')
          })
        },
      },
      '/ws': {
        target: 'ws://localhost:4444',
        ws: true,
      },
    },
  },
})
