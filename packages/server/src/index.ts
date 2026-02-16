import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { graphsRouter } from './routes/graphs.js'
import { runtimeRouter } from './routes/runtime.js'
import { schemaRouter } from './routes/schema.js'
import { adaptersRouter } from './routes/adapters.js'
import { servicesRouter, setServiceBroadcast } from './routes/services.js'
import { errorHandler } from './middleware/errors.js'
import { setupFileWatcher } from './watcher.js'
import { log } from './logger.js'

const PORT = parseInt(process.env.PORT ?? '4444', 10)
const OUTPUT_DIR = path.resolve(process.cwd(), 'data', 'output')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Serve generated images from data/output/ (primary) and ComfyUI default output (fallback)
const COMFYUI_OUTPUT_DIR = path.resolve(process.cwd(), 'services', 'comfyui', 'ComfyUI_windows_portable', 'ComfyUI', 'output')
app.use('/api/output/files', express.static(OUTPUT_DIR), express.static(COMFYUI_OUTPUT_DIR))

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

// Error handling
app.use(errorHandler)

// HTTP + WebSocket server
const server = createServer(app)
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
})
