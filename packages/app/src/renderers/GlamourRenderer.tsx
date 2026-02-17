/**
 * GlamourRenderer — PixiJS-powered glamour view.
 *
 * Implements WeaveRendererProps using PixiJS v8 imperatively.
 * The Loom theme transforms knots into weaving elements:
 *   spindles, dye vats, heddle frames, winding frames, cloth beams.
 * Threads are literal colored threads. Waves are shuttles.
 *
 * Architecture:
 *   - PixiJS Application created imperatively in useEffect
 *   - Scene graph managed via refs (no @pixi/react declarative layer)
 *   - Camera: pan (drag) + zoom (wheel) on the stage container
 *   - Selection: click on knot sprite → onSelectionChange
 *   - Highlights: animationState → tint/glow on active knots/threads
 *   - Partial unveil: Alt+click toggles unveiled state per knot
 *   - Facade controls: HTML overlays positioned via world→screen transform
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Application, Container, Graphics, Text, TextStyle, Assets, Sprite, Texture, Rectangle, type FederatedPointerEvent } from 'pixi.js'
import type { WeaveRendererProps, GlamourElement, GlamourConnection } from '#weaver/glamour'
import type { KnotId } from '#weaver/core'
import { LoomTheme } from '#weaver/glamour'
import type { EnchantContext } from '#weaver/glamour'

// ─── Types ──────────────────────────────────────────────────────

interface KnotSprite {
  container: Container
  knotId: KnotId
  element: GlamourElement
}

interface ThreadGraphic {
  threadId: string
  graphic: Graphics
  connection: GlamourConnection
  sourcePos: { x: number; y: number }
  targetPos: { x: number; y: number }
}

interface Camera {
  x: number
  y: number
  zoom: number
}

// ─── Constants ──────────────────────────────────────────────────

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const ZOOM_SPEED = 0.001
const LABEL_STYLE = new TextStyle({
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 11,
  fill: '#c0c0d0',
  align: 'center',
})
const SELECTED_TINT = 0x6a6aff
const HIGHLIGHT_TINT = 0x4af0ff

// ─── SVG Texture Cache ──────────────────────────────────────────

const textureCache = new Map<string, Texture>()

async function loadSvgTexture(path: string): Promise<Texture> {
  if (textureCache.has(path)) return textureCache.get(path)!
  try {
    const texture = await Assets.load(path)
    textureCache.set(path, texture)
    return texture
  } catch {
    // Return empty texture on failure
    return Texture.EMPTY
  }
}

// ─── Component ──────────────────────────────────────────────────

export function GlamourRenderer({
  weave,
  selection,
  animationState,
  onWeaveAction,
  onSelectionChange,
}: WeaveRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const knotSpritesRef = useRef<Map<KnotId, KnotSprite>>(new Map())
  const threadGraphicsRef = useRef<Map<string, ThreadGraphic>>(new Map())
  const shuttleSpritesRef = useRef<Map<string, Sprite>>(new Map())
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const draggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const pixiClickedRef = useRef(false)

  const [appReady, setAppReady] = useState(false)
  const [unveiledKnots, setUnveiledKnots] = useState<Set<KnotId>>(new Set())
  const [facadeData, setFacadeData] = useState<Map<KnotId, { element: GlamourElement; worldX: number; worldY: number }>>(new Map())
  const facadeContainerRef = useRef<HTMLDivElement>(null)

  // Theme instance
  const theme = LoomTheme

  // Build enchant context
  const enchantContext: EnchantContext = useMemo(() => ({
    weave,
    theme,
    zoom: cameraRef.current.zoom,
    unveiledKnots,
  }), [weave, theme, unveiledKnots])

  // ─── Initialize PixiJS Application ───────────────────────────

  useEffect(() => {
    if (!containerRef.current) return

    const app = new Application()
    const container = containerRef.current

    let mounted = true

    ;(async () => {
      await app.init({
        background: 0x0a0a0a,
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      if (!mounted) {
        app.destroy(true)
        return
      }

      container.appendChild(app.canvas as HTMLCanvasElement)

      // World container for pan/zoom
      const world = new Container()
      world.label = 'world'
      app.stage.addChild(world)

      appRef.current = app
      worldRef.current = world

      // Make the stage interactive for pan/zoom
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      // Signal that the app is ready so scene sync runs
      setAppReady(true)
    })()

    return () => {
      mounted = false
      if (appRef.current) {
        // Remove canvas from DOM
        const canvas = appRef.current.canvas as HTMLCanvasElement
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas)
        }
        appRef.current.destroy(true)
        appRef.current = null
        worldRef.current = null
      }
      knotSpritesRef.current.clear()
      threadGraphicsRef.current.clear()
      shuttleSpritesRef.current.clear()
    }
  }, [])

  // ─── Pan/Zoom via mouse events on the container div ──────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const camera = cameraRef.current
      const zoomDelta = -e.deltaY * ZOOM_SPEED
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * (1 + zoomDelta)))

      // Zoom toward mouse position
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const scale = newZoom / camera.zoom
      camera.x = mx - scale * (mx - camera.x)
      camera.y = my - scale * (my - camera.y)
      camera.zoom = newZoom

      applyCamera()
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button or left + alt for panning
      if (e.button === 1 || (e.button === 0 && e.altKey && !e.shiftKey)) {
        draggingRef.current = true
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        e.preventDefault()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      cameraRef.current.x += dx
      cameraRef.current.y += dy
      applyCamera()
    }

    const handleMouseUp = () => {
      draggingRef.current = false
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // ─── Apply camera transform to world container ───────────────

  const applyCamera = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const camera = cameraRef.current
    world.x = camera.x
    world.y = camera.y
    world.scale.set(camera.zoom)
    // Keep HTML facade overlay in sync with PixiJS world via CSS transform
    if (facadeContainerRef.current) {
      facadeContainerRef.current.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
    }
  }, [])

  /** Fit camera so all knots are visible */
  const fitToView = useCallback(() => {
    if (weave.knots.size === 0) return
    const el = containerRef.current
    if (!el) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const knot of weave.knots.values()) {
      minX = Math.min(minX, knot.position.x - 80)
      minY = Math.min(minY, knot.position.y - 80)
      maxX = Math.max(maxX, knot.position.x + 80)
      maxY = Math.max(maxY, knot.position.y + 80)
    }

    const graphW = maxX - minX
    const graphH = maxY - minY
    const viewW = el.clientWidth
    const viewH = el.clientHeight

    const zoom = Math.min(viewW / graphW, viewH / graphH, 1.5) * 0.85
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    cameraRef.current = {
      x: viewW / 2 - cx * zoom,
      y: viewH / 2 - cy * zoom,
      zoom,
    }
    applyCamera()
  }, [weave, applyCamera])

  /** Update facade overlay positions (world coordinates — CSS transform handles camera) */
  const updateFacadePositions = useCallback(() => {
    const newFacadeData = new Map<KnotId, { element: GlamourElement; worldX: number; worldY: number }>()

    for (const [knotId, ks] of knotSpritesRef.current) {
      if (ks.element.facade && ks.element.facade.controls.length > 0 && !unveiledKnots.has(knotId)) {
        newFacadeData.set(knotId, { element: ks.element, worldX: ks.container.x, worldY: ks.container.y })
      }
    }

    setFacadeData(newFacadeData)
  }, [unveiledKnots])

  // ─── Sync Weave → PixiJS Scene ──────────────────────────────

  useEffect(() => {
    const world = worldRef.current
    if (!world) return

    const existingKnots = knotSpritesRef.current
    const existingThreads = threadGraphicsRef.current
    const currentKnotIds = new Set<KnotId>()
    const currentThreadIds = new Set<string>()

    // Process knots
    const knotPromises: Promise<void>[] = []

    for (const [knotId, knot] of weave.knots) {
      currentKnotIds.add(knotId)
      const element = theme.enchantKnot(knot, enchantContext)

      if (existingKnots.has(knotId)) {
        // Update existing knot sprite
        const ks = existingKnots.get(knotId)!
        ks.container.x = element.position.x
        ks.container.y = element.position.y
        ks.element = element
        // Update label text
        const label = ks.container.getChildByLabel('label') as Text | null
        if (label) label.text = element.label
      } else {
        // Create new knot sprite
        const knotContainer = new Container()
        knotContainer.label = `knot-${knotId}`
        knotContainer.x = element.position.x
        knotContainer.y = element.position.y
        knotContainer.eventMode = 'static'
        knotContainer.cursor = 'pointer'
        knotContainer.hitArea = new Rectangle(
          -element.size.width / 2,
          -element.size.height / 2,
          element.size.width,
          element.size.height + 20, // Extra space for label
        )

        // Click handler for selection
        knotContainer.on('pointerdown', (e: FederatedPointerEvent) => {
          pixiClickedRef.current = true
          if (e.altKey) {
            // Alt+click: toggle unveil
            setUnveiledKnots(prev => {
              const next = new Set(prev)
              if (next.has(knotId)) {
                next.delete(knotId)
              } else {
                next.add(knotId)
              }
              return next
            })
          } else {
            onSelectionChange({ type: 'knot', id: knotId })
          }
          e.stopPropagation()
        })

        // Background shape (colored rect as fallback, SVG sprite loads async)
        const bg = new Graphics()
        bg.label = 'background'

        if (element.visual.type === 'color') {
          const fill = parseInt(element.visual.fill.replace('#', ''), 16)
          bg.roundRect(-element.size.width / 2, -element.size.height / 2, element.size.width, element.size.height, 6)
          bg.fill({ color: fill, alpha: 0.6 })
          if (element.visual.stroke) {
            const stroke = parseInt(element.visual.stroke.replace('#', ''), 16)
            bg.roundRect(-element.size.width / 2, -element.size.height / 2, element.size.width, element.size.height, 6)
            bg.stroke({ color: stroke, width: 1.5 })
          }
        } else {
          // Default: dark rect placeholder while SVG loads
          bg.roundRect(-element.size.width / 2, -element.size.height / 2, element.size.width, element.size.height, 8)
          bg.fill({ color: 0x1a1a2e, alpha: 0.4 })
          bg.stroke({ color: 0x2a2a4e, width: 1 })
        }
        knotContainer.addChild(bg)

        // Label text
        const labelText = new Text({
          text: element.label,
          style: LABEL_STYLE,
        })
        labelText.label = 'label'
        labelText.anchor.set(0.5, 0)
        labelText.y = element.size.height / 2 + 4
        knotContainer.addChild(labelText)

        world.addChild(knotContainer)
        existingKnots.set(knotId, { container: knotContainer, knotId, element })

        // Async: load SVG texture and create sprite
        if (element.visual.type === 'svg') {
          const svgPath = element.visual.path
          const capturedSize = element.size
          knotPromises.push(
            loadSvgTexture(svgPath).then(texture => {
              if (texture === Texture.EMPTY) return
              const sprite = new Sprite(texture)
              sprite.label = 'svg-sprite'
              sprite.anchor.set(0.5, 0.5)
              // Scale sprite to fit the element size
              sprite.width = capturedSize.width
              sprite.height = capturedSize.height
              // Insert behind label but in front of background
              knotContainer.addChildAt(sprite, 1)
            })
          )
        }
      }
    }

    // Remove knots that no longer exist
    for (const [knotId, ks] of existingKnots) {
      if (!currentKnotIds.has(knotId)) {
        world.removeChild(ks.container)
        ks.container.destroy({ children: true })
        existingKnots.delete(knotId)
      }
    }

    // Process threads
    for (const [threadId, thread] of weave.threads) {
      currentThreadIds.add(threadId)
      const sourceKnot = weave.knots.get(thread.source)
      const targetKnot = weave.knots.get(thread.target)
      if (!sourceKnot || !targetKnot) continue

      const connection = theme.enchantThread(thread, sourceKnot, targetKnot, enchantContext)

      if (existingThreads.has(threadId)) {
        // Redraw existing thread
        const tg = existingThreads.get(threadId)!
        drawThread(tg.graphic, sourceKnot.position, targetKnot.position, connection)
        tg.connection = connection
        tg.sourcePos = sourceKnot.position
        tg.targetPos = targetKnot.position
      } else {
        // Create new thread graphic
        const graphic = new Graphics()
        graphic.label = `thread-${threadId}`
        drawThread(graphic, sourceKnot.position, targetKnot.position, connection)
        // Add threads behind knots
        world.addChildAt(graphic, 0)
        existingThreads.set(threadId, {
          threadId,
          graphic,
          connection,
          sourcePos: sourceKnot.position,
          targetPos: targetKnot.position,
        })
      }
    }

    // Remove threads that no longer exist
    for (const [threadId, tg] of existingThreads) {
      if (!currentThreadIds.has(threadId)) {
        world.removeChild(tg.graphic)
        tg.graphic.destroy()
        existingThreads.delete(threadId)
      }
    }

    // Load SVG textures
    Promise.all(knotPromises).catch(() => { /* ignore load failures */ })

    // Auto-fit on first render
    if (weave.knots.size > 0 && cameraRef.current.x === 0 && cameraRef.current.y === 0) {
      fitToView()
    }

    // Update facade overlay positions + sync CSS transform
    updateFacadePositions()
    applyCamera()
  }, [weave, enchantContext, theme, onSelectionChange, appReady, updateFacadePositions, applyCamera])

  // ─── Selection Highlight ─────────────────────────────────────

  useEffect(() => {
    for (const [knotId, ks] of knotSpritesRef.current) {
      const isSelected = selection?.type === 'knot' && selection.id === knotId
      ks.container.alpha = isSelected ? 1 : 0.85
      // Apply tint to sprite children
      for (const child of ks.container.children) {
        if (child instanceof Sprite) {
          child.tint = isSelected ? SELECTED_TINT : 0xffffff
        }
      }
    }
  }, [selection])

  // ─── Animation Highlights ────────────────────────────────────

  useEffect(() => {
    const world = worldRef.current
    if (!world) return

    // Reset all knot tints
    for (const [, ks] of knotSpritesRef.current) {
      const isSelected = selection?.type === 'knot' && selection.id === ks.knotId
      for (const child of ks.container.children) {
        if (child instanceof Sprite) {
          child.tint = isSelected ? SELECTED_TINT : 0xffffff
        }
      }
    }

    if (!animationState) {
      // Clear shuttle sprites
      for (const [, shuttle] of shuttleSpritesRef.current) {
        world.removeChild(shuttle)
        shuttle.destroy()
      }
      shuttleSpritesRef.current.clear()
      return
    }

    // Highlight active knots
    for (const [knotId, highlight] of animationState.activeKnots) {
      const ks = knotSpritesRef.current.get(knotId)
      if (!ks) continue
      const color = parseInt(highlight.color.replace('#', ''), 16)
      for (const child of ks.container.children) {
        if (child instanceof Sprite) {
          child.tint = color
        }
      }
      ks.container.alpha = highlight.pulse ? 0.7 + 0.3 * Math.sin(Date.now() * 0.01) : 1
    }

    // Shuttle sprites along active threads
    const activeShuttleIds = new Set<string>()
    for (const [threadId, highlight] of animationState.activeThreads) {
      activeShuttleIds.add(threadId)
      const tg = threadGraphicsRef.current.get(threadId)
      if (!tg) continue

      let shuttle = shuttleSpritesRef.current.get(threadId)
      if (!shuttle) {
        shuttle = new Sprite(Texture.EMPTY)
        shuttle.label = `shuttle-${threadId}`
        shuttle.anchor.set(0.5, 0.5)
        shuttle.scale.set(0.4)
        world.addChild(shuttle)
        shuttleSpritesRef.current.set(threadId, shuttle)

        // Load shuttle texture async
        loadSvgTexture('/glamour/loom/shuttle.svg').then(tex => {
          if (shuttle && !shuttle.destroyed) {
            shuttle.texture = tex
          }
        })
      }

      // Position shuttle along thread path
      const t = highlight.progress
      shuttle.x = tg.sourcePos.x + (tg.targetPos.x - tg.sourcePos.x) * t
      shuttle.y = tg.sourcePos.y + (tg.targetPos.y - tg.sourcePos.y) * t

      // Rotate shuttle to face direction of travel
      const angle = Math.atan2(
        tg.targetPos.y - tg.sourcePos.y,
        tg.targetPos.x - tg.sourcePos.x,
      )
      shuttle.rotation = angle
    }

    // Remove shuttles for threads that are no longer active
    for (const [threadId, shuttle] of shuttleSpritesRef.current) {
      if (!activeShuttleIds.has(threadId)) {
        world.removeChild(shuttle)
        shuttle.destroy()
        shuttleSpritesRef.current.delete(threadId)
      }
    }
  }, [animationState, selection])

  // ─── Click on background to clear selection ──────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      // PixiJS pointerdown fires before DOM click — if a knot was just
      // clicked, skip clearing selection (the PixiJS handler already set it)
      if (pixiClickedRef.current) {
        pixiClickedRef.current = false
        return
      }
      // If clicked directly on the container background (not on a knot)
      const target = e.target as HTMLElement
      if (target === el || target.tagName === 'CANVAS') {
        if (!e.altKey) {
          onSelectionChange(null)
        }
      }
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [onSelectionChange])

  // ─── Keyboard shortcuts ──────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection?.type === 'knot') {
          onWeaveAction({ type: 'cut', knotId: selection.id })
          onSelectionChange(null)
        } else if (selection?.type === 'thread') {
          onWeaveAction({ type: 'snip', threadId: selection.id })
          onSelectionChange(null)
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); onWeaveAction({ type: 'undo' }) }
        if (e.key === 'y') { e.preventDefault(); onWeaveAction({ type: 'redo' }) }
      }

      if (e.key === 'Escape') {
        onSelectionChange(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection, onWeaveAction, onSelectionChange])

  // ─── Facade Controls (HTML overlay) ──────────────────────────

  const facadeOverlays = useMemo(() => {
    const overlays: JSX.Element[] = []

    for (const [knotId, { element, worldX, worldY }] of facadeData) {
      if (!element.facade) continue

      for (const control of element.facade.controls) {
        // Position in world space (CSS transform on parent handles camera)
        const cx = worldX + (control.position.x - 0.5) * element.size.width
        const cy = worldY + (control.position.y - 0.5) * element.size.height

        if (control.controlType === 'slider') {
          const currentVal = getNestedValue(weave.knots.get(knotId)?.data, control.binding.dataPath) as number ?? control.binding.min ?? 0
          overlays.push(
            <div
              key={`${knotId}-${control.id}`}
              style={{
                position: 'absolute',
                left: cx - 40,
                top: cy - 8,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 9, color: '#6a6a9a' }}>{control.label}</span>
              <input
                type="range"
                min={control.binding.min ?? 0}
                max={control.binding.max ?? 100}
                step={control.binding.step ?? 1}
                value={currentVal}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  onWeaveAction({
                    type: 'updateKnot',
                    knotId: control.binding.knotId,
                    changes: { data: setNestedValue(weave.knots.get(knotId)?.data ?? {}, control.binding.dataPath, value) },
                  })
                }}
                style={{ width: 80, accentColor: '#6a6aff' }}
              />
              <span style={{ fontSize: 8, color: '#4a4a6a' }}>{currentVal}</span>
            </div>
          )
        } else if (control.controlType === 'text') {
          const currentVal = getNestedValue(weave.knots.get(knotId)?.data, control.binding.dataPath) as string ?? ''
          overlays.push(
            <div
              key={`${knotId}-${control.id}`}
              style={{
                position: 'absolute',
                left: cx - 60,
                top: cy - 10,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 9, color: '#6a6a9a' }}>{control.label}</span>
              <input
                type="text"
                value={currentVal}
                onChange={(e) => {
                  onWeaveAction({
                    type: 'updateKnot',
                    knotId: control.binding.knotId,
                    changes: { data: setNestedValue(weave.knots.get(knotId)?.data ?? {}, control.binding.dataPath, e.target.value) },
                  })
                }}
                style={{
                  width: 120,
                  background: '#111118',
                  border: '1px solid #2a2a4e',
                  borderRadius: 3,
                  color: '#c0c0d0',
                  fontSize: 10,
                  padding: '2px 6px',
                }}
              />
            </div>
          )
        }
      }
    }

    return overlays
  }, [facadeData, weave, onWeaveAction])

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      {/* Status bar */}
      <div style={statusBarStyle}>
        <span style={{ fontSize: 10, color: '#4a4a6a' }}>
          {theme.name}
        </span>
        <span style={{ fontSize: 9, color: '#3a3a5a' }}>
          {weave.knots.size} elements  {weave.threads.size} threads
        </span>
        <span style={{ fontSize: 9, color: '#3a3a5a', marginLeft: 'auto' }}>
          Scroll to zoom  Middle-click to pan  Alt+click to unveil
        </span>
      </div>

      {/* Facade HTML overlays — CSS transform mirrors PixiJS world container */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
        <div ref={facadeContainerRef} style={{ transformOrigin: '0 0', pointerEvents: 'none' }}>
          {facadeOverlays}
        </div>
      </div>
    </div>
  )
}

// ─── Drawing Helpers ────────────────────────────────────────────

function drawThread(
  graphic: Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  connection: GlamourConnection,
) {
  graphic.clear()
  const color = parseInt(connection.visual.color.replace('#', ''), 16)

  if (connection.visual.style === 'dashed') {
    // Draw dashed line
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const dashLen = 8
    const gapLen = 5
    const steps = Math.floor(len / (dashLen + gapLen))
    for (let i = 0; i < steps; i++) {
      const t0 = (i * (dashLen + gapLen)) / len
      const t1 = Math.min((i * (dashLen + gapLen) + dashLen) / len, 1)
      graphic.moveTo(from.x + dx * t0, from.y + dy * t0)
      graphic.lineTo(from.x + dx * t1, from.y + dy * t1)
    }
    graphic.stroke({ color, width: connection.visual.width, alpha: 0.7 })
  } else if (connection.visual.style === 'animated') {
    // Shimmering: draw with slightly different alpha based on time
    const alpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.003)
    graphic.moveTo(from.x, from.y)
    graphic.lineTo(to.x, to.y)
    graphic.stroke({ color, width: connection.visual.width, alpha })
  } else {
    // Solid line
    graphic.moveTo(from.x, from.y)
    graphic.lineTo(to.x, to.y)
    graphic.stroke({ color, width: connection.visual.width, alpha: 0.7 })
  }

  // Arrow head at target
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const arrowLen = 8
  graphic.moveTo(to.x, to.y)
  graphic.lineTo(
    to.x - arrowLen * Math.cos(angle - 0.3),
    to.y - arrowLen * Math.sin(angle - 0.3),
  )
  graphic.moveTo(to.x, to.y)
  graphic.lineTo(
    to.x - arrowLen * Math.cos(angle + 0.3),
    to.y - arrowLen * Math.sin(angle + 0.3),
  )
  graphic.stroke({ color, width: connection.visual.width * 0.7, alpha: 0.6 })
}

// ─── Utility: Nested Value Access ───────────────────────────────

function getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = { ...obj }
  const parts = path.split('.')
  let current: Record<string, unknown> = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {}
    } else {
      current[part] = { ...(current[part] as Record<string, unknown>) }
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
  return result
}

// ─── Styles ─────────────────────────────────────────────────────

const statusBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 24,
  background: 'rgba(10, 10, 10, 0.85)',
  borderBottom: '1px solid #1a1a2e',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 12,
  zIndex: 20,
}
