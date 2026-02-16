import type { Weave } from '#weaver/core'
import type { N8nWorkflow, N8nNode, N8nConnections } from './types.js'

/**
 * Convert a Weave to n8n workflow format
 */
export function toN8n(weave: Weave): N8nWorkflow {
  const nodes: N8nNode[] = []
  const connections: N8nConnections = {}

  // Build id→name map
  const idToName = new Map<string, string>()

  // Convert knots to n8n nodes
  for (const [knotId, knot] of weave.knots) {
    const name = knot.label || knotId
    idToName.set(knotId, name)
    const knotData = knot.data as Record<string, unknown>

    nodes.push({
      id: knotId,
      name,
      type: knot.type !== 'default' ? knot.type : 'n8n-nodes-base.noOp',
      typeVersion: (knotData.n8n_type_version as number) ?? 1,
      position: [knot.position.x, knot.position.y],
      parameters: (knotData.parameters as Record<string, unknown>) ?? {},
      credentials: knotData.credentials as Record<string, unknown>,
      disabled: knotData.disabled as boolean,
      notes: knotData.notes as string,
    })
  }

  // Convert threads to n8n connections
  for (const t of weave.threads.values()) {
    const sourceName = idToName.get(t.source)
    const targetName = idToName.get(t.target)
    if (!sourceName || !targetName) continue

    const outputType = (t.data.output_type as string) ?? 'main'
    const targetType = (t.data.target_type as string) ?? 'main'
    const targetIndex = (t.data.target_index as number) ?? 0

    if (!connections[sourceName]) {
      connections[sourceName] = {}
    }
    if (!connections[sourceName][outputType]) {
      connections[sourceName][outputType] = [[]]
    }

    connections[sourceName][outputType][0].push({
      node: targetName,
      type: targetType,
      index: targetIndex,
    })
  }

  return {
    name: weave.name,
    active: false,
    nodes,
    connections,
    settings: {},
  }
}
