import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'

const router = Router()
const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')

/** Ensure graphs directory exists */
async function ensureDir(): Promise<void> {
  await fs.mkdir(GRAPHS_DIR, { recursive: true })
}

/** List all .weave.json files */
router.get('/', async (_req, res, next) => {
  try {
    await ensureDir()
    const files = await fs.readdir(GRAPHS_DIR)
    const weaveFiles = files.filter((f) => f.endsWith('.weave.json'))
    const graphs = await Promise.all(
      weaveFiles.map(async (filename) => {
        const content = await fs.readFile(path.join(GRAPHS_DIR, filename), 'utf-8')
        const data = JSON.parse(content)
        return {
          id: data.id,
          name: data.name,
          filename,
          modified: data.metadata?.modified,
        }
      })
    )
    res.json(graphs)
  } catch (err) {
    next(err)
  }
})

/** Get a specific graph by id */
router.get('/:id', async (req, res, next) => {
  try {
    await ensureDir()
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    res.json(JSON.parse(content))
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: `Weave "${req.params.id}" not found` })
    } else {
      next(err)
    }
  }
})

/** Create a new graph */
router.post('/', async (req, res, next) => {
  try {
    await ensureDir()
    const data = req.body
    if (!data.id) {
      res.status(400).json({ error: 'Missing id field' })
      return
    }
    const filepath = path.join(GRAPHS_DIR, `${data.id}.weave.json`)
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8')
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

/** Update an existing graph */
router.put('/:id', async (req, res, next) => {
  try {
    await ensureDir()
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    const data = req.body
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8')
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/** Delete a graph */
router.delete('/:id', async (req, res, next) => {
  try {
    const filepath = path.join(GRAPHS_DIR, `${req.params.id}.weave.json`)
    await fs.unlink(filepath)
    res.status(204).send()
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: `Weave "${req.params.id}" not found` })
    } else {
      next(err)
    }
  }
})

export { router as graphsRouter }
