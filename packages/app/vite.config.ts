import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/** Vite plugin to serve glamour theme SVG assets from /glamour/loom/ */
function glamourAssetsPlugin() {
  const assetsDir = path.resolve(__dirname, '../glamour/src/themes/loom/assets')
  return {
    name: 'glamour-assets',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/glamour/loom/')) return next()
        const filename = req.url.replace('/glamour/loom/', '')
        const filePath = path.join(assetsDir, filename)
        if (fs.existsSync(filePath) && filename.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          fs.createReadStream(filePath).pipe(res)
        } else {
          res.statusCode = 404
          res.end('Not found')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), glamourAssetsPlugin()],
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
