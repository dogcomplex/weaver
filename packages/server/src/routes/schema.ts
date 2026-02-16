import { Router } from 'express'
import { readLayout, writeLayout, patchLayout } from '../agents/ui-schema.js'

const router = Router()

/** Read the current UI layout schema */
router.get('/layout', async (_req, res, next) => {
  try {
    const layout = await readLayout()
    res.json(layout)
  } catch (err) {
    next(err)
  }
})

/** Replace the UI layout schema */
router.put('/layout', async (req, res, next) => {
  try {
    const layout = req.body
    await writeLayout(layout)
    res.json(layout)
  } catch (err) {
    next(err)
  }
})

/** Patch the UI layout schema (partial update) */
router.patch('/layout', async (req, res, next) => {
  try {
    const updated = await patchLayout(req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export { router as schemaRouter }
