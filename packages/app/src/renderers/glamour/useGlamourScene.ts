/**
 * useGlamourScene — Scene synchronization between Weave data and PixiJS scene graph.
 *
 * Manages knot containers, thread graphics, visual type detection/swap,
 * selection highlights, animation shuttles, and facade position tracking.
 */

import { useEffect, useCallback } from 'react'
import { Container, Graphics, Text, Sprite, Texture, Rectangle, type FederatedPointerEvent } from 'pixi.js'
import type { Weave, KnotId } from '#weaver/core'
import type { GlamourTheme, EnchantContext, GlamourElement, AnimationState } from '#weaver/glamour'
import type { Selection, WeaveAction } from '#weaver/glamour'
import type { KnotSprite, ThreadGraphic } from './types.js'
import { VISUAL_LABELS, SELECTED_TINT } from './types.js'
import { LABEL_STYLE, loadSvgTexture, loadSpriteTexture, renderFallbackVisual, drawThread } from './helpers.js'
import type { ContextMenuState } from './ContextMenu.js'

interface UseGlamourSceneOptions {
  weave: Weave
  theme: GlamourTheme
  enchantContext: EnchantContext
  selection: Selection | null
  animationState: AnimationState | null
  onWeaveAction: (action: WeaveAction) => void
  onSelectionChange: (selection: Selection | null) => void
  worldRef: React.MutableRefObject<Container | null>
  knotSpritesRef: React.MutableRefObject<Map<KnotId, KnotSprite>>
  threadGraphicsRef: React.MutableRefObject<Map<string, ThreadGraphic>>
  shuttleSpritesRef: React.MutableRefObject<Map<string, Sprite>>
  pixiClickedRef: React.MutableRefObject<boolean>
  containerRef: React.RefObject<HTMLDivElement | null>
  appReady: boolean
  unveiledKnots: Set<KnotId>
  setUnveiledKnots: React.Dispatch<React.SetStateAction<Set<KnotId>>>
  fitToView: () => void
  applyCamera: () => void
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>
  setFacadeData: React.Dispatch<React.SetStateAction<Map<KnotId, { element: GlamourElement; worldX: number; worldY: number }>>>
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>
}

export function useGlamourScene({
  weave,
  theme,
  enchantContext,
  selection,
  animationState,
  onWeaveAction,
  onSelectionChange,
  worldRef,
  knotSpritesRef,
  threadGraphicsRef,
  shuttleSpritesRef,
  pixiClickedRef,
  containerRef,
  appReady,
  unveiledKnots,
  setUnveiledKnots,
  fitToView,
  applyCamera,
  cameraRef,
  setFacadeData,
  setContextMenu,
}: UseGlamourSceneOptions) {

  // Update facade overlay positions (world coordinates — CSS transform handles camera)
  const updateFacadePositions = useCallback(() => {
    const newFacadeData = new Map<KnotId, { element: GlamourElement; worldX: number; worldY: number }>()

    for (const [knotId, ks] of knotSpritesRef.current) {
      if (ks.element.facade && ks.element.facade.controls.length > 0 && !unveiledKnots.has(knotId)) {
        newFacadeData.set(knotId, { element: ks.element, worldX: ks.container.x, worldY: ks.container.y })
      }
    }

    setFacadeData(newFacadeData)
  }, [unveiledKnots, knotSpritesRef, setFacadeData])

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
        const prevVisualType = ks.element.visual.type
        ks.element = element

        // Update label text
        const label = ks.container.getChildByLabel('label') as Text | null
        if (label) label.text = element.label

        // If visual type changed (e.g. 'generated' → 'sprite' after hydration),
        // swap out the visual content
        if (element.visual.type !== prevVisualType) {
          // Remove all existing visual children
          for (let i = ks.container.children.length - 1; i >= 0; i--) {
            const child = ks.container.children[i]
            if (VISUAL_LABELS.has(child.label)) {
              ks.container.removeChild(child)
              child.destroy()
            }
          }

          // Render the new visual
          if (element.visual.type === 'sprite') {
            const spriteUrl = element.visual.url
            const capturedSize = element.size
            knotPromises.push(
              loadSpriteTexture(spriteUrl).then(texture => {
                if (texture === Texture.EMPTY) return
                const sprite = new Sprite(texture)
                sprite.label = 'sprite-asset'
                sprite.anchor.set(0.5, 0.5)
                sprite.width = capturedSize.width
                sprite.height = capturedSize.height
                ks.container.addChildAt(sprite, 1)
              })
            )
            if (ks.container.label.endsWith(':pending')) {
              ks.container.label = `knot-${knotId}`
            }
          } else if (element.visual.type === 'svg') {
            const svgPath = element.visual.path
            const capturedSize = element.size
            knotPromises.push(
              loadSvgTexture(svgPath).then(texture => {
                if (texture === Texture.EMPTY) return
                const sprite = new Sprite(texture)
                sprite.label = 'svg-sprite'
                sprite.anchor.set(0.5, 0.5)
                sprite.width = capturedSize.width
                sprite.height = capturedSize.height
                ks.container.addChildAt(sprite, 1)
              })
            )
          } else if (element.visual.type === 'generated') {
            renderFallbackVisual(ks.container, element.visual.fallback, element.size)
            ks.container.label = `knot-${knotId}:pending`
          }
        }
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
          element.size.height + 20,
        )

        // Click handler for selection + unveil
        knotContainer.on('pointerdown', (e: FederatedPointerEvent) => {
          pixiClickedRef.current = true
          if (e.altKey) {
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

        // Hover shimmer — subtle glow hinting at unveilability
        knotContainer.on('pointerover', () => {
          const shimmer = knotContainer.getChildByLabel('shimmer') as Graphics | null
          if (shimmer) shimmer.alpha = 0.35
        })
        knotContainer.on('pointerout', () => {
          const shimmer = knotContainer.getChildByLabel('shimmer') as Graphics | null
          if (shimmer) shimmer.alpha = 0
        })

        // Right-click context menu
        knotContainer.on('rightclick', (e: FederatedPointerEvent) => {
          pixiClickedRef.current = true
          setContextMenu({
            knotId,
            x: e.clientX ?? e.globalX,
            y: e.clientY ?? e.globalY,
            isUnveiled: unveiledKnots.has(knotId),
            depth: element.depth,
          })
          e.stopPropagation()
        })

        // Background shape
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
          bg.roundRect(-element.size.width / 2, -element.size.height / 2, element.size.width, element.size.height, 8)
          bg.fill({ color: 0x1a1a2e, alpha: 0.4 })
          bg.stroke({ color: 0x2a2a4e, width: 1 })
        }
        knotContainer.addChild(bg)

        // Shimmer overlay — visible on hover, hints at unveil capability
        const shimmer = new Graphics()
        shimmer.label = 'shimmer'
        shimmer.roundRect(
          -element.size.width / 2 - 2,
          -element.size.height / 2 - 2,
          element.size.width + 4,
          element.size.height + 4,
          8,
        )
        shimmer.stroke({ color: 0x6a6aff, width: 1.5, alpha: 0.6 })
        shimmer.alpha = 0  // Hidden until hover
        knotContainer.addChild(shimmer)

        // Depth badge — small indicator for knots with depth > 1
        if (element.depth > 1) {
          const badge = new Text({
            text: `⌂${element.depth}`,
            style: {
              fontSize: 8,
              fontFamily: 'monospace',
              fill: 0x6a6a9a,
            },
          })
          badge.label = 'depth-badge'
          badge.anchor.set(1, 0)
          badge.x = element.size.width / 2 - 2
          badge.y = -element.size.height / 2 + 2
          knotContainer.addChild(badge)
        }

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

        // Async: load visual asset based on visual type
        if (element.visual.type === 'svg') {
          const svgPath = element.visual.path
          const capturedSize = element.size
          knotPromises.push(
            loadSvgTexture(svgPath).then(texture => {
              if (texture === Texture.EMPTY) return
              const sprite = new Sprite(texture)
              sprite.label = 'svg-sprite'
              sprite.anchor.set(0.5, 0.5)
              sprite.width = capturedSize.width
              sprite.height = capturedSize.height
              knotContainer.addChildAt(sprite, 1)
            })
          )
        } else if (element.visual.type === 'sprite') {
          const spriteUrl = element.visual.url
          const capturedSize = element.size
          knotPromises.push(
            loadSpriteTexture(spriteUrl).then(texture => {
              if (texture === Texture.EMPTY) return
              const sprite = new Sprite(texture)
              sprite.label = 'sprite-asset'
              sprite.anchor.set(0.5, 0.5)
              sprite.width = capturedSize.width
              sprite.height = capturedSize.height
              knotContainer.addChildAt(sprite, 1)
            })
          )
        } else if (element.visual.type === 'generated') {
          renderFallbackVisual(knotContainer, element.visual.fallback, element.size)
          knotContainer.label = `knot-${knotId}:pending`
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
        const tg = existingThreads.get(threadId)!
        drawThread(tg.graphic, sourceKnot.position, targetKnot.position, connection)
        tg.connection = connection
        tg.sourcePos = sourceKnot.position
        tg.targetPos = targetKnot.position
      } else {
        const graphic = new Graphics()
        graphic.label = `thread-${threadId}`
        drawThread(graphic, sourceKnot.position, targetKnot.position, connection)
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

    // Load async textures
    Promise.all(knotPromises).catch(() => { /* ignore load failures */ })

    // Auto-fit on first render
    if (weave.knots.size > 0 && cameraRef.current.x === 0 && cameraRef.current.y === 0) {
      fitToView()
    }

    // Update facade overlay positions + sync CSS transform
    updateFacadePositions()
    applyCamera()
  }, [weave, enchantContext, theme, onSelectionChange, appReady, updateFacadePositions, applyCamera,
      worldRef, knotSpritesRef, threadGraphicsRef, pixiClickedRef, setUnveiledKnots, setContextMenu, fitToView, cameraRef])

  // ─── Selection Highlight ─────────────────────────────────────
  useEffect(() => {
    for (const [knotId, ks] of knotSpritesRef.current) {
      const isSelected = selection?.type === 'knot' && selection.id === knotId
      ks.container.alpha = isSelected ? 1 : 0.85
      for (const child of ks.container.children) {
        if (child instanceof Sprite) {
          child.tint = isSelected ? SELECTED_TINT : 0xffffff
        }
      }
    }
  }, [selection, knotSpritesRef])

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

        loadSvgTexture('/glamour/loom/shuttle.svg').then(tex => {
          if (shuttle && !shuttle.destroyed) {
            shuttle.texture = tex
          }
        })
      }

      const t = highlight.progress
      shuttle.x = tg.sourcePos.x + (tg.targetPos.x - tg.sourcePos.x) * t
      shuttle.y = tg.sourcePos.y + (tg.targetPos.y - tg.sourcePos.y) * t

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
  }, [animationState, selection, worldRef, knotSpritesRef, threadGraphicsRef, shuttleSpritesRef])

  // ─── Click on background to clear selection ──────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      if (pixiClickedRef.current) {
        pixiClickedRef.current = false
        return
      }
      const target = e.target as HTMLElement
      if (target === el || target.tagName === 'CANVAS') {
        if (!e.altKey) {
          onSelectionChange(null)
        }
      }
    }

    // Suppress native context menu on canvas so our custom one shows
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target === el || target.tagName === 'CANVAS') {
        e.preventDefault()
      }
    }

    el.addEventListener('click', handleClick)
    el.addEventListener('contextmenu', handleContextMenu)
    return () => {
      el.removeEventListener('click', handleClick)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [onSelectionChange, containerRef, pixiClickedRef])

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
}
