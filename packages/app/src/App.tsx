import { useState, useCallback, useEffect } from 'react'
import { ClassicRenderer } from './renderers/ClassicRenderer.js'
import { ComfyUIRenderer } from './renderers/ComfyUIRenderer.js'
import { GlamourRenderer } from './renderers/glamour/index.js'
import { Sidebar } from './components/Sidebar.js'
import { ViewTabs } from './components/ViewTabs.js'
import { PropertiesPanel } from './components/PropertiesPanel.js'
import { AIChatPanel, type ChatMessage, type ToolCall } from './components/AIChatPanel.js'
import { TracePanel } from './components/TracePanel.js'
import { ImagePanel } from './components/ImagePanel.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { WeaveProvider, useWeave } from './hooks/useWeave.js'
import { useSelection } from './hooks/useSelection.js'
import { useWaveAnimation } from './hooks/useWaveAnimation.js'
import { useWeaveWebSocket } from './hooks/useWeaveWebSocket.js'
import type { WeaveAction, Selection, ViewMode, MetaphorManifest } from '#weaver/glamour'

interface QueueResult {
  prompt_id: string
  images: Array<{ filename: string; url: string }>
}

function AppInner() {
  const { state, dispatch } = useWeave()
  const { selection, setSelection } = useSelection()
  const [traceResult, setTraceResult] = useState<any>(null)
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('unveiled')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  // Lifted chat state — persists across AI panel toggle
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatToolCalls, setChatToolCalls] = useState<ToolCall[]>([])
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)

  // Active manifest theme from AI (null = use default LoomTheme)
  const [activeManifest, setActiveManifest] = useState<MetaphorManifest | null>(null)

  // Shared WebSocket connection — single connection for the entire app
  const { subscribe } = useWeaveWebSocket()

  // Subscribe to glamour theme changes via shared WebSocket
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'glamour-theme-changed') {
        setActiveManifest((msg.manifest as MetaphorManifest) ?? null)
      }
    })
  }, [subscribe])

  // Wave animation: auto-plays when trace result changes
  const { animationState } = useWaveAnimation(traceResult)

  // Adapter: WeaveAction → dispatch
  const handleWeaveAction = useCallback(
    (action: WeaveAction) => dispatch(action),
    [dispatch]
  )

  // Adapter: Selection change
  const handleSelectionChange = useCallback(
    (sel: Selection | null) => setSelection(sel),
    [setSelection]
  )

  // Shared renderer props
  const rendererProps = {
    weave: state.current,
    selection,
    traceResult,
    animationState,
    onWeaveAction: handleWeaveAction,
    onSelectionChange: handleSelectionChange,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <ErrorBoundary>
        <Sidebar
          onTraceResult={setTraceResult}
          onQueueResult={setQueueResult}
        />
      </ErrorBoundary>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <ViewTabs activeView={viewMode} onViewChange={setViewMode} />
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setAiPanelOpen(p => !p)}
            style={{
              padding: '4px 12px',
              marginRight: 8,
              background: aiPanelOpen ? '#1a1a3e' : 'transparent',
              color: aiPanelOpen ? '#6a6aff' : '#6a6a9a',
              border: aiPanelOpen ? '1px solid #2a2a4e' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            AI
          </button>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <ErrorBoundary>
            {viewMode === 'unveiled' && (
              <ClassicRenderer {...rendererProps} />
            )}
            {viewMode === 'comfyui' && (
              <ComfyUIRenderer {...rendererProps} />
            )}
            {viewMode === 'glamour' && (
              <GlamourRenderer {...rendererProps} activeManifest={activeManifest} wsSubscribe={subscribe} />
            )}
          </ErrorBoundary>
          {traceResult && (
            <ErrorBoundary>
              <TracePanel
                result={traceResult}
                weave={state.current}
                onClose={() => setTraceResult(null)}
              />
            </ErrorBoundary>
          )}
          {queueResult && (
            <ErrorBoundary>
              <ImagePanel
                result={queueResult}
                onClose={() => setQueueResult(null)}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
      {!aiPanelOpen && (
        <ErrorBoundary>
          <PropertiesPanel
            selection={selection}
            onClose={() => setSelection(null)}
          />
        </ErrorBoundary>
      )}
      {aiPanelOpen && (
        <ErrorBoundary>
          <AIChatPanel
            open={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            themeId={viewMode === 'glamour' ? 'loom' : undefined}
            messages={chatMessages}
            setMessages={setChatMessages}
            toolCalls={chatToolCalls}
            setToolCalls={setChatToolCalls}
            sessionId={chatSessionId}
            setSessionId={setChatSessionId}
          />
        </ErrorBoundary>
      )}
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <WeaveProvider>
        <AppInner />
      </WeaveProvider>
    </ErrorBoundary>
  )
}
