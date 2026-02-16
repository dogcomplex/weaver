import { createWeave, type Weave } from '#weaver/core'
import { mark, thread } from '#weaver/core'
import type { N8nWorkflow } from './types.js'

/**
 * Convert an n8n workflow to a Weave
 */
export function fromN8n(workflow: N8nWorkflow): Weave {
  let weave = createWeave(workflow.name || 'n8n Import')

  // Build a name→id map for resolving connections
  const nameToId = new Map<string, string>()

  // Create knots from n8n nodes
  for (const node of workflow.nodes) {
    const knotId = node.id || node.name.replace(/\s+/g, '_').toLowerCase()
    nameToId.set(node.name, knotId)

    weave = mark(weave, {
      id: knotId,
      label: node.name,
      type: node.type,
      position: { x: node.position[0], y: node.position[1] },
      data: {
        n8n_type: node.type,
        n8n_type_version: node.typeVersion,
        parameters: node.parameters,
        credentials: node.credentials,
        disabled: node.disabled,
        notes: node.notes,
      },
    })
  }

  // Create threads from n8n connections
  let linkCounter = 0
  for (const [sourceNodeName, outputs] of Object.entries(workflow.connections)) {
    const sourceId = nameToId.get(sourceNodeName)
    if (!sourceId) continue

    for (const [outputType, outputConnections] of Object.entries(outputs)) {
      for (const connectionGroup of outputConnections) {
        for (const connection of connectionGroup) {
          const targetId = nameToId.get(connection.node)
          if (!targetId) continue

          weave = thread(weave, sourceId, targetId, {
            id: `n8n_link_${linkCounter++}`,
            label: outputType !== 'main' ? outputType : undefined,
            data: {
              output_type: outputType,
              target_type: connection.type,
              target_index: connection.index,
            },
          })
        }
      }
    }
  }

  return weave
}
