/**
 * BackgroundEventCard — System notification for background events.
 *
 * Renders WebSocket events (loci-watcher score updates, score warnings,
 * asset completions) as inline system notifications in the chat flow.
 *
 * Visually distinct from user/assistant messages — centered, smaller,
 * thin border, icon prefix.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface BackgroundEvent {
  id: string
  type: 'score-update' | 'score-warning' | 'asset-complete'
  timestamp: number
  data: Record<string, unknown>
}

interface BackgroundEventCardProps {
  event: BackgroundEvent
}

// ─── Component ──────────────────────────────────────────────────

export function BackgroundEventCard({ event }: BackgroundEventCardProps) {
  const { type, data, timestamp } = event
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  switch (type) {
    case 'score-update': {
      const scores = data.scores as Record<string, unknown> | undefined
      const newScore = (scores?.overall as number) ?? 0
      const prev = (data.previousOverall as number) ?? 0
      const delta = (data.delta as number) ?? 0
      const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
      const deltaColor = delta >= 0 ? '#4ade80' : '#f87171'

      return (
        <div style={cardStyle}>
          <span style={{ color: '#6a6aff' }}>🔮</span>
          <span style={{ color: '#8a8ab0' }}>
            Loci re-evaluated: {prev.toFixed(1)} → {newScore.toFixed(1)}{' '}
            <span style={{ color: deltaColor }}>({deltaStr})</span>
          </span>
          <span style={timeStyle}>{time}</span>
        </div>
      )
    }

    case 'score-warning': {
      const message = (data.message as string) ?? 'Theme score dropped significantly.'
      const newScore = (data.newScore as number) ?? 0

      return (
        <div style={{ ...cardStyle, borderColor: '#4a3a10', background: '#1a1808' }}>
          <span style={{ color: '#facc15' }}>⚠</span>
          <span style={{ color: '#d4c060' }}>
            {message} ({newScore.toFixed(1)}/10)
          </span>
          <span style={timeStyle}>{time}</span>
        </div>
      )
    }

    case 'asset-complete': {
      const knotId = (data.knotId as string) ?? ''
      return (
        <div style={cardStyle}>
          <span style={{ color: '#4a9a4a' }}>●</span>
          <span style={{ color: '#6a8a6a' }}>
            Asset ready{knotId ? `: ${knotId}` : ''}
          </span>
          <span style={timeStyle}>{time}</span>
        </div>
      )
    }

    default:
      return null
  }
}

// ─── Styles ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 9,
  color: '#6a6a9a',
  background: '#0a0a15',
  border: '1px solid #1a1a2e',
  borderRadius: 4,
  padding: '3px 8px',
  alignSelf: 'center',
  maxWidth: '85%',
}

const timeStyle: React.CSSProperties = {
  fontSize: 8,
  color: '#3a3a5a',
  marginLeft: 'auto',
  flexShrink: 0,
}
