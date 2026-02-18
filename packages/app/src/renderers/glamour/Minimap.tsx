/**
 * Minimap — Small overview of the graph with viewport indicator.
 *
 * Renders in the bottom-right corner. Shows all knot positions as dots,
 * threads as lines, and a rectangle indicating the current viewport.
 * Click/drag on minimap to pan the camera.
 */

import { useMemo, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import type { Weave, KnotId } from '#weaver/core'

// ─── Constants ───────────────────────────────────────────────────

const MAP_WIDTH = 160
const MAP_HEIGHT = 100
const PADDING = 10

// ─── Props ───────────────────────────────────────────────────────

interface MinimapProps {
  weave: Weave
  camera: { x: number; y: number; zoom: number }
  /** Viewport dimensions in pixels */
  viewWidth: number
  viewHeight: number
  onPan: (worldX: number, worldY: number) => void
}

// ─── Component ───────────────────────────────────────────────────

export function Minimap({ weave, camera, viewWidth, viewHeight, onPan }: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)

  // Calculate bounding box of all knots
  const bounds = useMemo(() => {
    if (weave.knots.size === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [, knot] of weave.knots) {
      minX = Math.min(minX, knot.position.x - 50)
      minY = Math.min(minY, knot.position.y - 50)
      maxX = Math.max(maxX, knot.position.x + 50)
      maxY = Math.max(maxY, knot.position.y + 50)
    }
    // Add some padding
    const padX = (maxX - minX) * 0.15 + 50
    const padY = (maxY - minY) * 0.15 + 50
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
  }, [weave])

  const worldW = bounds.maxX - bounds.minX || 1
  const worldH = bounds.maxY - bounds.minY || 1
  const scaleX = (MAP_WIDTH - PADDING * 2) / worldW
  const scaleY = (MAP_HEIGHT - PADDING * 2) / worldH
  const scale = Math.min(scaleX, scaleY)

  // Transform world coords → minimap coords
  const toMap = useCallback((worldX: number, worldY: number) => ({
    x: PADDING + (worldX - bounds.minX) * scale,
    y: PADDING + (worldY - bounds.minY) * scale,
  }), [bounds, scale])

  // Transform minimap coords → world coords
  const toWorld = useCallback((mapX: number, mapY: number) => ({
    x: bounds.minX + (mapX - PADDING) / scale,
    y: bounds.minY + (mapY - PADDING) / scale,
  }), [bounds, scale])

  // Viewport rectangle in minimap space
  const viewport = useMemo(() => {
    // Camera x,y are the offset applied to the world container
    // So the visible center in world space is (-camera.x / zoom + viewWidth / 2 / zoom, ...)
    const centerWX = -camera.x / camera.zoom + viewWidth / 2 / camera.zoom
    const centerWY = -camera.y / camera.zoom + viewHeight / 2 / camera.zoom
    const halfW = viewWidth / 2 / camera.zoom
    const halfH = viewHeight / 2 / camera.zoom
    const topLeft = toMap(centerWX - halfW, centerWY - halfH)
    const botRight = toMap(centerWX + halfW, centerWY + halfH)
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: Math.max(4, botRight.x - topLeft.x),
      height: Math.max(4, botRight.y - topLeft.y),
    }
  }, [camera, viewWidth, viewHeight, toMap])

  // Click/drag to pan
  const handlePan = useCallback((e: ReactMouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mapX = e.clientX - rect.left
    const mapY = e.clientY - rect.top
    const world = toWorld(mapX, mapY)
    onPan(world.x, world.y)
  }, [toWorld, onPan])

  const handleMouseDown = useCallback((e: ReactMouseEvent<SVGSVGElement>) => {
    draggingRef.current = true
    handlePan(e)
  }, [handlePan])

  const handleMouseMove = useCallback((e: ReactMouseEvent<SVGSVGElement>) => {
    if (draggingRef.current) handlePan(e)
  }, [handlePan])

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  // Render knot dots and thread lines
  const knots: { id: KnotId; x: number; y: number }[] = []
  const threads: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []

  for (const [knotId, knot] of weave.knots) {
    const pos = toMap(knot.position.x, knot.position.y)
    knots.push({ id: knotId, x: pos.x, y: pos.y })
  }

  for (const [, thread] of weave.threads) {
    const source = weave.knots.get(thread.source)
    const target = weave.knots.get(thread.target)
    if (!source || !target) continue
    const from = toMap(source.position.x, source.position.y)
    const to = toMap(target.position.x, target.position.y)
    threads.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, color: '#3a3a6e' })
  }

  if (weave.knots.size === 0) return null

  return (
    <div style={containerStyle}>
      <svg
        ref={svgRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        style={{ cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background */}
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0a0a12" rx={4} />

        {/* Threads */}
        {threads.map((t, i) => (
          <line key={`t-${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.color} strokeWidth={0.5} opacity={0.5} />
        ))}

        {/* Knots */}
        {knots.map(k => (
          <circle key={k.id} cx={k.x} cy={k.y} r={2} fill="#6a6aff" opacity={0.7} />
        ))}

        {/* Viewport indicator */}
        <rect
          x={viewport.x}
          y={viewport.y}
          width={viewport.width}
          height={viewport.height}
          fill="rgba(106, 106, 255, 0.08)"
          stroke="#6a6aff"
          strokeWidth={1}
          rx={1}
          opacity={0.6}
        />
      </svg>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 8,
  right: 8,
  zIndex: 15,
  borderRadius: 6,
  border: '1px solid #1a1a2e',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  opacity: 0.8,
  transition: 'opacity 0.2s',
  pointerEvents: 'auto',
}
