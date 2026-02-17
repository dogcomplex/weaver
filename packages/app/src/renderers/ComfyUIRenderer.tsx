/**
 * ComfyUIRenderer — embedded ComfyUI native graph view.
 *
 * Proxies ComfyUI through the Weaver server (/comfyui/) for same-origin
 * iframe access, enabling direct workflow synchronization.
 *
 * Two modes:
 *   1. Embedded iframe — when ComfyUI is running, loads the full native UI
 *      with a "Sync Workflow" button to push the current Weave.
 *   2. Formatted JSON — fallback when ComfyUI isn't available.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { WeaveRendererProps } from '#weaver/glamour'
import { toComfyUIApi } from '#weaver/adapters'

type ServiceStatus = 'running' | 'stopped' | 'starting' | 'error' | 'unknown'

export function ComfyUIRenderer({ weave }: WeaveRendererProps) {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>('unknown')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Check ComfyUI service status
  useEffect(() => {
    let cancelled = false

    async function checkStatus() {
      try {
        const res = await fetch('/api/services')
        if (!res.ok) {
          setServiceStatus('unknown')
          return
        }
        const services = await res.json()
        // /api/services returns { comfyui: { status, port }, ... }
        const comfyui = services.comfyui ?? services['comfyui']
        if (!cancelled) {
          setServiceStatus(comfyui?.status ?? 'stopped')
        }
      } catch {
        if (!cancelled) setServiceStatus('unknown')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Convert current weave to ComfyUI API format (for fallback JSON view)
  const apiPayload = useMemo(() => {
    try {
      return toComfyUIApi(weave)
    } catch {
      return null
    }
  }, [weave])

  // Sync current weave into ComfyUI's graph editor
  const handleSync = useCallback(async () => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      setSyncing(true)
      setSyncMsg(null)

      // Fetch the web-format workflow from our adapter endpoint
      const res = await fetch(`/api/adapters/comfyui/export/${weave.id}/web`)
      if (!res.ok) {
        // If not saved yet, save first then retry
        if (res.status === 404) {
          setSyncMsg('Save the weave first')
          return
        }
        throw new Error('Export failed')
      }
      const webWorkflow = await res.json()

      // Try to load into ComfyUI's frontend via same-origin iframe access
      const win = iframe.contentWindow as any
      if (!win) {
        setSyncMsg('Iframe not ready')
        return
      }

      // ComfyUI's legacy frontend: window.app.loadGraphData()
      // ComfyUI's new frontend (0.13+): may use a different API
      let loaded = false

      // Try the legacy LiteGraph-based app first
      if (win.app?.loadGraphData) {
        win.app.loadGraphData(webWorkflow)
        loaded = true
      }
      // Try the modern ComfyUI approach: graph store
      else if (win.app?.extensionManager?.workflow?.loadWorkflow) {
        win.app.extensionManager.workflow.loadWorkflow(webWorkflow)
        loaded = true
      }

      if (!loaded) {
        // Fallback: store in ComfyUI's localStorage and reload iframe
        // ComfyUI stores the last workflow as 'workflow' in localStorage
        try {
          const comfyStorage = iframe.contentDocument?.defaultView?.localStorage
          if (comfyStorage) {
            comfyStorage.setItem('workflow', JSON.stringify(webWorkflow))
            iframe.src = iframe.src // reload
            loaded = true
          }
        } catch {
          // localStorage access may fail
        }
      }

      if (!loaded) {
        // Last resort: reload the iframe
        setSyncMsg('Could not inject — reloading iframe')
        iframe.src = '/comfyui/'
        return
      }

      setSyncMsg('Synced')
      setTimeout(() => setSyncMsg(null), 2000)
    } catch (e: any) {
      setSyncMsg(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [weave.id])

  // If ComfyUI is running, show proxied iframe
  if (serviceStatus === 'running') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div style={headerStyle}>
          <div style={dotStyle('#4a4')} />
          <span style={{ fontSize: 11, color: '#6a6a9a' }}>
            ComfyUI :4188
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={syncBtnStyle}
            title="Load the current Weave into ComfyUI's graph editor"
          >
            {syncing ? 'Syncing...' : 'Sync Workflow'}
          </button>
          {syncMsg && (
            <span style={{ fontSize: 10, color: syncMsg === 'Synced' ? '#4a4' : '#fa0' }}>
              {syncMsg}
            </span>
          )}
          <button
            onClick={() => {
              if (iframeRef.current) iframeRef.current.src = '/comfyui/'
            }}
            style={reloadBtnStyle}
            title="Reload ComfyUI"
          >
            ↻
          </button>
          <a
            href="http://localhost:4188"
            target="_blank"
            rel="noopener noreferrer"
            style={popoutStyle}
            title="Open ComfyUI in a new tab"
          >
            ↗
          </a>
        </div>
        <iframe
          ref={iframeRef}
          src="/comfyui/"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            paddingTop: 28,
            boxSizing: 'border-box',
          }}
          title="ComfyUI Native Graph"
        />
      </div>
    )
  }

  // Fallback: formatted JSON viewer
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
        overflow: 'auto',
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={dotStyle(
            serviceStatus === 'starting' ? '#fa0' : '#666'
          )}
        />
        <span style={{ fontSize: 12, color: '#6a6a9a' }}>
          {serviceStatus === 'starting'
            ? 'ComfyUI starting...'
            : serviceStatus === 'error'
              ? 'ComfyUI error — showing API payload'
              : 'ComfyUI not running — showing API payload'}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#4a4a6a',
            marginLeft: 'auto',
          }}
        >
          Start ComfyUI from the Services panel to see the native graph
        </span>
      </div>

      {apiPayload ? (
        <div
          style={{
            background: '#111118',
            borderRadius: 6,
            border: '1px solid #1a1a2e',
            padding: 16,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#c0c0d0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#6a6a9a',
              marginBottom: 12,
              borderBottom: '1px solid #1a1a2e',
              paddingBottom: 8,
            }}
          >
            ComfyUI API Payload — {Object.keys(apiPayload).length} nodes
          </div>
          {formatComfyUIPayload(apiPayload)}
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            color: '#4a4a6a',
            padding: 40,
            fontSize: 13,
          }}
        >
          {weave.knots.size === 0
            ? 'Empty weave — add knots to see the ComfyUI representation'
            : 'Could not convert weave to ComfyUI format'}
        </div>
      )}
    </div>
  )
}

// --- Styles ---

const headerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 28,
  background: '#0d0d1a',
  borderBottom: '1px solid #1a1a2e',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
  zIndex: 10,
}

function dotStyle(color: string): React.CSSProperties {
  return { width: 6, height: 6, borderRadius: '50%', background: color }
}

const syncBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  background: '#1a2a1e',
  border: '1px solid #2a4a2e',
  borderRadius: 3,
  color: '#8a8',
  cursor: 'pointer',
  fontSize: 10,
  marginLeft: 'auto',
}

const reloadBtnStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'transparent',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#888',
  cursor: 'pointer',
  fontSize: 12,
}

const popoutStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: 'transparent',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#888',
  cursor: 'pointer',
  fontSize: 12,
  textDecoration: 'none',
}

// --- Fallback JSON viewer ---

function formatComfyUIPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)

  return (
    <div>
      {entries.map(([nodeId, nodeData]) => (
        <ComfyUINodeSection key={nodeId} nodeId={nodeId} data={nodeData} />
      ))}
    </div>
  )
}

function ComfyUINodeSection({ nodeId, data }: { nodeId: string; data: unknown }) {
  const [expanded, setExpanded] = useState(true)
  const d = data as Record<string, unknown>
  const classType = d?.class_type as string | undefined

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          cursor: 'pointer',
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ color: '#6a6aff', fontSize: 10, width: 12 }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span style={{ color: '#8a8aff' }}>"{nodeId}"</span>
        {classType && (
          <span style={{ color: '#4a8a4a', fontSize: 11 }}>
            ({classType})
          </span>
        )}
      </div>
      {expanded && (
        <pre
          style={{
            margin: 0,
            paddingLeft: 18,
            color: '#a0a0b0',
            fontSize: 11,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
