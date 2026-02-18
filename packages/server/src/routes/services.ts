import { Router } from 'express'
import { spawn, execSync, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { log } from '../logger.js'

const router = Router()

// --- Service process management ---

interface ManagedService {
  process: ChildProcess | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  logs: string[]       // circular buffer of recent lines
  port: number
  /** Direct executable path (avoids cmd.exe wrapper issues with stdio piping) */
  executable: string
  /** Arguments to pass to the executable */
  args: string[]
  /** Extra environment variables merged with process.env when spawning */
  spawnEnv: Record<string, string>
  cwd: string
}

const MAX_LOG_LINES = 500

const WEAVER_ROOT = process.cwd()
const COMFYUI_BASE = path.resolve(WEAVER_ROOT, 'services', 'comfyui', 'ComfyUI_windows_portable')
const OUTPUT_DIR = path.resolve(WEAVER_ROOT, 'data', 'output')

const services: Record<string, ManagedService> = {
  comfyui: {
    process: null,
    status: 'stopped',
    logs: [],
    port: 4188,
    executable: path.join(COMFYUI_BASE, 'python_embeded', 'python.exe'),
    args: [
      '-s',
      path.join(COMFYUI_BASE, 'ComfyUI', 'main.py'),
      '--listen', '127.0.0.1',
      '--port', '4188',
      '--output-directory', OUTPUT_DIR,
      '--enable-cors-header', '*',
    ],
    spawnEnv: {
      // Disable tqdm progress bars — they crash with [Errno 22] when stderr
      // is piped on Windows because tqdm tries to flush a pipe handle that
      // doesn't support the operation via ComfyUI's LogInterceptor wrapper.
      TQDM_DISABLE: '1',
      // Unbuffered Python stdout/stderr so logs stream to the console in real-time.
      PYTHONUNBUFFERED: '1',
    },
    cwd: COMFYUI_BASE,
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
  // ComfyUI prints "To see the GUI go to:" when ready
  if (line.includes('To see the GUI go to')) {
    updateStatus(serviceId, 'running')
  }
}

/** Detect port-binding errors */
function checkPortConflict(serviceId: string, line: string): void {
  if (line.includes('Errno 10048') || line.includes('error while attempting to bind on address')) {
    pushLog(serviceId, `[weaver] Port conflict detected — use restart to auto-kill stale process`)
    updateStatus(serviceId, 'error')
  }
}

// --- Port & HTTP probing ---

async function probeServicePort(port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`http://127.0.0.1:${port}/system_stats`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

function findPidsOnPort(port: number): number[] {
  try {
    const output = execSync(
      `netstat -ano | findstr :${port} | findstr LISTEN`,
      { encoding: 'utf-8', windowsHide: true, timeout: 5000 }
    )
    const pids = new Set<number>()
    for (const line of output.split(/\r?\n/)) {
      const match = line.trim().match(/\s(\d+)\s*$/)
      if (match) {
        const pid = parseInt(match[1], 10)
        if (pid > 0) pids.add(pid)
      }
    }
    return Array.from(pids)
  } catch {
    return []
  }
}

function killProcessOnPort(port: number, serviceId: string): void {
  const pids = findPidsOnPort(port)
  if (pids.length === 0) return

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
      pushLog(serviceId, `[weaver] Could not kill PID ${pid}: ${err.message?.split('\n')[0] ?? 'unknown error'}`)
    }
  }
}

/** Stop any managed process and kill anything on the port */
function stopService(serviceId: string): void {
  const svc = services[serviceId]
  if (!svc) return

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

  killProcessOnPort(svc.port, serviceId)
}

// --- Spawn helper ---

function spawnService(serviceId: string, svc: ManagedService): void {
  // Verify executable exists
  if (!fs.existsSync(svc.executable)) {
    pushLog(serviceId, `[weaver] ERROR: Executable not found: ${svc.executable}`)
    updateStatus(serviceId, 'error')
    return
  }

  // Spawn Python directly — NOT through cmd.exe /c start.bat.
  // This gives us a direct handle on the process and avoids stdio piping
  // issues that occur when going through an intermediary cmd.exe shell.
  const child = spawn(svc.executable, svc.args, {
    cwd: svc.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, ...svc.spawnEnv },
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
      pushLog(serviceId, line)
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
    if (svc.status !== 'error') {
      updateStatus(serviceId, 'stopped')
    }
    svc.process = null
  })

  pushLog(serviceId, `[weaver] Spawned ${path.basename(svc.executable)} (PID ${child.pid})`)
  log.info({ service: serviceId, pid: child.pid }, 'Service started')
}

/** Wait for port to be free (max retries with delay) */
async function waitForPortFree(port: number, maxRetries = 10, delayMs = 300): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const pids = findPidsOnPort(port)
    if (pids.length === 0) return true
    await new Promise(r => setTimeout(r, delayMs))
  }
  return false
}

/** Full start sequence: clear port, wait, spawn */
async function startServiceProcess(serviceId: string): Promise<void> {
  const svc = services[serviceId]
  if (!svc) return

  svc.logs = []
  updateStatus(serviceId, 'starting')

  // Kill anything on the port
  stopService(serviceId)

  pushLog(serviceId, `[weaver] Waiting for port ${svc.port} to be free...`)
  const free = await waitForPortFree(svc.port)
  if (!free) {
    pushLog(serviceId, `[weaver] WARNING: Port ${svc.port} still in use after waiting — attempting start anyway`)
  }

  pushLog(serviceId, `[weaver] Starting ${serviceId}...`)
  spawnService(serviceId, svc)
}

// --- Startup detection ---

export async function probeServicesOnStartup(): Promise<void> {
  for (const [id, svc] of Object.entries(services)) {
    const alive = await probeServicePort(svc.port)
    if (alive) {
      pushLog(id, `[weaver] Detected ${id} already running on port ${svc.port} (external process)`)
      updateStatus(id, 'running')
      log.info({ service: id, port: svc.port }, 'Adopted externally-running service')
    }
  }
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
router.get('/:id', async (req, res) => {
  const svc = services[req.params.id]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  // If status is 'stopped' or 'error' but something is on the port, re-probe
  if (svc.status === 'stopped' || svc.status === 'error') {
    const alive = await probeServicePort(svc.port)
    if (alive) {
      pushLog(req.params.id, `[weaver] Detected ${req.params.id} running on port ${svc.port} (external process)`)
      updateStatus(req.params.id, 'running')
    }
  }

  res.json({
    status: svc.status,
    port: svc.port,
    logs: svc.logs,
  })
})

/** POST /api/services/:id/start — start a service */
router.post('/:id/start', async (req, res) => {
  const serviceId = req.params.id
  const svc = services[serviceId]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  // If already running and not forcing, check it's actually alive
  if (svc.status === 'running' && req.query.force !== 'true') {
    const alive = await probeServicePort(svc.port)
    if (alive) {
      res.json({ status: 'already_running' })
      return
    }
    pushLog(serviceId, `[weaver] ${serviceId} was marked running but port ${svc.port} is not responding — restarting`)
  }

  try {
    await startServiceProcess(serviceId)
    res.json({ status: 'starting' })
  } catch (err: any) {
    pushLog(serviceId, `[weaver] Failed to start: ${err.message}`)
    updateStatus(serviceId, 'error')
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/services/:id/stop — stop a service */
router.post('/:id/stop', (_req, res) => {
  const serviceId = _req.params.id
  const svc = services[serviceId]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  pushLog(serviceId, `[weaver] Stopping ${serviceId}...`)
  stopService(serviceId)
  updateStatus(serviceId, 'stopped')

  log.info({ service: serviceId }, 'Service stopped')
  res.json({ status: 'stopped' })
})

/** POST /api/services/:id/restart — atomic stop-then-start */
router.post('/:id/restart', async (req, res) => {
  const serviceId = req.params.id
  const svc = services[serviceId]
  if (!svc) {
    res.status(404).json({ error: 'Unknown service' })
    return
  }

  try {
    pushLog(serviceId, `[weaver] Restarting ${serviceId}...`)
    await startServiceProcess(serviceId)
    res.json({ status: 'starting' })
  } catch (err: any) {
    pushLog(serviceId, `[weaver] Failed to restart: ${err.message}`)
    updateStatus(serviceId, 'error')
    res.status(500).json({ error: err.message })
  }
})

export { router as servicesRouter }
