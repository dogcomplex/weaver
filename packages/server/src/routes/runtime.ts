import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { deserializeWeave } from '#weaver/core'
import { trace } from '#weaver/runtime'

const router = Router()
const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')

/** Execute a trace on a saved weave */
router.post('/trace', async (req, res, next) => {
  try {
    const { weaveId, startKnot, payload, maxSteps } = req.body

    if (!weaveId || !startKnot) {
      res.status(400).json({ error: 'Missing weaveId or startKnot' })
      return
    }

    const filepath = path.join(GRAPHS_DIR, `${weaveId}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)

    const result = trace(weave, startKnot, payload ?? {}, {
      maxSteps: maxSteps ?? 1000,
    })

    res.json(result)
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: `Weave not found` })
    } else {
      next(err)
    }
  }
})

export { router as runtimeRouter }
