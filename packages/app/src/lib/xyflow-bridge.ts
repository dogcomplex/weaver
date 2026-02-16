import type { Node, Edge } from '@xyflow/react'
import type { Weave, Knot, Thread } from '#weaver/core'

/** Convert a Weave's knots to XYFlow nodes */
export function knotsToNodes(weave: Weave): Node[] {
  return Array.from(weave.knots.values()).map((knot: Knot) => ({
    id: knot.id,
    type: knot.type === 'veiled' ? 'veiled' : 'knot',
    position: knot.position,
    data: {
      label: knot.label,
      knotType: knot.type,
      ...knot.data,
    },
  }))
}

/** Convert a Weave's threads to XYFlow edges */
export function threadsToEdges(weave: Weave): Edge[] {
  return Array.from(weave.threads.values()).map((thread: Thread) => ({
    id: thread.id,
    source: thread.source,
    target: thread.target,
    type: thread.gate ? 'gated' : 'thread',
    label: thread.label,
    data: {
      gate: thread.gate,
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
