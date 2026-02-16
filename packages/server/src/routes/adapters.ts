import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { deserializeWeave, serializeWeave } from '#weaver/core'
import {
  fromComfyUIWeb,
  fromComfyUIApi,
  toComfyUIWeb,
  toComfyUIApi,
  fromN8n,
  toN8n,
  ComfyUIClient,
  N8nClient,
} from '#weaver/adapters'
import { log } from '../logger.js'

const router = Router()
const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')

async function ensureDir(): Promise<void> {
  await fs.mkdir(GRAPHS_DIR, { recursive: true })
}

// --- Status: check if services are reachable ---

router.get('/status', async (_req, res) => {
  const comfyui = new ComfyUIClient()
  const n8n = new N8nClient()
  const [comfyConnected, n8nConnected] = await Promise.all([
    comfyui.isConnected(),
    n8n.isConnected(),
  ])
  res.json({
    comfyui: { connected: comfyConnected, url: `http://127.0.0.1:${process.env.COMFYUI_PORT || 4188}` },
    n8n: { connected: n8nConnected, url: 'http://127.0.0.1:5678' },
  })
})

// --- ComfyUI ---

/** Import a ComfyUI web workflow (with visual nodes/links) → save as .weave.json */
router.post('/comfyui/import/web', async (req, res, next) => {
  try {
    await ensureDir()
    const weave = fromComfyUIWeb(req.body)
    const filepath = path.join(GRAPHS_DIR, `${weave.id}.weave.json`)
    await fs.writeFile(filepath, serializeWeave(weave), 'utf-8')
    log.info({ id: weave.id, name: weave.name }, 'Imported ComfyUI web workflow')
    res.status(201).json({ id: weave.id, name: weave.name })
  } catch (err) {
    next(err)
  }
})

/** Import a ComfyUI API workflow (keyed format) → save as .weave.json */
router.post('/comfyui/import/api', async (req, res, next) => {
  try {
    await ensureDir()
    const weave = fromComfyUIApi(req.body)
    const filepath = path.join(GRAPHS_DIR, `${weave.id}.weave.json`)
    await fs.writeFile(filepath, serializeWeave(weave), 'utf-8')
    log.info({ id: weave.id, name: weave.name }, 'Imported ComfyUI API workflow')
    res.status(201).json({ id: weave.id, name: weave.name })
  } catch (err) {
    next(err)
  }
})

/** Export a saved weave → ComfyUI API format */
router.get('/comfyui/export/:id', async (req, res, next) => {
  try {
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)
    res.json(toComfyUIApi(weave))
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Weave not found' })
    } else {
      next(err)
    }
  }
})

/** Export a saved weave → ComfyUI web format (visual) */
router.get('/comfyui/export/:id/web', async (req, res, next) => {
  try {
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)
    res.json(toComfyUIWeb(weave))
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Weave not found' })
    } else {
      next(err)
    }
  }
})

const OUTPUT_DIRS = [
  path.resolve(process.cwd(), 'data', 'output'),
  path.resolve(process.cwd(), 'services', 'comfyui', 'ComfyUI_windows_portable', 'ComfyUI', 'output'),
]

/** Snapshot output directory filenames before queuing */
async function snapshotOutputDir(): Promise<Set<string>> {
  const all = new Set<string>()
  for (const dir of OUTPUT_DIRS) {
    try {
      for (const f of await fs.readdir(dir)) all.add(f)
    } catch { /* dir may not exist */ }
  }
  return all
}

/** Find new files in output directories compared to snapshot */
async function findNewOutputFiles(before: Set<string>): Promise<string[]> {
  const newFiles: string[] = []
  for (const dir of OUTPUT_DIRS) {
    try {
      const files = await fs.readdir(dir)
      for (const f of files) {
        if (!before.has(f) && /\.(png|jpg|jpeg|webp|gif)$/i.test(f)) {
          newFiles.push(f)
        }
      }
    } catch { /* dir may not exist */ }
  }
  return newFiles
}

/** Queue a weave to ComfyUI for execution, wait for result */
router.post('/comfyui/queue/:id', async (req, res, next) => {
  try {
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)
    const apiWorkflow = toComfyUIApi(weave)

    // Randomize seed to prevent cached execution (unless ?fixed_seed=true)
    if (req.query.fixed_seed !== 'true') {
      for (const node of Object.values(apiWorkflow)) {
        if (node.inputs && 'seed' in node.inputs && typeof node.inputs.seed === 'number') {
          node.inputs.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        }
      }
    }

    // Snapshot output dir before queuing
    const beforeFiles = await snapshotOutputDir()

    const client = new ComfyUIClient()
    const result = await client.queuePrompt(apiWorkflow)
    const promptId = result.prompt_id
    log.info({ id: req.params.id, promptId }, 'Queued to ComfyUI')

    // Poll history until the prompt completes (max 120s)
    const deadline = Date.now() + 120_000
    let history: Record<string, any> = {}
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500))
      history = await client.getHistory(promptId)
      if (history[promptId]?.status?.completed) break
      if (history[promptId]?.status?.status_str === 'error') {
        res.status(500).json({ error: 'ComfyUI execution failed', promptId, history: history[promptId] })
        return
      }
    }

    // Extract output image filenames from history
    const outputs = history[promptId]?.outputs ?? {}
    const images: Array<{ filename: string; subfolder: string; type: string; url: string }> = []
    for (const nodeOutput of Object.values(outputs) as any[]) {
      if (nodeOutput?.images) {
        for (const img of nodeOutput.images) {
          images.push({
            filename: img.filename,
            subfolder: img.subfolder || '',
            type: img.type || 'output',
            url: `/api/output/files/${img.filename}`,
          })
        }
      }
    }

    // Fallback: if history outputs are empty (cached execution), scan output dir for new files
    if (images.length === 0) {
      // Wait a bit for file writes to settle
      await new Promise(r => setTimeout(r, 300))
      const newFiles = await findNewOutputFiles(beforeFiles)
      for (const filename of newFiles) {
        images.push({
          filename,
          subfolder: '',
          type: 'output',
          url: `/api/output/files/${filename}`,
        })
      }
    }

    log.info({ promptId, imageCount: images.length }, 'ComfyUI execution complete')
    res.json({ prompt_id: promptId, images, history: history[promptId] })
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Weave not found' })
    } else {
      next(err)
    }
  }
})

// --- n8n ---

/** Import an n8n workflow → save as .weave.json */
router.post('/n8n/import', async (req, res, next) => {
  try {
    await ensureDir()
    const weave = fromN8n(req.body)
    const filepath = path.join(GRAPHS_DIR, `${weave.id}.weave.json`)
    await fs.writeFile(filepath, serializeWeave(weave), 'utf-8')
    log.info({ id: weave.id, name: weave.name }, 'Imported n8n workflow')
    res.status(201).json({ id: weave.id, name: weave.name })
  } catch (err) {
    next(err)
  }
})

/** Export a saved weave → n8n format */
router.get('/n8n/export/:id', async (req, res, next) => {
  try {
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)
    res.json(toN8n(weave))
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Weave not found' })
    } else {
      next(err)
    }
  }
})

/** Push a weave to n8n as a new workflow */
router.post('/n8n/push/:id', async (req, res, next) => {
  try {
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)
    const n8nWorkflow = toN8n(weave)

    const client = new N8nClient({ apiKey: req.headers['x-n8n-api-key'] as string })
    const result = await client.createWorkflow(n8nWorkflow)
    log.info({ id: req.params.id, n8nId: result.id }, 'Pushed to n8n')
    res.json(result)
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Weave not found' })
    } else {
      next(err)
    }
  }
})

export { router as adaptersRouter }
