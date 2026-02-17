/**
 * ClassicRenderer — the "Unveiled" view.
 *
 * Implements WeaveRendererProps using @xyflow/react.
 * Extracted from Canvas.tsx to decouple rendering from state management.
 * This renderer shows the raw Weaver graph without any glamour.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
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

import type { WeaveRendererProps } from '#weaver/glamour'
import { knotsToNodes, threadsToEdges, nodesToPositionMap } from '../lib/xyflow-bridge.js'
import { KnotNode } from '../components/KnotNode.js'
import { ThreadEdge } from '../components/ThreadEdge.js'
import { ContextMenu, type ContextMenuState } from '../components/ContextMenu.js'

const nodeTypes: NodeTypes = {
  knot: KnotNode,
  veiled: KnotNode,
}

const edgeTypes: EdgeTypes = {
  thread: ThreadEdge,
  gated: ThreadEdge,
}

function ClassicRendererInner({
  weave,
  selection,
  animationState,
  onWeaveAction,
  onSelectionChange,
}: WeaveRendererProps) {
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Track whether we're currently dragging to avoid overwriting positions
  const isDragging = useRef(false)
  // Ref for latest weave (used in native event listener closure)
  const weaveRef = useRef(weave)
  weaveRef.current = weave

  // Sync Weave state → XYFlow nodes/edges whenever the weave changes
  useEffect(() => {
    if (!isDragging.current) {
      const knotHighlights = animationState?.activeKnots
      const threadHighlights = animationState?.activeThreads
      const newNodes = knotsToNodes(weave, knotHighlights)
      // Preserve selected state
      if (selection?.type === 'knot') {
        for (const n of newNodes) {
          n.selected = n.id === selection.id
        }
      }
      setNodes(newNodes)

      const newEdges = threadsToEdges(weave, threadHighlights)
      if (selection?.type === 'thread') {
        for (const e of newEdges) {
          e.selected = e.id === selection.id
        }
      }
      setEdges(newEdges)
    }
  }, [weave, setNodes, setEdges, selection, animationState])

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
            onSelectionChange({ type: 'knot', id: c.id })
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
          onWeaveAction({ type: 'updatePositions', positions })
          return currentNodes
        })
      }
    },
    [onNodesChange, onWeaveAction, setNodes, onSelectionChange]
  )

  // Handle edge selection
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onSelectionChange({ type: 'thread', id: edge.id })
    },
    [onSelectionChange]
  )

  // When user connects two nodes in XYFlow, create a thread
  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        onWeaveAction({ type: 'thread', source: connection.source, target: connection.target })
        setEdges((eds) => addEdge({ ...connection, type: 'thread' }, eds))
      }
    },
    [onWeaveAction, setEdges]
  )

  // Clear selection on canvas background click
  const onPaneClick = useCallback(() => {
    onSelectionChange(null)
    setContextMenu(null)
  }, [onSelectionChange])

  // --- Unified Context Menu via native event ---

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const target = e.target as HTMLElement
      const currentWeave = weaveRef.current

      // Check if right-clicked on a node
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute('data-id')
        if (nodeId) {
          onSelectionChange({ type: 'knot', id: nodeId })
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                label: 'Edit Label',
                onClick: () => {
                  const knot = currentWeave.knots.get(nodeId)
                  const newLabel = prompt('Knot label:', knot?.label ?? '')
                  if (newLabel !== null && newLabel !== knot?.label) {
                    onWeaveAction({ type: 'updateKnot', knotId: nodeId, changes: { label: newLabel } })
                  }
                },
              },
              {
                label: 'Duplicate',
                onClick: () => {
                  const knot = currentWeave.knots.get(nodeId)
                  if (knot) {
                    onWeaveAction({
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
                  onWeaveAction({ type: 'cut', knotId: nodeId })
                  onSelectionChange(null)
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
          onSelectionChange({ type: 'thread', id: actualEdgeId })
          const thread = currentWeave.threads.get(actualEdgeId)
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                label: 'Edit Label',
                onClick: () => {
                  const newLabel = prompt('Thread label:', thread?.label ?? '')
                  if (newLabel !== null) {
                    onWeaveAction({
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
                      onWeaveAction({
                        type: 'updateThread',
                        threadId: actualEdgeId,
                        changes: { gate: { expression: expr } },
                      })
                    } else if (thread?.gate) {
                      onWeaveAction({
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
                  onWeaveAction({ type: 'snip', threadId: actualEdgeId })
                  onSelectionChange(null)
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
              const label = `Knot ${currentWeave.knots.size + 1}`
              onWeaveAction({ type: 'mark', input: { label, position } })
            },
          },
        ],
      })
    }

    wrapper.addEventListener('contextmenu', handleContextMenu)
    return () => wrapper.removeEventListener('contextmenu', handleContextMenu)
  }, [onWeaveAction, onSelectionChange, screenToFlowPosition])

  // --- Double-click to create knot ---
  // Must use native capture-phase listener because ReactFlow stops dblclick propagation
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Only on pane background, not on a node/edge
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return
      // Ignore clicks on controls/minimap
      if (target.closest('.react-flow__controls') || target.closest('.react-flow__minimap')) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const label = `Knot ${weaveRef.current.knots.size + 1}`
      onWeaveAction({ type: 'mark', input: { label, position } })
    }

    // Use capture phase to receive the event before ReactFlow stops propagation
    wrapper.addEventListener('dblclick', handleDblClick, true)
    return () => wrapper.removeEventListener('dblclick', handleDblClick, true)
  }, [onWeaveAction, screenToFlowPosition])

  // --- Keyboard Shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection?.type === 'knot') {
          onWeaveAction({ type: 'cut', knotId: selection.id })
          onSelectionChange(null)
        } else if (selection?.type === 'thread') {
          onWeaveAction({ type: 'snip', threadId: selection.id })
          onSelectionChange(null)
        }
        return
      }

      // Ctrl+Z / Ctrl+Y
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          onWeaveAction({ type: 'undo' })
        } else if (e.key === 'y') {
          e.preventDefault()
          onWeaveAction({ type: 'redo' })
        } else if (e.key === 's') {
          e.preventDefault()
          // Save is handled by sidebar, but prevent browser default
        }
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        onSelectionChange(null)
        setContextMenu(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection, onWeaveAction, onSelectionChange])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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

export function ClassicRenderer(props: WeaveRendererProps) {
  return (
    <ReactFlowProvider>
      <ClassicRendererInner {...props} />
    </ReactFlowProvider>
  )
}
