import { useState, useEffect, useRef, useCallback } from 'react'

export function ServicePanel() {
  const [services, setServices] = useState<Record<string, { status: string; port: number }>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const logEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch initial service status
  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(setServices)
      .catch(() => {})
  }, [])

  // Connect WebSocket for live log streaming
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:4444/ws`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'service:log') {
          setLogs(prev => {
            const lines = [...(prev[msg.service] ?? []), msg.line]
            if (lines.length > 500) lines.splice(0, lines.length - 500)
            return { ...prev, [msg.service]: lines }
          })
        } else if (msg.type === 'service:status') {
          setServices(prev => ({
            ...prev,
            [msg.service]: { ...prev[msg.service], status: msg.status },
          }))
        }
      } catch {}
    }

    ws.onclose = () => { wsRef.current = null }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [])

  // Auto-scroll logs when expanded
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, expanded])

  const startService = useCallback(async (id: string) => {
    setLogs(prev => ({ ...prev, [id]: [] }))
    setExpanded(id) // auto-expand console on start
    try {
      // Always force=true to auto-kill stale processes on the port
      const res = await fetch(`/api/services/${id}/start?force=true`, { method: 'POST' })
      const result = await res.json()
      if (result.status === 'starting' || result.status === 'already_running') {
        setServices(prev => ({
          ...prev,
          [id]: { ...prev[id], status: result.status === 'already_running' ? 'running' : 'starting' },
        }))
      }
    } catch {}
  }, [])

  const stopService = useCallback(async (id: string) => {
    try {
      await fetch(`/api/services/${id}/stop`, { method: 'POST' })
      setServices(prev => ({
        ...prev,
        [id]: { ...prev[id], status: 'stopped' },
      }))
    } catch {}
  }, [])

  const restartService = useCallback(async (id: string) => {
    setLogs(prev => ({ ...prev, [id]: [] }))
    setExpanded(id)
    try {
      await fetch(`/api/services/${id}/stop`, { method: 'POST' })
    } catch {}
    // Brief delay to let stop complete, then force-start
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/services/${id}/start?force=true`, { method: 'POST' })
        const result = await res.json()
        if (result.status === 'starting') {
          setServices(prev => ({
            ...prev,
            [id]: { ...prev[id], status: 'starting' },
          }))
        }
      } catch {}
    }, 500)
  }, [])

  const loadLogs = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/services/${id}`)
      const data = await res.json()
      setLogs(prev => ({ ...prev, [id]: data.logs ?? [] }))
    } catch {}
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      if (prev === id) return null
      loadLogs(id)
      return id
    })
  }, [loadLogs])

  const entries = Object.entries(services)
  if (entries.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid #222', padding: '8px 12px' }}>
      <label style={headerLabelStyle}>Services</label>
      {entries.map(([id, svc]) => (
        <div key={id} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status={svc.status} />
            <span
              style={{ fontSize: 11, color: '#aaa', cursor: 'pointer', flex: 1 }}
              onClick={() => toggleExpand(id)}
              title="Toggle console"
            >
              {id} <span style={{ color: '#555' }}>:{svc.port}</span>
            </span>
            {svc.status === 'stopped' || svc.status === 'error' ? (
              <button onClick={() => startService(id)} style={actionBtnStyle} title="Start (auto-kills stale processes)">
                ▶
              </button>
            ) : (
              <>
                <button onClick={() => restartService(id)} style={restartBtnStyle} title="Restart (kill & relaunch)">
                  ↻
                </button>
                <button onClick={() => stopService(id)} style={{ ...actionBtnStyle, color: '#c55' }} title="Stop">
                  ■
                </button>
              </>
            )}
          </div>

          {expanded === id && (
            <div style={consoleStyle}>
              {(logs[id] ?? []).map((line, i) => (
                <div key={i} style={logLineStyle(line)}>
                  {line}
                </div>
              ))}
              {(logs[id] ?? []).length === 0 && (
                <div style={{ color: '#444', fontStyle: 'italic', fontSize: 10 }}>
                  No output yet
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'running' ? '#4a4' :
    status === 'starting' ? '#ca4' :
    status === 'error' ? '#c44' :
    '#555'
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }}
      title={status}
    />
  )
}

function logLineStyle(line: string): React.CSSProperties {
  const isError = line.includes('[stderr]') || line.toLowerCase().includes('error')
  const isWeaver = line.startsWith('[weaver]')
  return {
    fontSize: 10,
    fontFamily: 'monospace',
    color: isError ? '#e66' : isWeaver ? '#6a6aff' : '#888',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: 1.4,
  }
}

const headerLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#666',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#4a4',
  cursor: 'pointer',
  fontSize: 10,
  padding: '1px 5px',
  lineHeight: 1,
}

const restartBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#ca4',
  cursor: 'pointer',
  fontSize: 12,
  padding: '0px 4px',
  lineHeight: 1,
}

const consoleStyle: React.CSSProperties = {
  marginTop: 4,
  padding: 6,
  background: '#0a0a14',
  border: '1px solid #1a1a2e',
  borderRadius: 3,
  maxHeight: 200,
  overflow: 'auto',
}
