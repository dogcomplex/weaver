import type { Weave } from '#weaver/core'
import type { ComfyUIWorkflow, ComfyUIWebWorkflow, ComfyUIWebNode, ComfyUIWebLink, ComfyUIInput } from './types.js'

/**
 * Convert a Weave to ComfyUI API format
 */
export function toComfyUIApi(weave: Weave): ComfyUIWorkflow {
  const workflow: ComfyUIWorkflow = {}

  for (const [knotId, knot] of weave.knots) {
    const inputs: Record<string, unknown> = {}
    const knotData = knot.data as Record<string, unknown>

    // Restore original ComfyUI inputs if they exist
    if (knotData.inputs) {
      let rawInputs = knotData.inputs
      // Handle stringified JSON inputs (e.g. from manual editing or legacy data)
      if (typeof rawInputs === 'string') {
        try { rawInputs = JSON.parse(rawInputs) } catch { /* leave as-is */ }
      }
      if (typeof rawInputs === 'object' && rawInputs !== null) {
        Object.assign(inputs, rawInputs)
      }
    }

    // Overwrite link inputs from threads
    for (const t of weave.threads.values()) {
      if (t.target === knotId && t.data.input_name) {
        const sourceSlot = (t.data.source_slot as number) ?? 0
        inputs[t.data.input_name as string] = [t.source, sourceSlot]
      }
    }

    workflow[knotId] = {
      class_type: knot.type !== 'default' ? knot.type : 'Unknown',
      inputs: inputs as Record<string, ComfyUIInput>,
      _meta: { title: knot.label },
    }
  }

  return workflow
}

/**
 * Convert a Weave to ComfyUI web format (for visual display)
 */
export function toComfyUIWeb(weave: Weave): ComfyUIWebWorkflow {
  const nodes: ComfyUIWebNode[] = []
  const links: ComfyUIWebLink[] = []

  let maxNodeId = 0
  let maxLinkId = 0

  for (const [knotId, knot] of weave.knots) {
    const numId = parseInt(knotId, 10) || nodes.length + 1
    if (numId > maxNodeId) maxNodeId = numId

    const knotData = knot.data as Record<string, unknown>

    nodes.push({
      id: numId,
      type: knot.type !== 'default' ? knot.type : 'Unknown',
      pos: [knot.position.x, knot.position.y],
      size: [200, 100],
      flags: {},
      order: nodes.length,
      mode: 0,
      title: knot.label,
      properties: (knotData.properties as Record<string, unknown>) ?? {},
      widgets_values: (knotData.widgets_values as unknown[]) ?? [],
      inputs: (knotData.inputs as ComfyUIWebNode['inputs']) ?? [],
      outputs: (knotData.outputs as ComfyUIWebNode['outputs']) ?? [],
    })
  }

  for (const t of weave.threads.values()) {
    const linkId = parseInt(t.id, 10) || links.length + 1
    if (linkId > maxLinkId) maxLinkId = linkId

    const sourceSlot = (t.data.source_slot as number) ?? 0
    const targetSlot = (t.data.target_slot as number) ?? 0
    const linkType = (t.data.link_type as string) ?? '*'

    links.push([
      linkId,
      parseInt(t.source, 10) || 0,
      sourceSlot,
      parseInt(t.target, 10) || 0,
      targetSlot,
      linkType,
    ])
  }

  return {
    last_node_id: maxNodeId,
    last_link_id: maxLinkId,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 1,
  }
}
