/**
 * AIChatPanel — The Weaver's chat interface.
 *
 * Collapsible right-side panel for conversing with Claude.
 * Messages stream as SSE from the /api/ai/chat endpoint.
 * Tool execution results show inline as collapsible cards.
 *
 * The panel sends the current weaveId and active themeId
 * so Claude operates on the loaded weave and narrates in
 * the active glamour's vocabulary.
 *
 * State is lifted to App.tsx so messages persist across panel toggle.
 * Sessions are stored server-side for cold storage persistence.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useWeave } from '../hooks/useWeave.js'
import { AgentActivityCard, type AgentActivity, type AgentEvent } from './AgentActivityCard.js'
import { BackgroundEventCard, type BackgroundEvent } from './BackgroundEventCard.js'

// ─── Types (exported for App.tsx) ────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolCall {
  id: string
  name: string
  input?: Record<string, any>
  result?: Record<string, any>
  pending: boolean
}

interface AIStatus {
  configured: boolean
  model: string
  tools: number
}

interface SessionSummary {
  id: string
  weaveId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string
}

// ─── WebSocket Listener Type ────────────────────────────────────

type WebSocketListener = (msg: Record<string, unknown>) => void

// ─── Props ──────────────────────────────────────────────────────

interface AIChatPanelProps {
  open: boolean
  onClose: () => void
  themeId?: string
  // Lifted state from App.tsx
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  toolCalls: ToolCall[]
  setToolCalls: React.Dispatch<React.SetStateAction<ToolCall[]>>
  sessionId: string | null
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>
  // Shared WebSocket subscription for background events
  wsSubscribe?: (listener: WebSocketListener) => () => void
}

// ─── Component ──────────────────────────────────────────────────

export function AIChatPanel({
  open,
  onClose,
  themeId,
  messages,
  setMessages,
  toolCalls,
  setToolCalls,
  sessionId,
  setSessionId,
  wsSubscribe,
}: AIChatPanelProps) {
  const { state } = useWeave()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [agentActivities, setAgentActivities] = useState<Map<string, AgentActivity>>(new Map())
  const [backgroundEvents, setBackgroundEvents] = useState<BackgroundEvent[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Check AI status on mount
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolCalls, agentActivities, backgroundEvents])

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Subscribe to background WebSocket events (loci-watcher, asset completions)
  useEffect(() => {
    if (!wsSubscribe) return
    return wsSubscribe((msg) => {
      if (msg.type === 'glamour-scores-updated') {
        setBackgroundEvents(prev => [...prev.slice(-49), {
          id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'score-update' as const,
          timestamp: Date.now(),
          data: msg,
        }])
      } else if (msg.type === 'glamour-score-warning') {
        setBackgroundEvents(prev => [...prev.slice(-49), {
          id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'score-warning' as const,
          timestamp: Date.now(),
          data: msg,
        }])
      } else if (msg.type === 'glamour-asset' && msg.knotId) {
        setBackgroundEvents(prev => [...prev.slice(-49), {
          id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'asset-complete' as const,
          timestamp: Date.now(),
          data: msg,
        }])
      }
    })
  }, [wsSubscribe])

  // ─── Load Session History ──────────────────────────────────────

  const loadSessionList = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch {
      setSessions([])
    }
  }, [])

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/sessions/${id}`)
      if (res.ok) {
        const session = await res.json()
        // Restore messages from session
        const restored: ChatMessage[] = session.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        }))
        setMessages(restored)
        setSessionId(session.id)
        setToolCalls([])
        setShowHistory(false)
      }
    } catch {
      // Failed to load session
    }
  }, [setMessages, setSessionId, setToolCalls])

  // ─── Send Message ──────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)
    setToolCalls([])

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          weaveId: state.current.id,
          themeId,
          sessionId,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${err.message ?? err.error}` },
        ])
        setIsStreaming(false)
        return
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) {
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let assistantText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''  // Keep incomplete line in buffer

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              handleSSEEvent(eventType, parsed)
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

      function handleSSEEvent(event: string, data: any) {
        switch (event) {
          case 'session_start':
            // Server assigned a session ID
            if (data.sessionId) {
              setSessionId(data.sessionId)
            }
            break
          case 'text_delta':
            assistantText += data.text
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }]
              }
              return [...prev, { role: 'assistant', content: assistantText }]
            })
            break
          case 'tool_use':
            setToolCalls(prev => [
              ...prev,
              { id: data.id, name: data.name, pending: true },
            ])
            break
          case 'tool_result':
            setToolCalls(prev =>
              prev.map(tc =>
                tc.id === data.id
                  ? { ...tc, input: data.input, result: data.result, pending: false }
                  : tc
              )
            )
            break
          case 'done':
            // Session ID may come with done event too
            if (data.sessionId && !sessionId) {
              setSessionId(data.sessionId)
            }
            break
          case 'error':
            assistantText += `\n\n⚠ ${data.message}`
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }]
              }
              return [...prev, { role: 'assistant', content: assistantText }]
            })
            break

          // ─── Sub-Agent Activity Events ──────────────────────
          case 'agent_start': {
            const toolCallId = data.toolCallId as string
            const activity: AgentActivity = {
              toolCallId,
              agentName: data.agentName as string,
              operation: data.operation as string,
              status: 'running',
              events: [{ type: 'start', detail: data.detail as string, ts: Date.now() }],
            }
            setAgentActivities(prev => {
              const next = new Map(prev)
              next.set(toolCallId, activity)
              return next
            })
            break
          }
          case 'agent_progress':
          case 'agent_prompt':
          case 'agent_result': {
            const toolCallId = data.toolCallId as string
            const evtType = event.replace('agent_', '') as AgentEvent['type']
            setAgentActivities(prev => {
              const next = new Map(prev)
              const existing = next.get(toolCallId)
              if (existing) {
                const newActivity = { ...existing, events: [...existing.events, { ...data, type: evtType, ts: Date.now() } as AgentEvent] }
                next.set(toolCallId, newActivity)
              }
              return next
            })
            break
          }
          case 'agent_complete': {
            const toolCallId = data.toolCallId as string
            setAgentActivities(prev => {
              const next = new Map(prev)
              const existing = next.get(toolCallId)
              if (existing) {
                const newActivity = {
                  ...existing,
                  status: 'complete' as const,
                  events: [...existing.events, { type: 'complete' as const, summary: data.summary as string, ts: Date.now() }],
                }
                next.set(toolCallId, newActivity)
              }
              return next
            })
            break
          }
          case 'asset_queued': {
            const toolCallId = data.toolCallId as string
            setAgentActivities(prev => {
              const next = new Map(prev)
              const existing = next.get(toolCallId)
              if (existing) {
                const newActivity = {
                  ...existing,
                  events: [...existing.events, {
                    type: 'asset_queued' as const,
                    knotType: data.knotType as string,
                    hash: data.hash as string,
                    prompt: data.prompt as string,
                    cached: data.cached as boolean,
                    ts: Date.now(),
                  }],
                }
                next.set(toolCallId, newActivity)
              }
              return next
            })
            break
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Connection error: ${err.message}` },
        ])
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, messages, isStreaming, state.current.id, themeId, sessionId, setMessages, setToolCalls, setSessionId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  const toggleToolExpanded = useCallback((id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setToolCalls([])
    setSessionId(null)
    setShowHistory(false)
    setAgentActivities(new Map())
    setBackgroundEvents([])
  }, [setMessages, setToolCalls, setSessionId])

  // ─── Render ───────────────────────────────────────────────────

  if (!open) return null

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#e0e0e0' }}>
          AI Chat
          {status?.configured && (
            <span style={{ fontSize: 10, color: '#4a9', marginLeft: 8 }}>●</span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => {
              setShowHistory(p => !p)
              if (!showHistory) loadSessionList()
            }}
            style={historyButtonStyle}
            title="Session history"
          >
            ⏱
          </button>
          <button
            onClick={handleNewChat}
            style={historyButtonStyle}
            title="New chat"
          >
            +
          </button>
          <button onClick={onClose} style={closeButtonStyle} title="Close AI Panel">
            ✕
          </button>
        </div>
      </div>

      {/* Status warning */}
      {status && !status.configured && (
        <div style={warningStyle}>
          Set <code>ANTHROPIC_API_KEY</code> environment variable to enable AI chat.
        </div>
      )}

      {/* Session history dropdown */}
      {showHistory && (
        <div style={historyPanelStyle}>
          <div style={{ fontSize: 10, color: '#6a6a9a', marginBottom: 6, fontWeight: 600 }}>
            Previous Sessions
          </div>
          {sessions.length === 0 && (
            <div style={{ fontSize: 11, color: '#4a4a6a' }}>No saved sessions</div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => loadSession(s.id)}
              style={sessionItemStyle}
            >
              <div style={{ fontSize: 11, color: '#c0c0d0' }}>{s.preview}</div>
              <div style={{ fontSize: 9, color: '#4a4a6a', marginTop: 2 }}>
                {s.messageCount} messages · {new Date(s.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={messagesContainerStyle}>
        {messages.length === 0 && (
          <div style={emptyStyle}>
            Ask the Weaver to build a workflow, describe the current weave, or suggest metaphors.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? userMessageStyle : assistantMessageStyle}>
            <div style={{ fontSize: 10, color: '#6a6a9a', marginBottom: 2 }}>
              {msg.role === 'user' ? 'You' : 'Weaver'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Tool call cards */}
        {toolCalls.map(tc => {
          const activity = agentActivities.get(tc.id)
          return (
            <div key={tc.id} style={toolCardStyle}>
              <div
                style={toolCardHeaderStyle}
                onClick={() => toggleToolExpanded(tc.id)}
              >
                <span style={{ fontSize: 10, color: '#6a6aff' }}>
                  {tc.pending ? (activity?.status === 'running' ? '⟳' : '⏳') : '✓'} {formatToolName(tc.name)}
                </span>
                <span style={{ fontSize: 10, color: '#4a4a6a' }}>
                  {expandedTools.has(tc.id) ? '▾' : '▸'}
                </span>
              </div>

              {/* Sub-agent activity (always visible when running, or when expanded) */}
              {activity && (activity.status === 'running' || expandedTools.has(tc.id)) && (
                <AgentActivityCard activity={activity} />
              )}

              {/* Raw tool result (collapsed by default) */}
              {expandedTools.has(tc.id) && tc.result && (
                <pre style={toolDetailStyle}>
                  {JSON.stringify(tc.result, null, 2)}
                </pre>
              )}
            </div>
          )
        })}

        {/* Background events (score updates, warnings, asset completions) */}
        {backgroundEvents.map(evt => (
          <BackgroundEventCard key={evt.id} event={evt} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div style={streamingStyle}>
            <span style={dotStyle}>●</span>
            <span style={{ ...dotStyle, animationDelay: '0.2s' }}>●</span>
            <span style={{ ...dotStyle, animationDelay: '0.4s' }}>●</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={inputContainerStyle}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={status?.configured ? 'Ask the Weaver...' : 'AI not configured'}
          disabled={!status?.configured || isStreaming}
          style={textareaStyle}
          rows={2}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isStreaming || !status?.configured}
          style={sendButtonStyle}
          title="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

function formatToolName(name: string): string {
  return name
    .replace('weaver_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Styles ─────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  width: 340,
  minWidth: 280,
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  background: '#0d0d1a',
  borderLeft: '1px solid #1a1a2e',
  height: '100%',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid #1a1a2e',
  flexShrink: 0,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6a6a9a',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
}

const historyButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6a6a9a',
  cursor: 'pointer',
  fontSize: 12,
  padding: '2px 6px',
}

const warningStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#1a1a0d',
  color: '#aa8',
  fontSize: 11,
  borderBottom: '1px solid #1a1a2e',
}

const historyPanelStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#0a0a15',
  borderBottom: '1px solid #1a1a2e',
  maxHeight: 200,
  overflowY: 'auto',
}

const sessionItemStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  marginBottom: 4,
  background: '#12121e',
  border: '1px solid #1a1a2e',
}

const messagesContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const emptyStyle: React.CSSProperties = {
  color: '#4a4a6a',
  fontSize: 12,
  textAlign: 'center',
  padding: '40px 20px',
  lineHeight: 1.6,
}

const userMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#1a1a3e',
  borderRadius: 8,
  borderTopRightRadius: 2,
  color: '#c0c0d0',
  fontSize: 12,
  alignSelf: 'flex-end',
  maxWidth: '85%',
}

const assistantMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#12121e',
  borderRadius: 8,
  borderTopLeftRadius: 2,
  color: '#c0c0d0',
  fontSize: 12,
  alignSelf: 'flex-start',
  maxWidth: '85%',
}

const toolCardStyle: React.CSSProperties = {
  background: '#0f0f20',
  border: '1px solid #1a1a3e',
  borderRadius: 6,
  overflow: 'hidden',
  alignSelf: 'center',
  width: '90%',
}

const toolCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 10px',
  cursor: 'pointer',
  userSelect: 'none',
}

const toolDetailStyle: React.CSSProperties = {
  padding: '6px 10px',
  margin: 0,
  fontSize: 10,
  color: '#8a8aaa',
  background: '#0a0a15',
  borderTop: '1px solid #1a1a2e',
  maxHeight: 200,
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}

const streamingStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '4px 12px',
  alignSelf: 'flex-start',
}

const dotStyle: React.CSSProperties = {
  color: '#6a6aff',
  fontSize: 10,
  animation: 'pulse 1s infinite',
}

const inputContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '8px',
  borderTop: '1px solid #1a1a2e',
  flexShrink: 0,
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  background: '#12121e',
  border: '1px solid #1a1a3e',
  borderRadius: 6,
  color: '#c0c0d0',
  fontSize: 12,
  padding: '6px 10px',
  resize: 'none',
  outline: 'none',
  fontFamily: 'inherit',
}

const sendButtonStyle: React.CSSProperties = {
  background: '#1a1a3e',
  border: '1px solid #2a2a4e',
  borderRadius: 6,
  color: '#6a6aff',
  cursor: 'pointer',
  fontSize: 14,
  padding: '4px 10px',
  flexShrink: 0,
}
