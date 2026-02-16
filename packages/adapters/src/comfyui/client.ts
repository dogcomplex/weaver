import type { ComfyUISystemStats, ComfyUIPromptResponse, ComfyUIWorkflow } from './types.js'

export interface ComfyUIClientConfig {
  host: string
  port: number
}

const DEFAULT_CONFIG: ComfyUIClientConfig = {
  host: '127.0.0.1',
  port: Number(process.env.COMFYUI_PORT) || 4188,
}

export class ComfyUIClient {
  private baseUrl: string

  constructor(config: Partial<ComfyUIClientConfig> = {}) {
    const { host, port } = { ...DEFAULT_CONFIG, ...config }
    this.baseUrl = `http://${host}:${port}`
  }

  async getSystemStats(): Promise<ComfyUISystemStats> {
    const res = await fetch(`${this.baseUrl}/system_stats`)
    if (!res.ok) throw new Error(`ComfyUI error: ${res.statusText}`)
    return res.json() as Promise<ComfyUISystemStats>
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.getSystemStats()
      return true
    } catch {
      return false
    }
  }

  async queuePrompt(workflow: ComfyUIWorkflow, clientId?: string): Promise<ComfyUIPromptResponse> {
    const body: Record<string, unknown> = { prompt: workflow }
    if (clientId) body.client_id = clientId

    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`ComfyUI error: ${res.statusText}`)
    return res.json() as Promise<ComfyUIPromptResponse>
  }

  async getHistory(promptId?: string): Promise<Record<string, unknown>> {
    const url = promptId
      ? `${this.baseUrl}/history/${promptId}`
      : `${this.baseUrl}/history`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`ComfyUI error: ${res.statusText}`)
    return res.json() as Promise<Record<string, unknown>>
  }

  async getObjectInfo(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/object_info`)
    if (!res.ok) throw new Error(`ComfyUI error: ${res.statusText}`)
    return res.json() as Promise<Record<string, unknown>>
  }
}
