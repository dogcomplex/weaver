/**
 * GlamourRenderer — PixiJS-powered glamour view.
 *
 * Thin shell composing focused hooks:
 *   usePixiApp     — PixiJS Application lifecycle + ref management
 *   useGlamourCamera — Pan, zoom, fit-to-view
 *   useGlamourAssets — Asset hydration + WebSocket hot-swap
 *   useGlamourScene  — Scene sync: Weave → PixiJS, selection, animation, keyboard
 *
 * UI layers:
 *   FacadeOverlay    — HTML controls mirroring PixiJS camera via CSS transform
 *   GlamourStatusBar — Theme name, counts, keyboard hints
 *   ContextMenu      — Right-click actions on knots
 */

import { useState, useMemo, useCallback } from 'react'
import type { WeaveRendererProps, GlamourElement } from '#weaver/glamour'
import type { KnotId } from '#weaver/core'
import { LoomTheme, ManifestTheme, buildKnotIdMap } from '#weaver/glamour'
import type { EnchantContext, MetaphorManifest } from '#weaver/glamour'
import type { WebSocketListener } from '../../hooks/useWeaveWebSocket.js'

import { usePixiApp } from './usePixiApp.js'
import { useGlamourCamera } from './useGlamourCamera.js'
import { useGlamourAssets } from './useGlamourAssets.js'
import { useGlamourScene } from './useGlamourScene.js'
import { useIdleAnimations } from './useIdleAnimations.js'
import { useAmbientEffects } from './useAmbientEffects.js'
import { FacadeOverlay } from './FacadeOverlay.js'
import { GlamourStatusBar } from './GlamourStatusBar.js'
import { ContextMenu, type ContextMenuState } from './ContextMenu.js'
import { Minimap } from './Minimap.js'

// ─── Props ───────────────────────────────────────────────────────

interface GlamourRendererExtraProps extends WeaveRendererProps {
  activeManifest?: MetaphorManifest | null
  wsSubscribe?: (listener: WebSocketListener) => () => void
}

// ─── Component ───────────────────────────────────────────────────

export function GlamourRenderer({
  weave,
  selection,
  animationState,
  onWeaveAction,
  onSelectionChange,
  activeManifest,
  wsSubscribe,
}: GlamourRendererExtraProps) {
  // ─── Local state ────────────────────────────────────────────
  const [unveiledKnots, setUnveiledKnots] = useState<Set<KnotId>>(new Set())
  const [facadeData, setFacadeData] = useState<Map<KnotId, { element: GlamourElement; worldX: number; worldY: number }>>(new Map())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [hoveredKnotIds, setHoveredKnotIds] = useState<Set<KnotId>>(new Set())

  // ─── PixiJS application lifecycle + refs ────────────────────
  const pixi = usePixiApp()

  // ─── Asset hydration + WebSocket hot-swap ───────────────────
  const { assetResolver } = useGlamourAssets({
    activeManifest: activeManifest ?? null,
    knotSpritesRef: pixi.knotSpritesRef,
    sceneBgContainerRef: pixi.sceneBgContainerRef,
    appRef: pixi.appRef,
    wsSubscribe,
  })

  // ─── Theme instance ─────────────────────────────────────────
  const theme = useMemo(() => {
    if (activeManifest) {
      const knotIdMap = buildKnotIdMap(weave)
      return new ManifestTheme(activeManifest, knotIdMap, assetResolver ?? undefined)
    }
    return LoomTheme
  }, [activeManifest, weave, assetResolver])

  // ─── Enchant context ────────────────────────────────────────
  const enchantContext: EnchantContext = useMemo(() => ({
    weave,
    theme,
    zoom: pixi.cameraRef.current.zoom,
    unveiledKnots,
  }), [weave, theme, unveiledKnots])

  // ─── Camera controls ────────────────────────────────────────
  const { fitToView } = useGlamourCamera({
    containerRef: pixi.containerRef,
    cameraRef: pixi.cameraRef,
    draggingRef: pixi.draggingRef,
    lastMouseRef: pixi.lastMouseRef,
    applyCamera: pixi.applyCamera,
    weave,
  })

  // ─── Minimap pan handler ────────────────────────────────────
  const handleMinimapPan = useCallback((worldX: number, worldY: number) => {
    const el = pixi.containerRef.current
    if (!el) return
    const cam = pixi.cameraRef.current
    // Center the viewport on the clicked world position
    cam.x = -worldX * cam.zoom + el.clientWidth / 2
    cam.y = -worldY * cam.zoom + el.clientHeight / 2
    pixi.applyCamera()
  }, [pixi])

  // ─── Context menu actions ──────────────────────────────────
  const handleContextMenuUnveil = useCallback((knotId: KnotId) => {
    setUnveiledKnots(prev => {
      const next = new Set(prev)
      if (next.has(knotId)) {
        next.delete(knotId)
      } else {
        next.add(knotId)
      }
      return next
    })
  }, [])

  const handleContextMenuSelect = useCallback((knotId: KnotId) => {
    onSelectionChange({ type: 'knot', id: knotId })
  }, [onSelectionChange])

  const handleHoverChange = useCallback((knotId: KnotId, hovered: boolean) => {
    setHoveredKnotIds(prev => {
      const next = new Set(prev)
      if (hovered) {
        next.add(knotId)
      } else {
        next.delete(knotId)
      }
      return next
    })
  }, [])

  const handleContextMenuDelete = useCallback((knotId: KnotId) => {
    onWeaveAction({ type: 'cut', knotId })
    onSelectionChange(null)
  }, [onWeaveAction, onSelectionChange])

  // ─── Idle animations from animationHints ────────────────────
  useIdleAnimations({
    knotSpritesRef: pixi.knotSpritesRef,
    addTickerCallback: pixi.addTickerCallback,
    removeTickerCallback: pixi.removeTickerCallback,
  })

  // ─── Ambient scene effects from ambientDescription ─────────
  useAmbientEffects({
    sceneBgContainerRef: pixi.sceneBgContainerRef,
    appRef: pixi.appRef,
    addTickerCallback: pixi.addTickerCallback,
    removeTickerCallback: pixi.removeTickerCallback,
    ambientDescription: theme.sceneConfig.ambientDescription,
  })

  // ─── Scene synchronization ──────────────────────────────────
  useGlamourScene({
    weave,
    theme,
    assetResolver,
    enchantContext,
    selection,
    animationState,
    onWeaveAction,
    onSelectionChange,
    worldRef: pixi.worldRef,
    knotSpritesRef: pixi.knotSpritesRef,
    threadGraphicsRef: pixi.threadGraphicsRef,
    shuttleSpritesRef: pixi.shuttleSpritesRef,
    pixiClickedRef: pixi.pixiClickedRef,
    containerRef: pixi.containerRef,
    appReady: pixi.appReady,
    unveiledKnots,
    setUnveiledKnots,
    fitToView,
    applyCamera: pixi.applyCamera,
    cameraRef: pixi.cameraRef,
    setFacadeData,
    setContextMenu,
    onHoverChange: handleHoverChange,
  })

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div
      ref={pixi.containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      {/* Status bar */}
      <GlamourStatusBar theme={theme} weave={weave} activeManifest={activeManifest ?? null} />

      {/* Facade HTML overlays — CSS transform mirrors PixiJS world container */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
        <div ref={pixi.facadeContainerRef} style={{ transformOrigin: '0 0', pointerEvents: 'none' }}>
          <FacadeOverlay facadeData={facadeData} weave={weave} onWeaveAction={onWeaveAction} hoveredKnotIds={hoveredKnotIds} />
        </div>
      </div>

      {/* Minimap — bottom-right corner overview */}
      <Minimap
        weave={weave}
        camera={pixi.cameraRef.current}
        viewWidth={pixi.containerRef.current?.clientWidth ?? 800}
        viewHeight={pixi.containerRef.current?.clientHeight ?? 600}
        onPan={handleMinimapPan}
      />

      {/* Right-click context menu */}
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onUnveil={handleContextMenuUnveil}
        onSelect={handleContextMenuSelect}
        onDelete={handleContextMenuDelete}
      />
    </div>
  )
}
