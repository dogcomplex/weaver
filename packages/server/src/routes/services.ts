import { Router } from 'express'
import { spawn, execSync, type ChildProcess } from 'child_process'
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

/** Detect port-binding errors in stderr */
function checkPortConflict(serviceId: string, line: string): void {
  if (line.includes('Errno 10048') || line.includes('error while attempting to bind on address')) {
    pushLog(serviceId, `[weaver] Port conflict detected — click ▶ to auto-kill stale process and retry`)
    updateStatus(serviceId, 'error')
  }
}

// --- Port conflict resolution ---

/**
 * Find PIDs listening on a given port (Windows netstat).
 * Returns an array of PID numbers.
 */
function findPidsOnPort(port: number): number[] {
  try {
    const output = execSync(
      `netstat -ano | findstr :${port} | findstr LISTEN`,
      { encoding: 'utf-8', windowsHide: true, timeout: 5000 }
    )
    const pids = new Set<number>()
    for (const line of output.split(/\r?\n/)) {
      // netstat lines look like:  TCP    [::1]:4188    [::]:0    LISTENING    12345
      const match = line.trim().match(/\s(\d+)\s*$/)
      if (match) {
        const pid = parseInt(match[1], 10)
        if (pid > 0) pids.add(pid)
      }
    }
    return Array.from(pids)
  } catch {
    // findstr returns exit code 1 when no matches — that's fine
    return []
  }
}

/**
 * Kill any process listening on the given port.
 * Logs progress to the service console.
 * Returns true if the port was freed (or was already free).
 */
function killProcessOnPort(port: number, serviceId: string): boolean {
  const pids = findPidsOnPort(port)
  if (pids.length === 0) return true

  for (const pid of pids) {
    pushLog(serviceId, `[weaver] Port ${port} in use by PID ${pid} — killing...`)
    try {
      execSync(`taskkill /PID ${pid} /T /F`, {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      })
      pushLog(serviceId, `[weaver] Killed PID ${pid}`)
    } catch (err: any) {
      // Process may have already exited
      pushLog(serviceId, `[weaver] Could not kill PID ${pid}: ${err.message?.split('\n')[0] ?? 'unknown error'}`)
    }
  }

  return true
}

/**
 * Stop any managed process and kill anything on the port.
 */
function stopAndClearPort(serviceId: string): void {
  const svc = services[serviceId]
  if (!svc) return

  // Kill managed process if we have one
  if (svc.process) {
    const pid = svc.process.pid
    if (pid) {
      pushLog(serviceId, `[weaver] Stopping managed process (PID ${pid})...`)
      try {
        execSync(`taskkill /PID ${pid} /T /F`, {
          encoding: 'utf-8',
          windowsHide: true,
          timeout: 5000,
        })
      } catch {
        // Process may already be dead
      }
    }
    svc.process = null
  }

  // Kill anything else on the port (stale processes from previous sessions)
  killProcessOnPort(svc.port, serviceId)
}

// --- Spawn helper ---

function spawnService(serviceId: string, svc: ManagedService): void {
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
      checkPortConflict(serviceId, line)
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
    // Only set to stopped if we haven't already set error (e.g. port conflict)
    if (svc.status !== 'error') {
      updateStatus(serviceId, 'stopped')
    }
    svc.process = null
  })

  log.info({ service: serviceId, pid: child.pid }, 'Service started')
}

// --- Routes ---

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

/**
 * POST /api/services/:id/start — start a service
 *
 * Query params:
 *   force=true  — kill any existing process on the port before starting
 */
router.post('/:id/start', (req, res) => {
  const serviceId = req.params.id
  const svc = services[serviceId]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  const force = req.query.force === 'true'

  if (svc.process && svc.status === 'running' && !force) {
    res.json({ status: 'already_running' })
    return
  }

  try {
    svc.logs = []
    updateStatus(serviceId, 'starting')

    // Clear port before starting (kills stale processes)
    stopAndClearPort(serviceId)

    pushLog(serviceId, `[weaver] Starting ${serviceId}...`)

    // Brief delay to let the port free up after killing
    setTimeout(() => {
      spawnService(serviceId, svc)
    }, 500)

    res.json({ status: 'starting' })
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
    try {
      execSync(`taskkill /PID ${pid} /T /F`, {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      })
    } catch {
      // Process may already be dead
    }
  }
  svc.process = null
  updateStatus(serviceId, 'stopped')

  log.info({ service: serviceId }, 'Service stopped')
  res.json({ status: 'stopped' })
})

export { router as servicesRouter }
