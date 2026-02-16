import { createWeave, type Weave } from '#weaver/core'
import { mark, thread } from '#weaver/core'
import type { ComfyUIWebWorkflow, ComfyUIWorkflow } from './types.js'

/**
 * Convert a ComfyUI web workflow (visual format with nodes/links arrays) to a Weave
 */
export function fromComfyUIWeb(workflow: ComfyUIWebWorkflow): Weave {
  let weave = createWeave('ComfyUI Import')

  // Create knots from nodes
  for (const node of workflow.nodes) {
    weave = mark(weave, {
      id: String(node.id),
      label: node.title ?? node.type,
      type: node.type,
      position: { x: node.pos[0], y: node.pos[1] },
      data: {
        comfyui_id: node.id,
        comfyui_type: node.type,
        widgets_values: node.widgets_values,
        properties: node.properties,
        inputs: node.inputs,
        outputs: node.outputs,
      },
    })
  }

  // Create threads from links
  for (const link of workflow.links) {
    const [linkId, sourceNodeId, sourceSlot, targetNodeId, targetSlot, linkType] = link
    weave = thread(weave, String(sourceNodeId), String(targetNodeId), {
      id: String(linkId),
      label: linkType,
      data: {
        comfyui_link_id: linkId,
        source_slot: sourceSlot,
        target_slot: targetSlot,
        link_type: linkType,
      },
    })
  }

  return weave
}

/**
 * Convert a ComfyUI API workflow (keyed format) to a Weave
 */
export function fromComfyUIApi(workflow: ComfyUIWorkflow): Weave {
  let weave = createWeave('ComfyUI API Import')
  const spacing = 200

  // Create knots from API nodes
  const nodeIds = Object.keys(workflow)
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i]
    const node = workflow[nodeId]
    weave = mark(weave, {
      id: nodeId,
      label: node._meta?.title ?? node.class_type,
      type: node.class_type,
      position: { x: (i % 4) * spacing, y: Math.floor(i / 4) * spacing },
      data: {
        comfyui_class_type: node.class_type,
        inputs: node.inputs,
      },
    })
  }

  // Create threads from input links
  let linkCounter = 0
  for (const [targetNodeId, node] of Object.entries(workflow)) {
    for (const [inputName, inputValue] of Object.entries(node.inputs)) {
      if (Array.isArray(inputValue) && inputValue.length === 2) {
        const [sourceNodeId, sourceSlot] = inputValue
        weave = thread(weave, String(sourceNodeId), targetNodeId, {
          id: `link_${linkCounter++}`,
          label: inputName,
          data: {
            input_name: inputName,
            source_slot: sourceSlot,
          },
        })
      }
    }
  }

  return weave
}
