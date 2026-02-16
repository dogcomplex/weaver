import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import {
  createWeave,
  mark,
  thread,
  branch,
  join,
  span,
  knot,
  gate,
  veil,
  reveal,
  snip,
  cut,
  serializeWeave,
  deserializeWeave,
  toSerialized,
  type Weave,
} from '#weaver/core'
import { trace } from '#weaver/runtime'
import { weaveStore } from './store.js'

/** Serialize a Weave to a JSON-friendly summary for tool responses */
function weaveResponse(weave: Weave): string {
  return JSON.stringify(toSerialized(weave), null, 2)
}

export function registerWeaveTools(server: McpServer): void {
  // --- Weave lifecycle ---

  server.registerTool(
    'weaver_create',
    {
      description: 'Create a new empty Weave graph and save it to disk',
      inputSchema: {
        name: z.string().describe('Name for the new weave'),
      },
    },
    async ({ name }) => {
      const weave = createWeave(name)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Created weave "${name}" (id: ${weave.id})\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_list',
    {
      description: 'List all saved Weave graphs',
    },
    async () => {
      const list = await weaveStore.list()
      return {
        content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
      }
    }
  )

  server.registerTool(
    'weaver_load',
    {
      description: 'Load a saved Weave graph by ID',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave to load'),
      },
    },
    async ({ weaveId }) => {
      const weave = await weaveStore.load(weaveId)
      return {
        content: [{ type: 'text', text: weaveResponse(weave) }],
      }
    }
  )

  server.registerTool(
    'weaver_save',
    {
      description: 'Save a Weave graph (provide full serialized weave JSON)',
      inputSchema: {
        weaveJson: z.string().describe('Full serialized Weave JSON string'),
      },
    },
    async ({ weaveJson }) => {
      const weave = deserializeWeave(weaveJson)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Saved weave "${weave.name}" (id: ${weave.id})` }],
      }
    }
  )

  // --- Knot operations ---

  server.registerTool(
    'weaver_mark',
    {
      description: 'Mark (create) a new Knot in a Weave',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        label: z.string().describe('Label for the knot'),
        knotId: z.string().optional().describe('Optional explicit ID for the knot'),
        type: z.string().optional().describe('Knot type (default: "default")'),
        x: z.number().optional().describe('X position'),
        y: z.number().optional().describe('Y position'),
        data: z.record(z.string(), z.unknown()).optional().describe('Arbitrary data for the knot'),
      },
    },
    async ({ weaveId, label, knotId, type, x, y, data }) => {
      let weave = await weaveStore.load(weaveId)
      weave = mark(weave, {
        label,
        id: knotId,
        type,
        position: x !== undefined || y !== undefined ? { x: x ?? 0, y: y ?? 0 } : undefined,
        data,
      })
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Marked knot "${label}" in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_cut',
    {
      description: 'Cut (remove) a Knot and all its connected Threads from a Weave',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        knotId: z.string().describe('ID of the knot to remove'),
      },
    },
    async ({ weaveId, knotId }) => {
      let weave = await weaveStore.load(weaveId)
      weave = cut(weave, knotId)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Cut knot "${knotId}" from weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  // --- Thread operations ---

  server.registerTool(
    'weaver_thread',
    {
      description: 'Thread (connect) two Knots with an edge',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        source: z.string().describe('Source knot ID'),
        target: z.string().describe('Target knot ID'),
        threadId: z.string().optional().describe('Optional explicit ID for the thread'),
        label: z.string().optional().describe('Optional label for the thread'),
      },
    },
    async ({ weaveId, source, target, threadId, label }) => {
      let weave = await weaveStore.load(weaveId)
      weave = thread(weave, source, target, {
        id: threadId,
        label: label,
      })
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Threaded ${source} → ${target} in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_snip',
    {
      description: 'Snip (remove) a Thread from a Weave',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        threadId: z.string().describe('ID of the thread to remove'),
      },
    },
    async ({ weaveId, threadId }) => {
      let weave = await weaveStore.load(weaveId)
      weave = snip(weave, threadId)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Snipped thread "${threadId}" from weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  // --- Flow operations ---

  server.registerTool(
    'weaver_branch',
    {
      description: 'Branch (fork) from one Knot to multiple target Knots',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        source: z.string().describe('Source knot ID'),
        targets: z.array(z.string()).describe('Array of target knot IDs'),
      },
    },
    async ({ weaveId, source, targets }) => {
      let weave = await weaveStore.load(weaveId)
      weave = branch(weave, source, targets)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Branched ${source} → [${targets.join(', ')}] in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_join',
    {
      description: 'Join (merge) multiple Knots into one target Knot',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        sources: z.array(z.string()).describe('Array of source knot IDs'),
        target: z.string().describe('Target knot ID'),
      },
    },
    async ({ weaveId, sources, target }) => {
      let weave = await weaveStore.load(weaveId)
      weave = join(weave, sources, target)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Joined [${sources.join(', ')}] → ${target} in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_span',
    {
      description: 'Span (bridge) two disconnected Knots',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        source: z.string().describe('Source knot ID'),
        target: z.string().describe('Target knot ID'),
      },
    },
    async ({ weaveId, source, target }) => {
      let weave = await weaveStore.load(weaveId)
      weave = span(weave, source, target)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Spanned ${source} → ${target} in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_knot',
    {
      description: 'Knot (close a cycle) by connecting two Knots that form a loop',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        source: z.string().describe('Source knot ID'),
        target: z.string().describe('Target knot ID (should already have a path to source)'),
      },
    },
    async ({ weaveId, source, target }) => {
      let weave = await weaveStore.load(weaveId)
      weave = knot(weave, source, target)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Knotted ${source} → ${target} (cycle) in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  // --- Gate ---

  server.registerTool(
    'weaver_gate',
    {
      description: 'Gate (add condition) to a Thread. The expression is evaluated against the Wave payload at runtime.',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        threadId: z.string().describe('ID of the thread to gate'),
        expression: z.string().describe('Gate expression evaluated against wave payload (e.g. "x > 5", "status == active")'),
        fallback: z.string().optional().describe('Optional fallback knot ID if gate blocks'),
      },
    },
    async ({ weaveId, threadId, expression, fallback }) => {
      let weave = await weaveStore.load(weaveId)
      weave = gate(weave, threadId, { expression, fallback })
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Gated thread "${threadId}" with "${expression}" in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  // --- Abstraction ---

  server.registerTool(
    'weaver_veil',
    {
      description: 'Veil (abstract) a group of Knots into a single composite Knot',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        knotIds: z.array(z.string()).describe('Array of knot IDs to veil into a composite'),
      },
    },
    async ({ weaveId, knotIds }) => {
      let weave = await weaveStore.load(weaveId)
      weave = veil(weave, knotIds)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Veiled [${knotIds.join(', ')}] in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  server.registerTool(
    'weaver_reveal',
    {
      description: 'Reveal (expand) a veiled composite Knot back into its original Knots',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        compositeKnotId: z.string().describe('ID of the veiled composite knot to expand'),
      },
    },
    async ({ weaveId, compositeKnotId }) => {
      let weave = await weaveStore.load(weaveId)
      weave = reveal(weave, compositeKnotId)
      await weaveStore.save(weave)
      return {
        content: [{ type: 'text', text: `Revealed composite "${compositeKnotId}" in weave "${weave.name}"\n${weaveResponse(weave)}` }],
      }
    }
  )

  // --- Execution ---

  server.registerTool(
    'weaver_trace',
    {
      description: 'Trace (execute) a path through a Weave, flowing a Wave from a start Knot',
      inputSchema: {
        weaveId: z.string().describe('ID of the weave'),
        startKnot: z.string().describe('ID of the knot to start from'),
        payload: z.record(z.string(), z.unknown()).optional().describe('Initial Wave payload data'),
        maxSteps: z.number().optional().describe('Maximum trace steps (default: 1000)'),
      },
    },
    async ({ weaveId, startKnot, payload, maxSteps }) => {
      const weave = await weaveStore.load(weaveId)
      const result = trace(weave, startKnot, payload ?? {}, {
        maxSteps: maxSteps ?? 1000,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }
  )
}
