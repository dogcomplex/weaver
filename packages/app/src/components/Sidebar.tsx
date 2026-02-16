import { useState, useEffect, useCallback, useRef } from 'react'
import { useWeave } from '../hooks/useWeave.js'
import { useGraphApi } from '../hooks/useGraphApi.js'
import { toSerialized, deserializeWeave } from '#weaver/core'

interface GraphSummary {
  id: string
  name: string
  filename: string
  modified: string
}

interface ServiceStatus {
  comfyui: { connected: boolean; url: string }
  n8n: { connected: boolean; url: string }
}


interface QueueResult {
  prompt_id: string
  images: Array<{ filename: string; url: string }>
}

interface SidebarProps {
  onTraceResult?: (result: any) => void
  onQueueResult?: (result: QueueResult) => void
}

export function Sidebar({ onTraceResult, onQueueResult }: SidebarProps) {
  const { state, dispatch } = useWeave()
  const { listGraphs, loadGraph, saveGraph, createGraph } = useGraphApi()
  const [graphs, setGraphs] = useState<GraphSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [serverOk, setServerOk] = useState(true)
  const [status, setStatus] = useState<ServiceStatus | null>(null)
  const [tracing, setTracing] = useState(false)
  const [queuing, setQueuing] = useState(false)

  // Use refs for interval callbacks to avoid effect re-runs
  const refreshRef = useRef<() => Promise<void>>()

  const refresh = useCallback(async () => {
    try {
      const list = await listGraphs()
      setGraphs(list)
      setServerOk(true)
    } catch {
      setServerOk(false)
    }
  }, [listGraphs])

  refreshRef.current = refresh

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/adapters/status')
      if (res.ok) setStatus(await res.json())
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    refresh()
    refreshStatus()
    const interval = setInterval(() => refreshRef.current?.(), 5000)
    const statusInterval = setInterval(refreshStatus, 15000)
    return () => { clearInterval(interval); clearInterval(statusInterval) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNew = useCallback(() => {
    const name = prompt('Weave name:')
    if (name) {
      dispatch({ type: 'new', name })
      onTraceResult?.(null)
    }
  }, [dispatch])

  const persistCurrent = useCallback(async () => {
    const serialized = toSerialized(state.current)
    try {
      await loadGraph(state.current.id)
      await saveGraph(serialized)
    } catch {
      await createGraph(serialized)
    }
  }, [state.current, loadGraph, saveGraph, createGraph])

  const handleSave = useCallback(async () => {
    try {
      await persistCurrent()
      dispatch({ type: 'markSaved' })
      refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }, [persistCurrent, dispatch, refresh])

  const handleLoad = useCallback(
    async (id: string) => {
      try {
        const data = await loadGraph(id)
        const json = JSON.stringify(data)
        const weave = deserializeWeave(json)
        dispatch({ type: 'load', weave })
        setError(null)
        onTraceResult?.(null)
      } catch (e: any) {
        setError(e.message)
      }
    },
    [dispatch, loadGraph]
  )

  // --- Trace execution ---

  const handleTrace = useCallback(async () => {
    if (state.current.knots.size === 0) {
      setError('No knots to trace')
      return
    }

    try {
      setTracing(true)
      setError(null)

      // Save first
      await persistCurrent()

      // Find a starting knot: prefer one with no incoming threads
      const incomingTargets = new Set<string>()
      for (const t of state.current.threads.values()) {
        incomingTargets.add(t.target)
      }
      const knotIds = Array.from(state.current.knots.keys())
      const startKnot = knotIds.find(id => !incomingTargets.has(id)) ?? knotIds[0]

      const res = await fetch('/api/runtime/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weaveId: state.current.id,
          startKnot,
          payload: {},
          maxSteps: 100,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Trace failed')
      }

      const result = await res.json()
      onTraceResult?.(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTracing(false)
    }
  }, [state.current, persistCurrent])

  // --- Adapter actions ---

  const handleExportComfyUI = useCallback(async () => {
    try {
      await persistCurrent()
      const res = await fetch(`/api/adapters/comfyui/export/${state.current.id}`)
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      downloadJson(data, `${state.current.name || 'workflow'}_comfyui.json`)
    } catch (e: any) {
      setError(e.message)
    }
  }, [state.current, persistCurrent])

  const handleExportN8n = useCallback(async () => {
    try {
      await persistCurrent()
      const res = await fetch(`/api/adapters/n8n/export/${state.current.id}`)
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      downloadJson(data, `${state.current.name || 'workflow'}_n8n.json`)
    } catch (e: any) {
      setError(e.message)
    }
  }, [state.current, persistCurrent])

  const handleQueueComfyUI = useCallback(async () => {
    try {
      setQueuing(true)
      setError(null)
      await persistCurrent()
      const res = await fetch(`/api/adapters/comfyui/queue/${state.current.id}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Queue failed')
      }
      const result = await res.json()
      onQueueResult?.(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setQueuing(false)
    }
  }, [state.current, persistCurrent, onQueueResult])

  const handleImportComfyUI = useCallback(() => {
    pickFile('.json', async (text) => {
      try {
        const data = JSON.parse(text)
        const endpoint = Array.isArray(data.nodes)
          ? '/api/adapters/comfyui/import/web'
          : '/api/adapters/comfyui/import/api'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: text,
        })
        if (!res.ok) throw new Error('Import failed')
        const result = await res.json()
        await handleLoad(result.id)
        refresh()
      } catch (e: any) {
        setError(e.message)
      }
    })
  }, [handleLoad, refresh])

  return (
    <div
      style={{
        width: 280,
        background: '#111',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ccc', flex: 1 }}>
          Weaver
        </h2>
        <span style={{ fontSize: 8, color: serverOk ? '#4a4' : '#c44' }}>
          {serverOk ? '\u25CF' : '\u25CB'}
        </span>
      </div>

      {/* Main actions */}
      <div style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
        <button onClick={handleNew} style={btnStyle}>New</button>
        <button onClick={handleSave} style={btnStyle}>
          Save{!state.saved ? ' *' : ''}
        </button>
        <button
          onClick={handleTrace}
          disabled={tracing || state.current.knots.size === 0}
          style={{
            ...btnStyle,
            background: '#1e2a1a',
            borderColor: '#2a4a2e',
            opacity: tracing || state.current.knots.size === 0 ? 0.5 : 1,
          }}
        >
          {tracing ? 'Tracing...' : 'Trace'}
        </button>
      </div>

      <div style={{ padding: '4px 12px', fontSize: 11, color: '#666' }}>
        {state.current.name} ({state.current.knots.size} knots, {state.current.threads.size} threads)
      </div>

      {error && (
        <div
          style={{ padding: '4px 12px', fontSize: 11, color: '#c44', cursor: 'pointer' }}
          onClick={() => setError(null)}
          title="Click to dismiss"
        >
          {error}
        </div>
      )}

      {/* Saved weaves */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Saved Weaves</div>
        {graphs.map((g) => (
          <div
            key={g.id}
            onClick={() => handleLoad(g.id)}
            style={{
              padding: '6px 8px',
              marginBottom: 2,
              borderRadius: 4,
              cursor: 'pointer',
              background: g.id === state.current.id ? '#1a1a2e' : 'transparent',
              fontSize: 12,
              color: '#aaa',
            }}
          >
            {g.name}
          </div>
        ))}
        {graphs.length === 0 && (
          <div style={{ fontSize: 11, color: '#444' }}>No saved weaves</div>
        )}
      </div>

      {/* Adapter section */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #222' }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Adapters</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={handleExportComfyUI} style={btnSmallStyle}>Export ComfyUI</button>
          <button onClick={handleExportN8n} style={btnSmallStyle}>Export n8n</button>
          <button onClick={handleImportComfyUI} style={btnSmallStyle}>Import ComfyUI</button>
        </div>

        {status?.comfyui.connected && (
          <button
            onClick={handleQueueComfyUI}
            disabled={queuing}
            style={{
              ...btnSmallStyle,
              background: queuing ? '#2a2a1e' : '#1a3a1e',
              borderColor: '#2a5a2e',
              marginBottom: 4,
              opacity: queuing ? 0.6 : 1,
            }}
          >
            {queuing ? 'Generating...' : 'Queue to ComfyUI'}
          </button>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10 }}>
          <span style={{ color: status?.comfyui.connected ? '#4a4' : '#555' }}>
            {status?.comfyui.connected ? '\u25CF' : '\u25CB'} ComfyUI
          </span>
          <span style={{ color: status?.n8n.connected ? '#4a4' : '#555' }}>
            {status?.n8n.connected ? '\u25CF' : '\u25CB'} n8n
          </span>
        </div>
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid #222', fontSize: 10, color: '#444' }}>
        Double-click canvas to mark a knot.
        <br />
        Drag between handles to thread.
        <br />
        Ctrl+Z / Ctrl+Y to undo/redo.
      </div>
    </div>
  )
}

// --- Helpers ---

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function pickFile(accept: string, onRead: (text: string) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) onRead(await file.text())
  }
  input.click()
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 4,
  color: '#ccc',
  cursor: 'pointer',
  fontSize: 12,
}

const btnSmallStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#999',
  cursor: 'pointer',
  fontSize: 10,
}
