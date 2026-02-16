import type { Weave } from '#weaver/core'
import type { Adapter } from '../types.js'
import type { ComfyUIWebWorkflow } from './types.js'
import { fromComfyUIWeb } from './from-comfyui.js'
import { toComfyUIWeb } from './to-comfyui.js'

export { ComfyUIClient } from './client.js'
export type { ComfyUIWebWorkflow, ComfyUIWorkflow, ComfyUISystemStats } from './types.js'
export { fromComfyUIWeb, fromComfyUIApi } from './from-comfyui.js'
export { toComfyUIWeb, toComfyUIApi } from './to-comfyui.js'

export class ComfyUIAdapter implements Adapter<ComfyUIWebWorkflow> {
  name = 'comfyui'

  fromExternal(workflow: ComfyUIWebWorkflow): Weave {
    return fromComfyUIWeb(workflow)
  }

  toExternal(weave: Weave): ComfyUIWebWorkflow {
    return toComfyUIWeb(weave)
  }
}
