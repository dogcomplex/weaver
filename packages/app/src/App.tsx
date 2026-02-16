import { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas.js'
import { Sidebar } from './components/Sidebar.js'
import { PropertiesPanel } from './components/PropertiesPanel.js'
import { TracePanel } from './components/TracePanel.js'
import { ImagePanel } from './components/ImagePanel.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { WeaveProvider, useWeave } from './hooks/useWeave.js'
import { useSelection } from './hooks/useSelection.js'

interface QueueResult {
  prompt_id: string
  images: Array<{ filename: string; url: string }>
}

function AppInner() {
  const { state } = useWeave()
  const { selection, selectKnot, selectThread, clearSelection } = useSelection()
  const [traceResult, setTraceResult] = useState<any>(null)
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null)

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
        <ErrorBoundary>
          <Sidebar
            onTraceResult={setTraceResult}
            onQueueResult={setQueueResult}
          />
        </ErrorBoundary>
        <div style={{ flex: 1, position: 'relative' }}>
          <ErrorBoundary>
            <Canvas
              selection={selection}
              onSelectKnot={selectKnot}
              onSelectThread={selectThread}
              onClearSelection={clearSelection}
            />
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
        <ErrorBoundary>
          <PropertiesPanel
            selection={selection}
            onClose={clearSelection}
          />
        </ErrorBoundary>
      </div>
    </ReactFlowProvider>
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
