import { useState, useCallback } from 'react'
import { ClassicRenderer } from './renderers/ClassicRenderer.js'
import { ComfyUIRenderer } from './renderers/ComfyUIRenderer.js'
import { Sidebar } from './components/Sidebar.js'
import { ViewTabs } from './components/ViewTabs.js'
import { PropertiesPanel } from './components/PropertiesPanel.js'
import { TracePanel } from './components/TracePanel.js'
import { ImagePanel } from './components/ImagePanel.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { WeaveProvider, useWeave } from './hooks/useWeave.js'
import { useSelection } from './hooks/useSelection.js'
import { useWaveAnimation } from './hooks/useWaveAnimation.js'
import type { WeaveAction, Selection, ViewMode } from '#weaver/glamour'

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
        <ViewTabs activeView={viewMode} onViewChange={setViewMode} />
        <div style={{ flex: 1, position: 'relative' }}>
          <ErrorBoundary>
            {viewMode === 'unveiled' && (
              <ClassicRenderer {...rendererProps} />
            )}
            {viewMode === 'comfyui' && (
              <ComfyUIRenderer {...rendererProps} />
            )}
            {viewMode === 'glamour' && (
              <GlamourPlaceholder />
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
      <ErrorBoundary>
        <PropertiesPanel
          selection={selection}
          onClose={() => setSelection(null)}
        />
      </ErrorBoundary>
    </div>
  )
}

/** Placeholder for the Glamour renderer (Phase 3) */
function GlamourPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 24,
          color: '#2a2a4e',
          fontWeight: 300,
          letterSpacing: '2px',
        }}
      >
        ✦ GLAMOUR ✦
      </div>
      <div style={{ fontSize: 13, color: '#3a3a5a' }}>
        PixiJS glamour renderer coming in Phase 3
      </div>
      <div style={{ fontSize: 11, color: '#2a2a3e', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
        Complexity disguised as elegant minimalism — many controls that feel like
        just one thing, which the user already "knows"
      </div>
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
