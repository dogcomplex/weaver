import { useCallback } from 'react'
import type { SerializedWeave } from '#weaver/core'

const API_BASE = '/api'

interface GraphSummary {
  id: string
  name: string
  filename: string
  modified: string
}

export function useGraphApi() {
  const listGraphs = useCallback(async (): Promise<GraphSummary[]> => {
    const res = await fetch(`${API_BASE}/graphs`)
    if (!res.ok) throw new Error(`Failed to list graphs: ${res.statusText}`)
    return res.json()
  }, [])

  const loadGraph = useCallback(async (id: string): Promise<SerializedWeave> => {
    const res = await fetch(`${API_BASE}/graphs/${id}`)
    if (!res.ok) throw new Error(`Failed to load graph: ${res.statusText}`)
    return res.json()
  }, [])

  const saveGraph = useCallback(async (graph: SerializedWeave): Promise<void> => {
    const res = await fetch(`${API_BASE}/graphs/${graph.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graph),
    })
    if (!res.ok) throw new Error(`Failed to save graph: ${res.statusText}`)
  }, [])

  const createGraph = useCallback(async (graph: SerializedWeave): Promise<void> => {
    const res = await fetch(`${API_BASE}/graphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graph),
    })
    if (!res.ok) throw new Error(`Failed to create graph: ${res.statusText}`)
  }, [])

  const deleteGraph = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/graphs/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`Failed to delete graph: ${res.statusText}`)
  }, [])

  return { listGraphs, loadGraph, saveGraph, createGraph, deleteGraph }
}
