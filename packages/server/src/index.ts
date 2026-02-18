import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { graphsRouter } from './routes/graphs.js'
import { runtimeRouter } from './routes/runtime.js'
import { schemaRouter } from './routes/schema.js'
import { adaptersRouter } from './routes/adapters.js'
import { servicesRouter, setServiceBroadcast, probeServicesOnStartup } from './routes/services.js'
import { aiRouter } from './routes/ai.js'
import { errorHandler } from './middleware/errors.js'
import { setupFileWatcher } from './watcher.js'
import { log } from './logger.js'

const PORT = parseInt(process.env.PORT ?? '4444', 10)
const COMFYUI_PORT = parseInt(process.env.COMFYUI_PORT ?? '4188', 10)
const OUTPUT_DIR = path.resolve(process.cwd(), 'data', 'output')

const app = express()
app.use(cors())

// Proxy ComfyUI through our server (before body parsing).
// This makes the iframe same-origin so we can call loadGraphData() on it.
const comfyProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${COMFYUI_PORT}`,
  changeOrigin: true,
  pathRewrite: { '^/comfyui': '' },
  ws: true,
  on: {
    proxyReq: (proxyReq) => {
      // Rewrite Origin header so ComfyUI's origin check passes
      proxyReq.setHeader('Origin', `http://127.0.0.1:${COMFYUI_PORT}`)
    },
    error: (_err, _req, res) => {
      // ComfyUI not running — return a simple offline page
      if ('writeHead' in res) {
        (res as any).writeHead(502, { 'Content-Type': 'text/html' })
        ;(res as any).end('<html><body style="background:#0a0a0a;color:#666;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div>ComfyUI is not running. Start it from the Services panel.</div></body></html>')
      }
    },
  },
})
app.use('/comfyui', comfyProxy)

app.use(express.json({ limit: '10mb' }))

// Serve glamour theme SVG assets from /glamour/loom/
const GLAMOUR_LOOM_ASSETS = path.resolve(process.cwd(), 'packages', 'glamour', 'src', 'themes', 'loom', 'assets')
app.use('/glamour/loom', express.static(GLAMOUR_LOOM_ASSETS))

// Serve generated images from data/output/ (primary) and ComfyUI default output (fallback)
const COMFYUI_OUTPUT_DIR = path.resolve(process.cwd(), 'services', 'comfyui', 'ComfyUI_windows_portable', 'ComfyUI', 'output')
app.use('/api/output/files', express.static(OUTPUT_DIR), express.static(COMFYUI_OUTPUT_DIR))

// Serve glamour-generated assets from data/output/glamour-assets/
const GLAMOUR_ASSET_DIR = path.resolve(process.cwd(), 'data', 'output', 'glamour-assets')
app.use('/api/output/glamour-assets', express.static(GLAMOUR_ASSET_DIR))

// List output images (merge both directories, deduplicate by filename)
app.get('/api/output', async (_req, res) => {
  try {
    const { readdir, stat } = await import('fs/promises')
    const seen = new Set<string>()
    const entries: Array<{ name: string; size: number; modified: string; url: string }> = []

    for (const dir of [OUTPUT_DIR, COMFYUI_OUTPUT_DIR]) {
      try {
        const files = await readdir(dir)
        const images = files.filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f) && !seen.has(f))
        for (const name of images) {
          seen.add(name)
          const s = await stat(path.join(dir, name))
          entries.push({ name, size: s.size, modified: s.mtime.toISOString(), url: `/api/output/files/${name}` })
        }
      } catch { /* dir may not exist */ }
    }

    entries.sort((a, b) => b.modified.localeCompare(a.modified))
    res.json(entries)
  } catch {
    res.status(500).json({ error: 'Failed to list output' })
  }
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'weaver' })
})

// Graph CRUD
app.use('/api/graphs', graphsRouter)

// Runtime (trace execution)
app.use('/api/runtime', runtimeRouter)

// UI Schema
app.use('/api/schema', schemaRouter)

// Adapter import/export (ComfyUI, n8n)
app.use('/api/adapters', adaptersRouter)

// Service management (start/stop ComfyUI, etc.)
app.use('/api/services', servicesRouter)

// AI chat (Claude integration)
app.use('/api/ai', aiRouter)

// Error handling
app.use(errorHandler)

// HTTP + WebSocket server
const server = createServer(app)

// Proxy ComfyUI WebSocket connections (/comfyui/ws)
server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/comfyui')) {
    comfyProxy.upgrade!(req, socket as any, head)
  }
})

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Weaver WebSocket active' }))
})

// Broadcast to all WebSocket clients
export function broadcast(data: unknown): void {
  const message = JSON.stringify(data)
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message)
    }
  }
}

// Wire broadcast to services module
setServiceBroadcast(broadcast)

// Watch data/graphs/ for external changes
setupFileWatcher(broadcast)

server.listen(PORT, () => {
  log.info({ port: PORT }, `Weaver server listening on http://localhost:${PORT}`)
  log.info({ port: PORT }, `WebSocket available at ws://localhost:${PORT}/ws`)
  // Detect any externally-running services (e.g. ComfyUI started before Weaver)
  probeServicesOnStartup().catch(err =>
    log.warn({ err }, 'Service probe on startup failed')
  )
})
