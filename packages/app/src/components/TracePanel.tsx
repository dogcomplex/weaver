import { useState } from 'react'
import type { Weave } from '#weaver/core'

interface TraceResult {
  steps: Array<{
    knotId: string
    threadId?: string
    gateResult?: { passed: boolean; expression: string }
    wave: { id: string; status: string; payload: Record<string, unknown>; path: string[] }
    timestamp: number
  }>
  waves: Array<{
    id: string
    status: string
    payload: Record<string, unknown>
    path: string[]
  }>
  errors: Array<{ knotId: string; message: string }>
  duration: number
}

interface TracePanelProps {
  result: TraceResult
  weave: Weave
  onClose: () => void
}

export function TracePanel({ result, weave, onClose }: TracePanelProps) {
  const [selectedWave, setSelectedWave] = useState(0)
  const wave = result.waves[selectedWave]

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#111',
      borderTop: '2px solid #2a2a4a',
      zIndex: 10,
      maxHeight: '40vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid #222',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
          Trace Results
        </span>
        <span style={{ fontSize: 11, color: '#666' }}>
          {result.waves.length} wave{result.waves.length !== 1 ? 's' : ''} &middot; {result.steps.length} steps &middot; {result.duration}ms
        </span>

        {result.errors.length > 0 && (
          <span style={{ fontSize: 11, color: '#c44' }}>
            {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
          </span>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16,
        }}>&times;</button>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div style={{ padding: '4px 16px', background: '#1a0a0a' }}>
          {result.errors.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#c44', padding: '2px 0' }}>
              {e.message}
            </div>
          ))}
        </div>
      )}

      {/* Wave tabs + detail */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Wave list */}
        <div style={{
          width: 200,
          borderRight: '1px solid #222',
          overflow: 'auto',
          flexShrink: 0,
        }}>
          {result.waves.map((w, i) => (
            <div
              key={w.id}
              onClick={() => setSelectedWave(i)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === selectedWave ? '#1a1a2e' : 'transparent',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              <div style={{
                fontSize: 11,
                color: w.status === 'arrived' ? '#4a4' : w.status === 'blocked' ? '#ca4' : '#aaa',
                fontWeight: i === selectedWave ? 600 : 400,
              }}>
                Wave {i + 1}: {w.status}
              </div>
              <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>
                {w.path.length} knots visited
              </div>
            </div>
          ))}
        </div>

        {/* Wave detail: show each knot in path with its data */}
        {wave && (
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {wave.path.map((knotId, stepIdx) => {
              const knot = weave.knots.get(knotId)
              if (!knot) return null
              const data = knot.data as Record<string, unknown>
              const inputs = data.inputs as Record<string, unknown> | undefined
              const isLast = stepIdx === wave.path.length - 1
              const isFirst = stepIdx === 0

              // Find the thread connecting previous knot → this knot
              const prevKnotId = stepIdx > 0 ? wave.path[stepIdx - 1] : null
              let connectingThread: string | undefined
              if (prevKnotId) {
                for (const t of weave.threads.values()) {
                  if (t.source === prevKnotId && t.target === knotId) {
                    connectingThread = t.label || t.id
                    break
                  }
                }
              }

              return (
                <div key={`${knotId}-${stepIdx}`}>
                  {/* Thread arrow between knots */}
                  {connectingThread && (
                    <div style={{
                      padding: '2px 16px',
                      fontSize: 9,
                      color: '#4a4a6a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span style={{ color: '#333' }}>│</span>
                      <span>{connectingThread}</span>
                      <span style={{ color: '#333' }}>↓</span>
                    </div>
                  )}

                  {/* Knot */}
                  <div style={{
                    padding: '6px 16px',
                    display: 'flex',
                    gap: 12,
                    background: isFirst ? '#0a1a0a' : isLast ? '#0a0a1a' : 'transparent',
                  }}>
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: '#ccc', fontWeight: 500 }}>
                        {isFirst ? '▶ ' : isLast ? '■ ' : '  '}{knot.label}
                      </div>
                      <div style={{ fontSize: 9, color: '#555' }}>
                        {knot.type !== 'default' ? knot.type : ''}
                      </div>
                    </div>

                    {/* Show key input values */}
                    {inputs && Object.keys(inputs).length > 0 && (
                      <div style={{ fontSize: 10, color: '#777', flex: 1 }}>
                        {Object.entries(inputs).map(([key, val]) => {
                          // Skip link references (arrays like ["1", 0])
                          if (Array.isArray(val)) return null
                          const display = typeof val === 'string'
                            ? (val.length > 60 ? val.slice(0, 60) + '...' : val)
                            : String(val)
                          return (
                            <div key={key} style={{ padding: '1px 0' }}>
                              <span style={{ color: '#555' }}>{key}: </span>
                              <span style={{ color: typeof val === 'string' ? '#8a8' : '#88a' }}>{display}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Gate evaluations for this wave */}
            {(() => {
              const gateSteps = result.steps.filter(s =>
                s.gateResult && wave.path.includes(s.knotId)
              )
              if (gateSteps.length === 0) return null
              return (
                <div style={{ padding: '8px 16px', borderTop: '1px solid #222' }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Gates evaluated:</div>
                  {gateSteps.map((step, i) => (
                    <div key={i} style={{ fontSize: 10, color: step.gateResult!.passed ? '#4a4' : '#c44', padding: '1px 0' }}>
                      {step.gateResult!.expression} → {step.gateResult!.passed ? 'pass' : 'block'}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
