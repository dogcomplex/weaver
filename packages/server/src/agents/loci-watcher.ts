/**
 * Loci Watcher — Background reevaluation loop.
 *
 * Monitors graph changes and triggers the Loci (MetaphorEngine) to
 * reevaluate the active manifest's scores when the weave evolves.
 *
 * Flow:
 *   1. File watcher broadcasts `graph:changed` → watcher receives it
 *   2. Debounce 3s (user may be making rapid edits)
 *   3. Load the changed weave and convert to WeaveSchema
 *   4. Load the latest manifest (if any)
 *   5. Call engine.reevaluate(manifest, newSchema)
 *   6. Compare new scores to old — broadcast if changed
 *   7. If score drops below threshold, log warning
 *
 * The watcher runs passively — it never regenerates manifests or assets,
 * only reevaluates scores and broadcasts updates.
 */

import fs from 'fs/promises'
import path from 'path'
import { log } from '../logger.js'
import { LLMMetaphorEngine } from './metaphor-agent.js'
import { deserializeWeave } from '#weaver/core'
import { weaveToSchema } from '#weaver/glamour'
import type { MetaphorManifest, MetaphorScores } from '#weaver/glamour'

const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')
const MANIFESTS_DIR = path.resolve(process.cwd(), 'data', 'manifests')

/** How long to wait after a graph change before reevaluating (ms) */
const DEBOUNCE_MS = 3000

/** Score drop threshold — warn if overall score drops by this much */
const SCORE_DROP_THRESHOLD = 1.5

// ─── State ───────────────────────────────────────────────────────

let engine: LLMMetaphorEngine | null = null
let broadcastFn: ((data: unknown) => void) | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let activeManifestId: string | null = null

// ─── Setup ───────────────────────────────────────────────────────

/**
 * Initialize the Loci watcher.
 * Call this once at server startup with the broadcast function.
 */
export function setupLociWatcher(broadcast: (data: unknown) => void): void {
  broadcastFn = broadcast

  // Only create engine if API key is available
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    log.info('Loci watcher disabled — no ANTHROPIC_API_KEY set')
    return
  }

  engine = new LLMMetaphorEngine(apiKey, {})
  log.info('Loci watcher initialized — will reevaluate on graph changes (Haiku for maintenance)')
}

/**
 * Notify the watcher that a graph changed.
 * Debounces to avoid rapid re-evaluations during editing.
 */
export function notifyGraphChanged(filename: string): void {
  if (!engine || !broadcastFn) return

  // Clear previous debounce
  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    reevaluateIfActive(filename).catch(err => {
      log.warn({ err, filename }, 'Loci watcher reevaluation failed')
    })
  }, DEBOUNCE_MS)
}

/**
 * Set the actively displayed manifest ID.
 * The watcher only reevaluates when there's an active manifest.
 */
export function setActiveManifestId(manifestId: string | null): void {
  activeManifestId = manifestId
}

// ─── Core Logic ──────────────────────────────────────────────────

async function reevaluateIfActive(filename: string): Promise<void> {
  if (!engine || !broadcastFn) return

  // Only reevaluate if there's an active manifest
  if (!activeManifestId) {
    // Try loading the latest manifest as fallback
    const latest = await loadLatestManifest()
    if (!latest) return
    activeManifestId = latest.id
  }

  // Load the manifest
  let manifest: MetaphorManifest
  try {
    const content = await fs.readFile(path.join(MANIFESTS_DIR, `${activeManifestId}.json`), 'utf-8')
    manifest = JSON.parse(content) as MetaphorManifest
  } catch {
    log.debug({ manifestId: activeManifestId }, 'Loci watcher: active manifest not found, skipping')
    return
  }

  // Load the changed weave
  const weaveId = filename.replace('.weave.json', '')
  let schema
  try {
    const filepath = path.join(GRAPHS_DIR, filename)
    const content = await fs.readFile(filepath, 'utf-8')
    const weave = deserializeWeave(content)
    schema = weaveToSchema(weave)
  } catch {
    log.debug({ filename }, 'Loci watcher: could not load/parse weave, skipping')
    return
  }

  // Reevaluate
  log.info({ manifestId: activeManifestId, weaveId }, 'Loci watcher: reevaluating...')

  const oldScores = manifest.scores
  let newScores: MetaphorScores

  try {
    newScores = await engine.reevaluate(manifest, schema)
  } catch (err: any) {
    log.warn({ err }, 'Loci watcher: reevaluation API call failed')
    return
  }

  // Compare scores
  const scoreDelta = newScores.overall - oldScores.overall
  const changed = Math.abs(scoreDelta) >= 0.3

  log.info({
    manifestId: activeManifestId,
    oldScore: oldScores.overall,
    newScore: newScores.overall,
    delta: scoreDelta.toFixed(2),
    changed,
  }, 'Loci watcher: reevaluation complete')

  // Broadcast score update to frontend
  if (changed) {
    broadcastFn({
      type: 'glamour-scores-updated',
      manifestId: activeManifestId,
      scores: newScores,
      previousOverall: oldScores.overall,
      delta: scoreDelta,
    })

    // Update manifest file with new scores
    manifest.scores = newScores
    try {
      await fs.writeFile(
        path.join(MANIFESTS_DIR, `${activeManifestId}.json`),
        JSON.stringify(manifest, null, 2),
      )
    } catch {
      log.warn('Loci watcher: failed to save updated manifest scores')
    }
  }

  // Warn if score dropped significantly
  if (scoreDelta < -SCORE_DROP_THRESHOLD) {
    log.warn({
      manifestId: activeManifestId,
      drop: Math.abs(scoreDelta).toFixed(1),
      newOverall: newScores.overall,
    }, 'Loci watcher: significant score drop — consider regenerating theme')

    broadcastFn({
      type: 'glamour-score-warning',
      manifestId: activeManifestId,
      message: `Theme "${manifest.name}" score dropped by ${Math.abs(scoreDelta).toFixed(1)} — the workflow has changed significantly. Consider asking the AI to suggest a new theme.`,
      newScore: newScores.overall,
    })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function loadLatestManifest(): Promise<MetaphorManifest | null> {
  try {
    await fs.mkdir(MANIFESTS_DIR, { recursive: true })
    const files = await fs.readdir(MANIFESTS_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    if (jsonFiles.length === 0) return null

    // Sort by modification time, newest first
    const stats = await Promise.all(
      jsonFiles.map(async f => ({
        file: f,
        mtime: (await fs.stat(path.join(MANIFESTS_DIR, f))).mtimeMs,
      }))
    )
    stats.sort((a, b) => b.mtime - a.mtime)

    const content = await fs.readFile(path.join(MANIFESTS_DIR, stats[0].file), 'utf-8')
    return JSON.parse(content) as MetaphorManifest
  } catch {
    return null
  }
}
