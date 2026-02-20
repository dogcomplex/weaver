/**
 * AgentActivityCard — Renders sub-agent (Loci, asset-generator) activity
 * inside tool call cards in the chat panel.
 *
 * Shows a live-updating timeline of events:
 *   - Prompts sent to the sub-agent (system + user)
 *   - Progress updates (e.g., "Proposal 2/3 sent to Sonnet")
 *   - Results with scores, token counts, and model badges
 *   - Asset queue events (cached vs pending)
 *
 * Collapsible: header always visible, details expand on click.
 */

import { useState, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'start'; detail: string; ts: number }
  | { type: 'prompt'; phase: string; systemPrompt?: string; userPrompt: string; ts: number }
  | { type: 'progress'; phase: string; current?: number; total?: number; detail: string; ts: number }
  | { type: 'result'; phase: string; summary: string; inputPreview?: string; outputPreview?: string; tokens?: { input: number; output: number }; model?: string; ts: number }
  | { type: 'complete'; summary: string; ts: number }
  | { type: 'asset_queued'; knotType: string; hash: string; prompt: string; cached: boolean; ts: number }

export interface AgentActivity {
  toolCallId: string
  agentName: string
  operation: string
  status: 'running' | 'complete'
  events: AgentEvent[]
}

interface AgentActivityCardProps {
  activity: AgentActivity
}

// ─── Component ──────────────────────────────────────────────────

export function AgentActivityCard({ activity }: AgentActivityCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set())
  const [fullPrompts, setFullPrompts] = useState<Set<number>>(new Set())

  const togglePrompt = useCallback((idx: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const toggleFullPrompt = useCallback((idx: number) => {
    setFullPrompts(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  // Compute latest status line for collapsed view
  const latestStatus = getLatestStatus(activity)
  const isLoci = activity.agentName === 'loci'
  const accentColor = isLoci ? '#6a6aff' : '#4a9a4a'

  // Compute total tokens
  const totalTokens = activity.events.reduce((acc, evt) => {
    if (evt.type === 'result' && evt.tokens) {
      return { input: acc.input + evt.tokens.input, output: acc.output + evt.tokens.output }
    }
    return acc
  }, { input: 0, output: 0 })

  return (
    <div style={{ ...cardStyle, borderLeftColor: accentColor }}>
      {/* Header — always visible */}
      <div
        style={headerStyle}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 10, color: accentColor }}>
          {activity.status === 'running' ? '⟳' : '✓'}
          {' '}
          {isLoci ? 'Loci' : 'Assets'}
          {' '}
          <span style={{ color: '#6a6a9a' }}>›</span>
          {' '}
          <span style={{ color: '#9a9ab0' }}>{latestStatus}</span>
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {totalTokens.input > 0 && (
            <span style={tokenBadgeStyle}>
              {formatTokens(totalTokens.input + totalTokens.output)} tok
            </span>
          )}
          <span style={{ fontSize: 9, color: '#4a4a6a' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {/* Expanded event timeline */}
      {expanded && (
        <div style={timelineStyle}>
          {activity.events.map((evt, i) => (
            <div key={i}>
              {renderEvent(evt, i, expandedPrompts, fullPrompts, togglePrompt, toggleFullPrompt)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Event Renderers ────────────────────────────────────────────

function renderEvent(
  evt: AgentEvent,
  idx: number,
  expandedPrompts: Set<number>,
  fullPrompts: Set<number>,
  togglePrompt: (idx: number) => void,
  toggleFullPrompt: (idx: number) => void,
): React.ReactNode {
  switch (evt.type) {
    case 'start':
      return (
        <div style={eventLineStyle}>
          <span style={{ color: '#6a6aff' }}>●</span>
          <span style={{ color: '#8a8ab0' }}>{evt.detail}</span>
        </div>
      )

    case 'progress':
      return (
        <div style={eventLineStyle}>
          <span style={{ color: '#6a6aff' }}>
            {evt.current && evt.total ? `[${evt.current}/${evt.total}]` : '→'}
          </span>
          <span style={{ color: '#8a8ab0' }}>{evt.detail}</span>
        </div>
      )

    case 'prompt': {
      const isExpanded = expandedPrompts.has(idx)
      return (
        <div>
          <div
            style={{ ...eventLineStyle, cursor: 'pointer' }}
            onClick={() => togglePrompt(idx)}
          >
            <span style={{ color: '#5a5a8a' }}>{isExpanded ? '▾' : '▸'}</span>
            <span style={{ color: '#5a5a8a' }}>
              {evt.systemPrompt ? 'System + User Prompt' : 'User Prompt'}
              <span style={{ color: '#3a3a5a', fontSize: 8, marginLeft: 4 }}>({evt.phase})</span>
            </span>
          </div>
          {isExpanded && (
            <div style={{ paddingLeft: 16 }}>
              {evt.systemPrompt && (
                <div style={{ marginBottom: 4 }}>
                  <div style={promptLabelStyle}>System Prompt</div>
                  <pre style={promptBlockStyle}>
                    {truncatePrompt(evt.systemPrompt, fullPrompts.has(idx))}
                  </pre>
                </div>
              )}
              <div>
                <div style={promptLabelStyle}>User Prompt</div>
                <pre style={promptBlockStyle}>
                  {truncatePrompt(evt.userPrompt, fullPrompts.has(idx))}
                </pre>
              </div>
              {(evt.systemPrompt ? evt.systemPrompt.split('\n').length > 40 : false) ||
               evt.userPrompt.split('\n').length > 40 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFullPrompt(idx) }}
                  style={showMoreBtnStyle}
                >
                  {fullPrompts.has(idx) ? 'Show less' : 'Show full prompt'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )
    }

    case 'result':
      return (
        <div style={eventLineStyle}>
          <span style={{ color: '#4ade80' }}>✓</span>
          <span style={{ color: '#a0a0c0' }}>{evt.summary}</span>
          {evt.model && (
            <span style={modelBadgeStyle(evt.model)}>
              {evt.model.includes('sonnet') ? 'S' : evt.model.includes('haiku') ? 'H' : 'M'}
            </span>
          )}
          {evt.tokens && (
            <span style={tokenBadgeStyle}>
              {formatTokens(evt.tokens.input)}↑ {formatTokens(evt.tokens.output)}↓
            </span>
          )}
        </div>
      )

    case 'complete':
      return (
        <div style={eventLineStyle}>
          <span style={{ color: '#4ade80' }}>✓</span>
          <span style={{ color: '#a0a0c0', fontWeight: 600 }}>{evt.summary}</span>
        </div>
      )

    case 'asset_queued':
      return (
        <div style={eventLineStyle}>
          <span style={{ color: evt.cached ? '#4a9a4a' : '#facc15' }}>
            {evt.cached ? '●' : '○'}
          </span>
          <span style={{ color: '#8a8ab0' }}>
            {evt.knotType}
          </span>
          <span style={evt.cached ? cachedBadgeStyle : pendingBadgeStyle}>
            {evt.cached ? 'cached' : 'generating'}
          </span>
        </div>
      )

    default:
      return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function getLatestStatus(activity: AgentActivity): string {
  const events = activity.events
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i]
    if (evt.type === 'complete') return evt.summary
    if (evt.type === 'result') return evt.summary
    if (evt.type === 'progress') {
      if (evt.current && evt.total) return `${evt.detail} (${evt.current}/${evt.total})`
      return evt.detail ?? ''
    }
    if (evt.type === 'start') return evt.detail
  }
  return activity.operation
}

function truncatePrompt(text: string, showFull: boolean): string {
  if (showFull) return text
  const lines = text.split('\n')
  if (lines.length <= 40) return text
  return lines.slice(0, 40).join('\n') + `\n\n... (${lines.length - 40} more lines)`
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Styles ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#08081a',
  borderLeft: '2px solid #6a6aff',
  borderRadius: 4,
  margin: '2px 0',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 8px',
  cursor: 'pointer',
  userSelect: 'none',
}

const timelineStyle: React.CSSProperties = {
  padding: '2px 8px 6px',
  borderTop: '1px solid #12121e',
  maxHeight: 400,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const eventLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 9,
  lineHeight: 1.4,
  padding: '1px 0',
}

const promptLabelStyle: React.CSSProperties = {
  fontSize: 8,
  color: '#4a4a6a',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: 2,
}

const promptBlockStyle: React.CSSProperties = {
  fontSize: 9,
  color: '#7a7a9a',
  background: '#0a0a15',
  border: '1px solid #15152a',
  borderRadius: 3,
  padding: '4px 6px',
  margin: 0,
  maxHeight: 300,
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'monospace',
}

const showMoreBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6a6aff',
  fontSize: 8,
  cursor: 'pointer',
  padding: '2px 0',
}

const tokenBadgeStyle: React.CSSProperties = {
  fontSize: 8,
  color: '#4a4a6a',
  flexShrink: 0,
}

function modelBadgeStyle(model: string): React.CSSProperties {
  const isSonnet = model.includes('sonnet')
  return {
    fontSize: 7,
    fontWeight: 700,
    color: isSonnet ? '#6a6aff' : '#4a9a4a',
    background: isSonnet ? 'rgba(106, 106, 255, 0.15)' : 'rgba(74, 154, 74, 0.15)',
    borderRadius: 2,
    padding: '0 3px',
    flexShrink: 0,
  }
}

const cachedBadgeStyle: React.CSSProperties = {
  fontSize: 7,
  color: '#4a8a4a',
  background: 'rgba(74, 138, 74, 0.15)',
  borderRadius: 2,
  padding: '0 3px',
}

const pendingBadgeStyle: React.CSSProperties = {
  fontSize: 7,
  color: '#facc15',
  background: 'rgba(250, 204, 21, 0.15)',
  borderRadius: 2,
  padding: '0 3px',
}
