/** n8n workflow JSON format */
export interface N8nWorkflow {
  id?: string
  name: string
  active: boolean
  nodes: N8nNode[]
  connections: N8nConnections
  settings?: Record<string, unknown>
  staticData?: unknown
  tags?: string[]
}

export interface N8nNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: Record<string, unknown>
  credentials?: Record<string, unknown>
  disabled?: boolean
  notes?: string
  notesInFlow?: boolean
}

/** n8n connections: keyed by source node name */
export interface N8nConnections {
  [sourceNodeName: string]: {
    [outputType: string]: Array<
      Array<{
        node: string
        type: string
        index: number
      }>
    >
  }
}

/** n8n API response for workflow listing */
export interface N8nWorkflowSummary {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  tags: string[]
}

/** n8n execution result */
export interface N8nExecution {
  id: string
  finished: boolean
  mode: string
  startedAt: string
  stoppedAt: string
  data: Record<string, unknown>
}
