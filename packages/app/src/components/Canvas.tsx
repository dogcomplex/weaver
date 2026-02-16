import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnConnect,
  type OnNodesChange,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWeave } from '../hooks/useWeave.js'
import { knotsToNodes, threadsToEdges, nodesToPositionMap } from '../lib/xyflow-bridge.js'
import { KnotNode } from './KnotNode.js'
import { ThreadEdge } from './ThreadEdge.js'
import { ContextMenu, type ContextMenuState } from './ContextMenu.js'
import type { Selection } from '../hooks/useSelection.js'

const nodeTypes: NodeTypes = {
  knot: KnotNode,
  veiled: KnotNode,
}

const edgeTypes: EdgeTypes = {
  thread: ThreadEdge,
  gated: ThreadEdge,
}

interface CanvasProps {
  selection: Selection | null
  onSelectKnot: (id: string) => void
  onSelectThread: (id: string) => void
  onClearSelection: () => void
}

function CanvasInner({ selection, onSelectKnot, onSelectThread, onClearSelection }: CanvasProps) {
  const { state, dispatch } = useWeave()
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Track whether we're currently dragging to avoid overwriting positions
  const isDragging = useRef(false)
  // Ref for latest state (used in native event listener)
  const stateRef = useRef(state)
  stateRef.current = state

  // Sync Weave state → XYFlow nodes/edges whenever the weave changes
  useEffect(() => {
    if (!isDragging.current) {
      const newNodes = knotsToNodes(state.current)
      // Preserve selected state
      if (selection?.type === 'knot') {
        for (const n of newNodes) {
          n.selected = n.id === selection.id
        }
      }
      setNodes(newNodes)

      const newEdges = threadsToEdges(state.current)
      if (selection?.type === 'thread') {
        for (const e of newEdges) {
          e.selected = e.id === selection.id
        }
      }
      setEdges(newEdges)
    }
  }, [state.current, setNodes, setEdges, selection])

  // Sync XYFlow nodes back to Weave when positions change
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)

      for (const c of changes) {
        if (c.type === 'position' && c.dragging === true) {
          isDragging.current = true
        }
        // Handle XYFlow selection changes
        if (c.type === 'select' && 'selected' in c) {
          if (c.selected) {
            onSelectKnot(c.id)
          }
        }
      }

      // Batch position updates on drag end
      const positionChanges = changes.filter(
        (c) => c.type === 'position' && c.dragging === false
      )
      if (positionChanges.length > 0) {
        isDragging.current = false
        setNodes((currentNodes) => {
          const positions = nodesToPositionMap(currentNodes)
          dispatch({ type: 'updatePositions', positions })
          return currentNodes
        })
      }
    },
    [onNodesChange, dispatch, setNodes, onSelectKnot]
  )

  // Handle edge selection
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onSelectThread(edge.id)
    },
    [onSelectThread]
  )

  // When user connects two nodes in XYFlow, create a thread
  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        dispatch({ type: 'thread', source: connection.source, target: connection.target })
        setEdges((eds) => addEdge({ ...connection, type: 'thread' }, eds))
      }
    },
    [dispatch, setEdges]
  )

  // Double-click on canvas background to create a new knot
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const label = `Knot ${state.current.knots.size + 1}`
      dispatch({ type: 'mark', input: { label, position } })
    },
    [dispatch, state.current.knots.size, screenToFlowPosition]
  )

  // Clear selection on canvas background click
  const onPaneClick = useCallback(() => {
    onClearSelection()
    setContextMenu(null)
  }, [onClearSelection])

  // --- Unified Context Menu via native event ---

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const target = e.target as HTMLElement
      const currentState = stateRef.current

      // Check if right-clicked on a node
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute('data-id')
        if (nodeId) {
          onSelectKnot(nodeId)
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                label: 'Edit Label',
                onClick: () => {
                  const knot = currentState.current.knots.get(nodeId)
                  const newLabel = prompt('Knot label:', knot?.label ?? '')
                  if (newLabel !== null && newLabel !== knot?.label) {
                    dispatch({ type: 'updateKnot', knotId: nodeId, changes: { label: newLabel } })
                  }
                },
              },
              {
                label: 'Duplicate',
                onClick: () => {
                  const knot = currentState.current.knots.get(nodeId)
                  if (knot) {
                    dispatch({
                      type: 'mark',
                      input: {
                        label: `${knot.label} (copy)`,
                        type: knot.type,
                        position: { x: knot.position.x + 40, y: knot.position.y + 40 },
                        data: { ...knot.data },
                      },
                    })
                  }
                },
              },
              {
                label: 'Delete',
                shortcut: 'Del',
                danger: true,
                onClick: () => {
                  dispatch({ type: 'cut', knotId: nodeId })
                  onClearSelection()
                },
              },
            ],
          })
          return
        }
      }

      // Check if right-clicked on an edge
      const edgeEl = target.closest('.react-flow__edge') as HTMLElement | null
      if (edgeEl) {
        const edgeId = edgeEl.getAttribute('data-testid')?.replace('rf__edge-', '')
          || edgeEl.querySelector('[data-testid]')?.getAttribute('data-testid')?.replace('rf__edge-', '')
        // Try to get edge id from the aria attributes or class
        const edgeIdFromAttr = edgeEl.getAttribute('data-id')
        const actualEdgeId = edgeIdFromAttr || edgeId
        if (actualEdgeId) {
          onSelectThread(actualEdgeId)
          const thread = currentState.current.threads.get(actualEdgeId)
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                label: 'Edit Label',
                onClick: () => {
                  const newLabel = prompt('Thread label:', thread?.label ?? '')
                  if (newLabel !== null) {
                    dispatch({
                      type: 'updateThread',
                      threadId: actualEdgeId,
                      changes: { label: newLabel || undefined },
                    })
                  }
                },
              },
              {
                label: thread?.gate ? 'Edit Gate' : 'Add Gate',
                onClick: () => {
                  const expr = prompt('Gate expression:', thread?.gate?.expression ?? '')
                  if (expr !== null) {
                    if (expr) {
                      dispatch({
                        type: 'updateThread',
                        threadId: actualEdgeId,
                        changes: { gate: { expression: expr } },
                      })
                    } else if (thread?.gate) {
                      dispatch({
                        type: 'updateThread',
                        threadId: actualEdgeId,
                        changes: { gate: null },
                      })
                    }
                  }
                },
              },
              {
                label: 'Delete',
                shortcut: 'Del',
                danger: true,
                onClick: () => {
                  dispatch({ type: 'snip', threadId: actualEdgeId })
                  onClearSelection()
                },
              },
            ],
          })
          return
        }
      }

      // Right-click on canvas background
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: 'Add Knot',
            onClick: () => {
              const label = `Knot ${currentState.current.knots.size + 1}`
              dispatch({ type: 'mark', input: { label, position } })
            },
          },
        ],
      })
    }

    wrapper.addEventListener('contextmenu', handleContextMenu)
    return () => wrapper.removeEventListener('contextmenu', handleContextMenu)
  }, [dispatch, onSelectKnot, onSelectThread, onClearSelection, screenToFlowPosition])

  // --- Keyboard Shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection?.type === 'knot') {
          dispatch({ type: 'cut', knotId: selection.id })
          onClearSelection()
        } else if (selection?.type === 'thread') {
          dispatch({ type: 'snip', threadId: selection.id })
          onClearSelection()
        }
        return
      }

      // Ctrl+Z / Ctrl+Y
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          dispatch({ type: 'undo' })
        } else if (e.key === 'y') {
          e.preventDefault()
          dispatch({ type: 'redo' })
        } else if (e.key === 's') {
          e.preventDefault()
          // Save is handled by sidebar, but prevent browser default
        }
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        onClearSelection()
        setContextMenu(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection, dispatch, onClearSelection])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneDoubleClick={onPaneDoubleClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0a0a0a' }}
        deleteKeyCode={null}
      >
        <Background color="#1a1a2e" gap={20} />
        <Controls />
        <MiniMap
          nodeColor="#1a1a2e"
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: '#111' }}
        />
      </ReactFlow>
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

export function Canvas(props: CanvasProps) {
  return <CanvasInner {...props} />
}
