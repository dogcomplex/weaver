/** ComfyUI workflow JSON format (API format) */
export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUINode
}

export interface ComfyUINode {
  class_type: string
  inputs: Record<string, ComfyUIInput>
  _meta?: { title?: string }
}

/** ComfyUI input: either a literal value or a link [nodeId, outputIndex] */
export type ComfyUIInput = string | number | boolean | [string, number] | null

/** ComfyUI web format (used by the frontend, includes visual layout) */
export interface ComfyUIWebWorkflow {
  last_node_id: number
  last_link_id: number
  nodes: ComfyUIWebNode[]
  links: ComfyUIWebLink[]
  groups: unknown[]
  config: Record<string, unknown>
  extra: Record<string, unknown>
  version: number
}

export interface ComfyUIWebNode {
  id: number
  type: string
  pos: [number, number]
  size: [number, number]
  flags: Record<string, unknown>
  order: number
  mode: number
  inputs?: Array<{ name: string; type: string; link: number | null }>
  outputs?: Array<{ name: string; type: string; links: number[]; slot_index?: number }>
  title?: string
  properties: Record<string, unknown>
  widgets_values?: unknown[]
}

/** ComfyUI link: [linkId, sourceNodeId, sourceSlot, targetNodeId, targetSlot, type] */
export type ComfyUIWebLink = [number, number, number, number, number, string]

/** ComfyUI API response types */
export interface ComfyUISystemStats {
  system: {
    os: string
    python_version: string
    embedded_python: boolean
  }
  devices: Array<{
    name: string
    type: string
    index: number
    vram_total: number
    vram_free: number
    torch_vram_total: number
    torch_vram_free: number
  }>
}

export interface ComfyUIPromptResponse {
  prompt_id: string
  number: number
  node_errors: Record<string, unknown>
}
