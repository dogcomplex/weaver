/**
 * AI Route — The Weaver's brain.
 *
 * POST /api/ai/chat — Streaming chat with Claude.
 * Claude gets the 17 graph tools + glamour tools as function calls.
 * Responses stream as SSE (Server-Sent Events).
 * Tool executions broadcast weave changes via WebSocket.
 */

import { Router, type Request, type Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import {
  toolCreateWeave,
  toolMark,
  toolThread,
  toolBranch,
  toolJoin,
  toolSpan,
  toolKnot,
  toolGate,
  toolVeil,
  toolReveal,
  toolSnip,
  toolCut,
  toolListWeaves,
} from '../agents/graph-tools.js'
import { LLMMetaphorEngine } from '../agents/metaphor-agent.js'
import type { AgentEmitter } from '../agents/agent-emitter.js'
import {
  createChatSession,
  appendChatMessage,
  loadChatSession,
  listChatSessions,
  createLociSession,
  type ChatSessionMessage,
} from '../agents/session-store.js'
import { generateManifestAssets, serverAssetResolver } from '../agents/asset-generator.js'
import { setActiveManifestId } from '../agents/loci-watcher.js'
import { broadcast } from '../index.js'
import { log } from '../logger.js'
import { deserializeWeave, serializeWeave } from '#weaver/core'
import { LoomTheme, weaveToSchema, buildKnotIdMap } from '#weaver/glamour'
import type { GlamourTheme, MetaphorManifest } from '#weaver/glamour'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')
const MANIFESTS_DIR = path.resolve(process.cwd(), 'data', 'manifests')

// ─── API Key Check ──────────────────────────────────────────────

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

// ─── Theme Resolution ───────────────────────────────────────────

const THEMES: Record<string, GlamourTheme> = {
  loom: LoomTheme,
}

function resolveTheme(themeId?: string): GlamourTheme | null {
  if (!themeId) return null
  return THEMES[themeId] ?? null
}

// ─── Tool Definitions for Claude ────────────────────────────────

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'weaver_create',
    description: 'Create a new empty weave with the given name. Returns the new weave.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the new weave' },
      },
      required: ['name'],
    },
  },
  {
    name: 'weaver_list',
    description: 'List all saved weaves. Returns array of {id, name}.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'weaver_load',
    description: 'Load a saved weave by ID. Returns the full weave data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID to load' },
      },
      required: ['weaveId'],
    },
  },
  {
    name: 'weaver_mark',
    description: 'Create a new knot (node) in the weave. Specify type, label, position, and optional data. For ComfyUI nodes, set comfyui_class_type in data and inputs with the node parameters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        type: { type: 'string', description: 'Knot type (e.g. KSampler, CLIPTextEncode)' },
        label: { type: 'string', description: 'Display label' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
        data: {
          type: 'object',
          description: 'Knot data. For ComfyUI: { comfyui_class_type: string, inputs: {...} }',
        },
      },
      required: ['weaveId', 'type', 'label', 'position'],
    },
  },
  {
    name: 'weaver_thread',
    description: 'Connect two knots with a thread (edge). Optionally include thread data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        source: { type: 'string', description: 'Source knot ID' },
        target: { type: 'string', description: 'Target knot ID' },
        label: { type: 'string', description: 'Optional thread label' },
        data: { type: 'object', description: 'Optional thread data (e.g. {type: "MODEL"})' },
      },
      required: ['weaveId', 'source', 'target'],
    },
  },
  {
    name: 'weaver_cut',
    description: 'Delete a knot and all its threads from the weave.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        knotId: { type: 'string', description: 'Knot ID to delete' },
      },
      required: ['weaveId', 'knotId'],
    },
  },
  {
    name: 'weaver_snip',
    description: 'Delete a thread (edge) from the weave.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        threadId: { type: 'string', description: 'Thread ID to delete' },
      },
      required: ['weaveId', 'threadId'],
    },
  },
  {
    name: 'weaver_branch',
    description: 'Connect one source knot to multiple target knots (fan-out).',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        source: { type: 'string', description: 'Source knot ID' },
        targets: { type: 'array', items: { type: 'string' }, description: 'Array of target knot IDs' },
      },
      required: ['weaveId', 'source', 'targets'],
    },
  },
  {
    name: 'weaver_join',
    description: 'Connect multiple source knots to one target knot (fan-in).',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        sources: { type: 'array', items: { type: 'string' }, description: 'Array of source knot IDs' },
        target: { type: 'string', description: 'Target knot ID' },
      },
      required: ['weaveId', 'sources', 'target'],
    },
  },
  {
    name: 'weaver_gate',
    description: 'Add a conditional gate to a thread. The gate expression is evaluated during trace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        threadId: { type: 'string', description: 'Thread ID' },
        expression: { type: 'string', description: 'Gate condition expression (e.g. "x > 5")' },
      },
      required: ['weaveId', 'threadId', 'expression'],
    },
  },
  {
    name: 'weaver_trace',
    description: 'Execute a trace on the weave starting from a knot. Returns the execution path and results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        startKnot: { type: 'string', description: 'Knot ID to start trace from' },
        payload: { type: 'object', description: 'Optional initial data payload' },
      },
      required: ['weaveId', 'startKnot'],
    },
  },
  {
    name: 'weaver_describe_weave',
    description: 'Get a metaphorical description of the current weave using the active glamour theme.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
      },
      required: ['weaveId'],
    },
  },
  {
    name: 'weaver_describe_knot',
    description: 'Get a metaphorical description of a specific knot using the active glamour theme.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        knotId: { type: 'string', description: 'Knot ID to describe' },
      },
      required: ['weaveId', 'knotId'],
    },
  },
  {
    name: 'weaver_suggest_metaphor',
    description: 'Use the Loci (metaphor engine) to propose and score metaphorical representations for a weave. Returns ranked MetaphorManifests with quality scores (1-10) on 5 criteria: explanatory power, truthfulness, completeness, intuitive interaction, and fractal consistency. Use this to find the best visual metaphor for a workflow.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID to generate metaphors for' },
        count: { type: 'number', description: 'Number of metaphor proposals (default: 3)' },
        purpose: { type: 'string', description: 'Human-readable description of what the workflow does' },
        audience: { type: 'string', description: 'Who is viewing: developer, designer, non-technical, mixed' },
      },
      required: ['weaveId'],
    },
  },
  {
    name: 'weaver_refine_metaphor',
    description: 'Refine an existing metaphor based on feedback. Pass the current MetaphorManifest and feedback text, get back an improved version with updated scores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        manifest: { type: 'object', description: 'The current MetaphorManifest to refine' },
        feedback: { type: 'string', description: 'What to improve about the current metaphor' },
      },
      required: ['manifest', 'feedback'],
    },
  },
  {
    name: 'weaver_inspect',
    description: 'Get the raw structural schema of a weave — knot types, parameter names (steps, cfg, seed, etc.), thread data types (MODEL, CLIP, LATENT, etc.), and full data keys. This is the same unfiltered data the Loci (metaphor engine) uses. Use this when you need to understand the technical structure beyond the glamour theme\'s narrative descriptions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID' },
        purpose: { type: 'string', description: 'Optional workflow purpose description (e.g. "generates images from text")' },
      },
      required: ['weaveId'],
    },
  },
  {
    name: 'weaver_activate_glamour',
    description: 'Activate a MetaphorManifest as the live glamour theme. Triggers asset generation for any uncached visuals via ComfyUI and switches the renderer to the new theme. The frontend will immediately show the manifest theme with color fallbacks, then hot-swap in generated images as they complete.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weaveId: { type: 'string', description: 'Weave ID to activate the glamour on' },
        manifestId: { type: 'string', description: 'ID of a previously generated manifest. If omitted, uses the most recently saved manifest.' },
      },
      required: ['weaveId'],
    },
  },
]

// ─── Manifest Storage ──────────────────────────────────────────

async function saveManifest(manifest: MetaphorManifest): Promise<void> {
  await fs.mkdir(MANIFESTS_DIR, { recursive: true })
  const filepath = path.join(MANIFESTS_DIR, `${manifest.id}.json`)
  await fs.writeFile(filepath, JSON.stringify(manifest, null, 2), 'utf-8')
  log.info({ manifestId: manifest.id, name: manifest.name }, 'Manifest saved')
}

async function loadManifest(manifestId: string): Promise<MetaphorManifest> {
  const filepath = path.join(MANIFESTS_DIR, `${manifestId}.json`)
  const content = await fs.readFile(filepath, 'utf-8')
  return JSON.parse(content)
}

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
        mtime: (await fs.stat(path.join(MANIFESTS_DIR, f))).mtime.getTime(),
      }))
    )
    stats.sort((a, b) => b.mtime - a.mtime)
    const content = await fs.readFile(path.join(MANIFESTS_DIR, stats[0].file), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/** Load all saved manifest names (for deduplication when proposing new metaphors) */
async function loadManifestNames(): Promise<string[]> {
  try {
    await fs.mkdir(MANIFESTS_DIR, { recursive: true })
    const files = await fs.readdir(MANIFESTS_DIR)
    const names: string[] = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const content = await fs.readFile(path.join(MANIFESTS_DIR, file), 'utf-8')
        const m = JSON.parse(content) as MetaphorManifest
        names.push(m.name)
      } catch { /* skip corrupt files */ }
    }
    return names
  } catch {
    return []
  }
}

// ─── Tool Executor ──────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, any>,
  themeId?: string,
  emitter?: (event: string, data: unknown) => void,
): Promise<string> {
  try {
    const theme = resolveTheme(themeId)

    switch (name) {
      case 'weaver_create': {
        const weave = await toolCreateWeave(input.name)
        broadcast({ type: 'graphChanged', weaveId: weave.id })
        return JSON.stringify({ success: true, weaveId: weave.id, name: weave.name })
      }
      case 'weaver_list': {
        const list = await toolListWeaves()
        return JSON.stringify(list)
      }
      case 'weaver_load': {
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        // Return a summary, not the full serialized weave (too large)
        const knots = Array.from(weave.knots.values()).map(k => ({
          id: k.id, type: k.type, label: k.label,
        }))
        const threads = Array.from(weave.threads.values()).map(t => ({
          id: t.id, source: t.source, target: t.target,
        }))
        return JSON.stringify({ id: weave.id, name: weave.name, knots, threads })
      }
      case 'weaver_mark': {
        const weave = await toolMark(input.weaveId, {
          type: input.type,
          label: input.label,
          position: input.position ?? { x: 0, y: 0 },
          data: input.data ?? {},
        })
        // Find the newly created knot (last one added)
        const newKnot = Array.from(weave.knots.values()).pop()
        broadcast({ type: 'graphChanged', weaveId: weave.id })
        return JSON.stringify({
          success: true,
          knotId: newKnot?.id,
          label: newKnot?.label,
          type: newKnot?.type,
        })
      }
      case 'weaver_thread': {
        const weave = await toolThread(input.weaveId, input.source, input.target, {
          label: input.label,
          data: input.data ?? {},
        })
        const newThread = Array.from(weave.threads.values()).pop()
        broadcast({ type: 'graphChanged', weaveId: weave.id })
        return JSON.stringify({
          success: true,
          threadId: newThread?.id,
          source: input.source,
          target: input.target,
        })
      }
      case 'weaver_cut': {
        await toolCut(input.weaveId, input.knotId)
        broadcast({ type: 'graphChanged', weaveId: input.weaveId })
        return JSON.stringify({ success: true, deleted: input.knotId })
      }
      case 'weaver_snip': {
        await toolSnip(input.weaveId, input.threadId)
        broadcast({ type: 'graphChanged', weaveId: input.weaveId })
        return JSON.stringify({ success: true, deleted: input.threadId })
      }
      case 'weaver_branch': {
        await toolBranch(input.weaveId, input.source, input.targets)
        broadcast({ type: 'graphChanged', weaveId: input.weaveId })
        return JSON.stringify({ success: true, source: input.source, targets: input.targets })
      }
      case 'weaver_join': {
        await toolJoin(input.weaveId, input.sources, input.target)
        broadcast({ type: 'graphChanged', weaveId: input.weaveId })
        return JSON.stringify({ success: true, sources: input.sources, target: input.target })
      }
      case 'weaver_gate': {
        await toolGate(input.weaveId, input.threadId, { expression: input.expression })
        broadcast({ type: 'graphChanged', weaveId: input.weaveId })
        return JSON.stringify({ success: true, threadId: input.threadId, expression: input.expression })
      }
      case 'weaver_trace': {
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        const { trace } = await import('#weaver/runtime')
        const result = trace(weave, input.startKnot, input.payload ?? {})
        return JSON.stringify({ success: true, steps: result.steps.length, result })
      }
      case 'weaver_describe_weave': {
        if (!theme) return JSON.stringify({ description: 'No active theme' })
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        return JSON.stringify({ description: theme.describeWeave(weave) })
      }
      case 'weaver_describe_knot': {
        if (!theme) return JSON.stringify({ description: 'No active theme' })
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        const knot = weave.knots.get(input.knotId)
        if (!knot) return JSON.stringify({ error: 'Knot not found' })
        return JSON.stringify({ description: theme.describeKnot(knot, weave) })
      }
      case 'weaver_suggest_metaphor': {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) return JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' })
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        const schema = weaveToSchema(weave, input.purpose)
        if (input.audience) {
          schema.context = { audience: input.audience }
        }
        // Load existing manifest names so Loci avoids duplicates
        const existingNames = await loadManifestNames()

        // Build AgentEmitter that pipes to SSE stream
        const lociEmitter: AgentEmitter = {
          progress: (evt) => emitter?.('agent_progress', { agentName: 'loci', ...evt }),
          result: (evt) => emitter?.('agent_result', { agentName: 'loci', ...evt }),
          prompt: (evt) => emitter?.('agent_prompt', { agentName: 'loci', ...evt }),
        }
        emitter?.('agent_start', { agentName: 'loci', operation: 'propose', detail: `Proposing ${input.count ?? 3} metaphors via Sonnet...` })

        const engine = new LLMMetaphorEngine(apiKey, {}, input.weaveId)
        const manifests = await engine.propose(schema, input.count ?? 3, existingNames, lociEmitter)

        emitter?.('agent_complete', { agentName: 'loci', operation: 'propose', summary: `${manifests.length} metaphors proposed. Top: "${manifests[0]?.name}" (${manifests[0]?.scores.overall.toFixed(1)}/10)` })
        // Persist each manifest for later activation
        for (const m of manifests) {
          await saveManifest(m).catch(err =>
            log.warn({ err, manifestId: m.id }, 'Failed to save manifest')
          )
        }
        return JSON.stringify({
          count: manifests.length,
          manifests: manifests.map(m => ({
            id: m.id,
            name: m.name,
            score: m.scores.overall,
            rationale: m.scores.rationale,
            mappings: m.mappings.map(mp => `${mp.knotType} → ${mp.metaphorElement} (${mp.label})`),
            sceneDescription: m.sceneDescription,
          })),
          fullManifests: manifests,
        })
      }
      case 'weaver_refine_metaphor': {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) return JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' })

        const refineEmitter: AgentEmitter = {
          progress: (evt) => emitter?.('agent_progress', { agentName: 'loci', ...evt }),
          result: (evt) => emitter?.('agent_result', { agentName: 'loci', ...evt }),
          prompt: (evt) => emitter?.('agent_prompt', { agentName: 'loci', ...evt }),
        }
        emitter?.('agent_start', { agentName: 'loci', operation: 'refine', detail: `Refining "${input.manifest?.name}"...` })

        const engine = new LLMMetaphorEngine(apiKey, {}, input.manifest?.id)
        const refined = await engine.refine(input.manifest, input.feedback, refineEmitter)

        emitter?.('agent_complete', { agentName: 'loci', operation: 'refine', summary: `Refined to ${refined.scores.overall.toFixed(1)}/10` })
        // Persist refined manifest
        await saveManifest(refined).catch(err =>
          log.warn({ err, manifestId: refined.id }, 'Failed to save refined manifest')
        )
        return JSON.stringify({
          name: refined.name,
          score: refined.scores.overall,
          rationale: refined.scores.rationale,
          fullManifest: refined,
        })
      }
      case 'weaver_inspect': {
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        const schema = weaveToSchema(weave, input.purpose)
        return JSON.stringify({
          weaveId: weave.id,
          weaveName: weave.name,
          schema,
        })
      }
      case 'weaver_activate_glamour': {
        // Load manifest
        let manifest: MetaphorManifest | null = null
        if (input.manifestId) {
          manifest = await loadManifest(input.manifestId)
        } else {
          manifest = await loadLatestManifest()
        }
        if (!manifest) {
          return JSON.stringify({ error: 'No manifest found. Use weaver_suggest_metaphor first to generate one.' })
        }

        // Load weave and build knotIdMap
        const filepath = path.join(GRAPHS_DIR, `${input.weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        const knotIdMap = buildKnotIdMap(weave)

        // Queue asset generation for uncached visuals
        emitter?.('agent_start', { agentName: 'asset-generator', operation: 'generate', detail: `Generating assets for "${manifest.name}"...` })
        let pendingAssets = 0
        try {
          const assetResults = await generateManifestAssets(manifest, knotIdMap, (assetEvt) => {
            emitter?.('asset_queued', assetEvt)
          })
          pendingAssets = assetResults.filter(r => r.pending).length
          emitter?.('agent_complete', { agentName: 'asset-generator', operation: 'generate', summary: `${assetResults.length} assets total, ${pendingAssets} queued for generation` })
        } catch (err: any) {
          log.warn({ err }, 'Asset generation failed (ComfyUI may not be running)')
        }

        // Broadcast theme change to frontend
        broadcast({
          type: 'glamour-theme-changed',
          manifestId: manifest.id,
          manifest,
        })

        log.info({ manifestId: manifest.id, name: manifest.name, pendingAssets }, 'Glamour activated')
        setActiveManifestId(manifest.id)

        return JSON.stringify({
          success: true,
          themeId: manifest.id,
          themeName: manifest.name,
          pendingAssets,
          message: pendingAssets > 0
            ? `Glamour "${manifest.name}" activated. ${pendingAssets} asset(s) generating via ComfyUI — they will appear as they complete.`
            : `Glamour "${manifest.name}" activated with all assets ready.`,
        })
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Tool execution failed' })
  }
}

// ─── System Prompt Builder ──────────────────────────────────────

function buildSystemPrompt(theme: GlamourTheme | null, weaveContext?: string): string {
  const parts: string[] = [
    'You are Weaver\'s AI assistant. You help users build, understand, and interact with visual workflows.',
    'Weaver is a visual graph programming platform where workflows are made of knots (nodes) connected by threads (edges).',
    'Waves carry data through the graph during execution (trace).',
    '',
    'You have tools to create, modify, and inspect weaves:',
    '- Create weaves, mark knots, thread connections, cut/snip to delete',
    '- Branch (fan-out) and join (fan-in) for complex topologies',
    '- Gate threads with conditional expressions',
    '- Trace execution paths through the graph',
    '',
    'For ComfyUI image generation workflows, set knot data like:',
    '  data: { comfyui_class_type: "KSampler", inputs: { seed: 42, steps: 20, cfg: 7.5, sampler_name: "euler", scheduler: "normal", denoise: 1 } }',
    '',
    'Common ComfyUI knot types: CheckpointLoaderSimple, CLIPTextEncode, KSampler, VAEDecode, SaveImage, EmptyLatentImage',
  ]

  if (theme) {
    parts.push('')
    parts.push(`The current view uses the "${theme.name}" glamour theme.`)
    parts.push(theme.aiSystemPrompt)
    parts.push('')
    parts.push('Use the describe tools to see the workflow in metaphorical terms.')
  }

  if (weaveContext) {
    parts.push('')
    parts.push('Current weave context:')
    parts.push(weaveContext)
  }

  return parts.join('\n')
}

// ─── Chat Endpoint (SSE Streaming) ──────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

router.post('/chat', async (req: Request, res: Response) => {
  const client = getClient()
  if (!client) {
    res.status(501).json({
      error: 'AI not configured',
      message: 'Set the ANTHROPIC_API_KEY environment variable to enable AI chat.',
    })
    return
  }

  const { messages, weaveId, themeId, sessionId: incomingSessionId } = req.body as {
    messages: ChatMessage[]
    weaveId?: string
    themeId?: string
    sessionId?: string
  }

  if (!messages?.length) {
    res.status(400).json({ error: 'No messages provided' })
    return
  }

  // Session management: create or reuse
  let sessionId = incomingSessionId
  try {
    if (sessionId) {
      // Validate existing session
      await loadChatSession(sessionId)
    } else if (weaveId) {
      // Create new session
      const session = await createChatSession(weaveId, themeId)
      sessionId = session.id
    }
  } catch {
    // Session not found — create a new one
    if (weaveId) {
      const session = await createChatSession(weaveId, themeId)
      sessionId = session.id
    }
  }

  // Persist the latest user message
  const lastUserMsg = messages[messages.length - 1]
  if (sessionId && lastUserMsg?.role === 'user') {
    await appendChatMessage(sessionId, {
      role: 'user',
      content: lastUserMsg.content,
      timestamp: new Date().toISOString(),
    }).catch(err => log.warn({ err }, 'Failed to persist user message'))
  }

  // Build context
  const theme = resolveTheme(themeId)
  let weaveContext: string | undefined
  if (weaveId) {
    try {
      const filepath = path.join(GRAPHS_DIR, `${weaveId}.weave.json`)
      const content = await fs.readFile(filepath, 'utf-8')
      const weave = deserializeWeave(content)
      const schema = weaveToSchema(weave)
      weaveContext = `Weave "${weave.name}" (${weave.id}): ${schema.knots.length} knots, ${schema.threads.length} threads`
      if (schema.knots.length > 0) {
        weaveContext += '\nKnots: ' + schema.knots.map(k => `${k.label} (${k.type})`).join(', ')
      }
    } catch {
      // Weave not found — proceed without context
    }
  }

  const systemPrompt = buildSystemPrompt(theme, weaveContext)

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const sendSSE = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Send session ID to frontend immediately
  if (sessionId) {
    sendSSE('session_start', { sessionId })
  }

  try {
    // Build Anthropic messages (convert our format to theirs)
    let anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Track full response for session persistence
    let fullAssistantText = ''
    const allToolCalls: Array<{ name: string; input: any; result: any }> = []

    // Agentic loop: keep calling until no more tool_use
    let continueLoop = true
    while (continueLoop) {
      continueLoop = false

      const stream = await client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: TOOL_DEFINITIONS,
      })

      let currentText = ''
      const toolCalls: Array<{ id: string; name: string; input: any }> = []
      const rawInputs = new Map<string, string>()

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            // Text block starting
          } else if (event.content_block.type === 'tool_use') {
            toolCalls.push({
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            })
            sendSSE('tool_use', {
              id: event.content_block.id,
              name: event.content_block.name,
            })
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            currentText += event.delta.text
            sendSSE('text_delta', { text: event.delta.text })
          } else if (event.delta.type === 'input_json_delta') {
            // Accumulate tool input JSON fragments
            const lastTool = toolCalls[toolCalls.length - 1]
            if (lastTool) {
              const prev = rawInputs.get(lastTool.id) ?? ''
              rawInputs.set(lastTool.id, prev + event.delta.partial_json)
            }
          }
        } else if (event.type === 'message_delta') {
          // Check stop reason
          if (event.delta.stop_reason === 'tool_use') {
            continueLoop = true
          }
        }
      }

      // If there were tool calls, execute them and continue
      if (toolCalls.length > 0) {
        // Parse accumulated tool inputs
        for (const tc of toolCalls) {
          try {
            tc.input = JSON.parse(rawInputs.get(tc.id) || '{}')
          } catch {
            tc.input = {}
          }
        }

        // Build the assistant message with tool_use blocks
        const assistantContent: Anthropic.ContentBlockParam[] = []
        if (currentText) {
          assistantContent.push({ type: 'text', text: currentText })
        }
        for (const tc of toolCalls) {
          assistantContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input,
          })
        }

        anthropicMessages = [
          ...anthropicMessages,
          { role: 'assistant', content: assistantContent },
        ]

        // Execute each tool and build tool_result messages
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const tc of toolCalls) {
          log.info({ tool: tc.name, input: tc.input }, 'Executing tool')
          const result = await executeTool(tc.name, tc.input, themeId, (event, data) => sendSSE(event, { ...data as object, toolCallId: tc.id }))
          const parsedResult = JSON.parse(result)
          sendSSE('tool_result', {
            id: tc.id,
            name: tc.name,
            input: tc.input,
            result: parsedResult,
          })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: result,
          })
          // Track for session persistence
          allToolCalls.push({ name: tc.name, input: tc.input, result: parsedResult })
        }

        anthropicMessages.push({ role: 'user', content: toolResults })
      }

      // Accumulate text across agentic loops
      fullAssistantText += currentText
    }

    // Persist assistant response to session
    if (sessionId && fullAssistantText) {
      await appendChatMessage(sessionId, {
        role: 'assistant',
        content: fullAssistantText,
        timestamp: new Date().toISOString(),
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      }).catch(err => log.warn({ err }, 'Failed to persist assistant message'))
    }

    sendSSE('done', { status: 'complete', sessionId })
  } catch (err: any) {
    log.error({ err }, 'AI chat error')
    sendSSE('error', { message: err.message ?? 'AI request failed' })
  } finally {
    res.end()
  }
})

// ─── Health Check ───────────────────────────────────────────────

router.get('/status', (_req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  res.json({
    configured: hasKey,
    model: 'claude-sonnet-4-20250514',
    tools: TOOL_DEFINITIONS.length,
  })
})

// ─── Session Endpoints ──────────────────────────────────────────

router.get('/sessions', async (_req, res) => {
  try {
    const sessions = await listChatSessions()
    res.json(sessions)
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to list sessions' })
  }
})

router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await loadChatSession(req.params.id)
    res.json(session)
  } catch (err: any) {
    res.status(404).json({ error: err.message ?? 'Session not found' })
  }
})

// ─── Glamour Asset Endpoints ────────────────────────────────────

router.get('/glamour/assets', (_req, res) => {
  const allAssets = serverAssetResolver.getAll()
  const result: Record<string, { type: string; url: string; hash: string }> = {}
  for (const [key, asset] of allAssets) {
    result[key] = { type: asset.type, url: asset.url, hash: asset.hash }
  }
  res.json(result)
})

router.get('/glamour/assets/:hash', async (req, res) => {
  const hash = req.params.hash
  const assetPath = path.join(process.cwd(), 'data', 'output', 'glamour-assets', `${hash}.png`)
  try {
    await fs.access(assetPath)
    res.json({ exists: true, url: `/api/output/glamour-assets/${hash}.png` })
  } catch {
    res.json({ exists: false })
  }
})

// ─── Manifest Endpoints ─────────────────────────────────────────

router.get('/glamour/manifests', async (_req, res) => {
  try {
    await fs.mkdir(MANIFESTS_DIR, { recursive: true })
    const files = await fs.readdir(MANIFESTS_DIR)
    const manifests = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const content = await fs.readFile(path.join(MANIFESTS_DIR, file), 'utf-8')
        const m = JSON.parse(content) as MetaphorManifest
        const cached = serverAssetResolver.has(`scene-bg_${m.id}`)
        manifests.push({ id: m.id, name: m.name, score: m.scores.overall, cached })
      } catch { /* skip corrupt files */ }
    }
    res.json(manifests)
  } catch {
    res.json([])
  }
})

router.get('/glamour/manifests/:id', async (req, res) => {
  try {
    const manifest = await loadManifest(req.params.id)
    res.json(manifest)
  } catch {
    res.status(404).json({ error: 'Manifest not found' })
  }
})

/**
 * POST /api/ai/glamour/manifests/:id/activate
 * Direct theme activation endpoint — bypasses AI chat.
 * Loads the manifest, optionally generates assets, broadcasts to frontend.
 */
router.post('/glamour/manifests/:id/activate', async (req, res) => {
  try {
    const manifest = await loadManifest(req.params.id)
    const weaveId = req.body?.weaveId as string | undefined

    // If a weaveId is provided, generate assets
    let pendingAssets = 0
    if (weaveId) {
      try {
        const filepath = path.join(GRAPHS_DIR, `${weaveId}.weave.json`)
        const content = await fs.readFile(filepath, 'utf-8')
        const weave = deserializeWeave(content)
        const knotIdMap = buildKnotIdMap(weave)
        const assetResults = await generateManifestAssets(manifest, knotIdMap)
        pendingAssets = assetResults.filter(r => r.pending).length
      } catch (err: any) {
        log.warn({ err }, 'Asset generation failed during direct activation')
      }
    }

    // Broadcast theme change to frontend
    broadcast({
      type: 'glamour-theme-changed',
      manifestId: manifest.id,
      manifest,
    })

    log.info({ manifestId: manifest.id, name: manifest.name, pendingAssets }, 'Glamour activated (direct)')
    setActiveManifestId(manifest.id)

    res.json({
      success: true,
      themeId: manifest.id,
      themeName: manifest.name,
      pendingAssets,
    })
  } catch (err: any) {
    res.status(404).json({ error: err.message ?? 'Failed to activate manifest' })
  }
})

/**
 * POST /api/ai/glamour/manifests/deactivate
 * Deactivate the current glamour theme, reverting to default LoomTheme.
 */
router.post('/glamour/manifests/deactivate', async (_req, res) => {
  broadcast({
    type: 'glamour-theme-changed',
    manifestId: null,
    manifest: null,
  })
  log.info('Glamour deactivated — reverted to LoomTheme')
  setActiveManifestId(null)
  res.json({ success: true })
})

/**
 * DELETE /api/ai/glamour/manifests
 * Delete ALL saved manifest files and deactivate any active theme.
 */
router.delete('/glamour/manifests', async (_req, res) => {
  try {
    const entries = await fs.readdir(MANIFESTS_DIR).catch(() => [] as string[])
    const jsonFiles = entries.filter(f => f.endsWith('.json'))
    let deleted = 0
    for (const file of jsonFiles) {
      try {
        await fs.unlink(path.join(MANIFESTS_DIR, file))
        deleted++
      } catch {
        // skip files that vanished between readdir and unlink
      }
    }
    // Deactivate any active theme
    broadcast({
      type: 'glamour-theme-changed',
      manifestId: null,
      manifest: null,
    })
    setActiveManifestId(null)
    log.info({ deleted }, 'All manifests deleted — reverted to LoomTheme')
    res.json({ success: true, deleted })
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to delete manifests' })
  }
})

/**
 * DELETE /api/ai/glamour/manifests/:id
 * Delete a saved manifest file.
 */
router.delete('/glamour/manifests/:id', async (req, res) => {
  try {
    const filepath = path.join(MANIFESTS_DIR, `${req.params.id}.json`)
    await fs.unlink(filepath)
    log.info({ manifestId: req.params.id }, 'Manifest deleted')
    res.json({ success: true })
  } catch (err: any) {
    res.status(404).json({ error: err.message ?? 'Manifest not found' })
  }
})

export { router as aiRouter }
