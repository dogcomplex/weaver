import type { Node, Edge } from '@xyflow/react'
import type { Weave, Knot, Thread } from '#weaver/core'
import type { KnotHighlight, ThreadHighlight } from '#weaver/glamour'

/** Convert a Weave's knots to XYFlow nodes */
export function knotsToNodes(
  weave: Weave,
  highlights?: Map<string, KnotHighlight>,
): Node[] {
  return Array.from(weave.knots.values()).map((knot: Knot) => ({
    id: knot.id,
    type: knot.type === 'veiled' ? 'veiled' : 'knot',
    position: knot.position,
    data: {
      label: knot.label,
      knotType: knot.type,
      highlight: highlights?.get(knot.id) ?? null,
      ...knot.data,
    },
  }))
}

/** Convert a Weave's threads to XYFlow edges */
export function threadsToEdges(
  weave: Weave,
  highlights?: Map<string, ThreadHighlight>,
): Edge[] {
  return Array.from(weave.threads.values()).map((thread: Thread) => ({
    id: thread.id,
    source: thread.source,
    target: thread.target,
    type: thread.gate ? 'gated' : 'thread',
    label: thread.label,
    data: {
      gate: thread.gate,
      highlight: highlights?.get(thread.id) ?? null,
      ...thread.data,
    },
  }))
}

/** Convert XYFlow node position changes back to a position map */
export function nodesToPositionMap(
  nodes: Node[]
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    map.set(node.id, node.position)
  }
  return map
}
