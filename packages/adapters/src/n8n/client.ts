import type { N8nWorkflow, N8nWorkflowSummary, N8nExecution } from './types.js'

export interface N8nClientConfig {
  host: string
  port: number
  apiKey?: string
}

const DEFAULT_CONFIG: N8nClientConfig = {
  host: '127.0.0.1',
  port: 5678,
}

export class N8nClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(config: Partial<N8nClientConfig> = {}) {
    const { host, port, apiKey } = { ...DEFAULT_CONFIG, ...config }
    this.baseUrl = `http://${host}:${port}/api/v1`
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {}),
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/workflows`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }

  async listWorkflows(): Promise<N8nWorkflowSummary[]> {
    const res = await fetch(`${this.baseUrl}/workflows`, { headers: this.headers })
    if (!res.ok) throw new Error(`n8n error: ${res.statusText}`)
    const body = await res.json() as { data: N8nWorkflowSummary[] }
    return body.data
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    const res = await fetch(`${this.baseUrl}/workflows/${id}`, { headers: this.headers })
    if (!res.ok) throw new Error(`n8n error: ${res.statusText}`)
    return res.json() as Promise<N8nWorkflow>
  }

  async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    const res = await fetch(`${this.baseUrl}/workflows`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(workflow),
    })
    if (!res.ok) throw new Error(`n8n error: ${res.statusText}`)
    return res.json() as Promise<N8nWorkflow>
  }

  async executeWorkflow(id: string): Promise<N8nExecution> {
    const res = await fetch(`${this.baseUrl}/workflows/${id}/execute`, {
      method: 'POST',
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`n8n error: ${res.statusText}`)
    return res.json() as Promise<N8nExecution>
  }
}
