import type { Weave } from '#weaver/core'
import type { Adapter } from '../types.js'
import type { N8nWorkflow } from './types.js'
import { fromN8n } from './from-n8n.js'
import { toN8n } from './to-n8n.js'

export { N8nClient } from './client.js'
export type { N8nWorkflow, N8nWorkflowSummary, N8nExecution } from './types.js'
export { fromN8n } from './from-n8n.js'
export { toN8n } from './to-n8n.js'

export class N8nAdapter implements Adapter<N8nWorkflow> {
  name = 'n8n'

  fromExternal(workflow: N8nWorkflow): Weave {
    return fromN8n(workflow)
  }

  toExternal(weave: Weave): N8nWorkflow {
    return toN8n(weave)
  }
}
