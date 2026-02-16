import { Router } from 'express'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import { log } from '../logger.js'

const router = Router()

// --- Service process management ---

interface ManagedService {
  process: ChildProcess | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  logs: string[]       // circular buffer of recent lines
  port: number
  startCommand: string
  cwd: string
}

const MAX_LOG_LINES = 500

const services: Record<string, ManagedService> = {
  comfyui: {
    process: null,
    status: 'stopped',
    logs: [],
    port: 4188,
    startCommand: path.resolve(process.cwd(), 'services', 'comfyui', 'start.bat'),
    cwd: path.resolve(process.cwd(), 'services', 'comfyui'),
  },
}

// Broadcast function — will be set by the server index
let broadcastFn: ((data: unknown) => void) | null = null

export function setServiceBroadcast(fn: (data: unknown) => void): void {
  broadcastFn = fn
}

function pushLog(serviceId: string, line: string): void {
  const svc = services[serviceId]
  if (!svc) return
  svc.logs.push(line)
  if (svc.logs.length > MAX_LOG_LINES) {
    svc.logs.splice(0, svc.logs.length - MAX_LOG_LINES)
  }
  broadcastFn?.({
    type: 'service:log',
    service: serviceId,
    line,
  })
}

function updateStatus(serviceId: string, status: ManagedService['status']): void {
  const svc = services[serviceId]
  if (!svc) return
  svc.status = status
  broadcastFn?.({
    type: 'service:status',
    service: serviceId,
    status,
  })
}

/** Detect when a service becomes ready based on output */
function checkReady(serviceId: string, line: string): void {
  // ComfyUI prints "To see the GUI go to:" on stderr when ready
  if (line.includes('To see the GUI go to')) {
    updateStatus(serviceId, 'running')
  }
}

/** GET /api/services — list all services and their status */
router.get('/', (_req, res) => {
  const result: Record<string, { status: string; port: number }> = {}
  for (const [id, svc] of Object.entries(services)) {
    result[id] = { status: svc.status, port: svc.port }
  }
  res.json(result)
})

/** GET /api/services/:id — get service details + recent logs */
router.get('/:id', (req, res) => {
  const svc = services[req.params.id]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }
  res.json({
    status: svc.status,
    port: svc.port,
    logs: svc.logs,
  })
})

/** POST /api/services/:id/start — start a service */
router.post('/:id/start', (req, res) => {
  const serviceId = req.params.id
  const svc = services[serviceId]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  if (svc.process && svc.status === 'running') {
    res.json({ status: 'already_running' })
    return
  }

  try {
    svc.logs = []
    updateStatus(serviceId, 'starting')
    pushLog(serviceId, `[weaver] Starting ${serviceId}...`)

    const child = spawn('cmd.exe', ['/c', svc.startCommand], {
      cwd: svc.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    svc.process = child

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean)
      for (const line of lines) {
        pushLog(serviceId, line)
        checkReady(serviceId, line)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean)
      for (const line of lines) {
        pushLog(serviceId, `[stderr] ${line}`)
        checkReady(serviceId, line)
      }
    })

    child.on('error', (err) => {
      log.error({ service: serviceId, err }, 'Service process error')
      pushLog(serviceId, `[weaver] Process error: ${err.message}`)
      updateStatus(serviceId, 'error')
      svc.process = null
    })

    child.on('exit', (code, signal) => {
      pushLog(serviceId, `[weaver] Process exited (code=${code}, signal=${signal})`)
      updateStatus(serviceId, 'stopped')
      svc.process = null
    })

    log.info({ service: serviceId, pid: child.pid }, 'Service started')
    res.json({ status: 'starting', pid: child.pid })
  } catch (err: any) {
    pushLog(serviceId, `[weaver] Failed to start: ${err.message}`)
    updateStatus(serviceId, 'error')
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/services/:id/stop — stop a service */
router.post('/:id/stop', (req, res) => {
  const serviceId = req.params.id
  const svc = services[serviceId]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  if (!svc.process) {
    res.json({ status: 'already_stopped' })
    return
  }

  pushLog(serviceId, `[weaver] Stopping ${serviceId}...`)

  // On Windows, kill the process tree
  const pid = svc.process.pid
  if (pid) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  }
  svc.process = null
  updateStatus(serviceId, 'stopped')

  log.info({ service: serviceId }, 'Service stopped')
  res.json({ status: 'stopped' })
})

export { router as servicesRouter }
