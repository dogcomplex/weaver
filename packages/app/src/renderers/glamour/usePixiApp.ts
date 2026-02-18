/**
 * usePixiApp — PixiJS Application lifecycle hook.
 *
 * Creates and destroys the PixiJS Application, manages the world container,
 * and provides refs for other hooks to use.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { Application, Container, Sprite } from 'pixi.js'
import type { KnotId } from '#weaver/core'
import type { KnotSprite, ThreadGraphic, Camera } from './types.js'

/** Parallax factor for scene background (0 = static, 1 = same as world) */
const SCENE_BG_PARALLAX = 0.3

/** Callback for per-frame animation updates */
export type TickerCallback = (deltaMs: number, elapsedMs: number) => void

export interface PixiAppRefs {
  appRef: React.MutableRefObject<Application | null>
  worldRef: React.MutableRefObject<Container | null>
  sceneBgContainerRef: React.MutableRefObject<Container | null>
  knotSpritesRef: React.MutableRefObject<Map<KnotId, KnotSprite>>
  threadGraphicsRef: React.MutableRefObject<Map<string, ThreadGraphic>>
  shuttleSpritesRef: React.MutableRefObject<Map<string, Sprite>>
  cameraRef: React.MutableRefObject<Camera>
  facadeContainerRef: React.RefObject<HTMLDivElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  pixiClickedRef: React.MutableRefObject<boolean>
  draggingRef: React.MutableRefObject<boolean>
  lastMouseRef: React.MutableRefObject<{ x: number; y: number }>
  /** Total elapsed time since app init (ms) — for animation timing */
  elapsedRef: React.MutableRefObject<number>
  appReady: boolean
  applyCamera: () => void
  /** Register a callback that runs every frame via PixiJS Ticker */
  addTickerCallback: (cb: TickerCallback) => void
  /** Unregister a ticker callback */
  removeTickerCallback: (cb: TickerCallback) => void
}

export function usePixiApp(): PixiAppRefs {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const sceneBgContainerRef = useRef<Container | null>(null)
  const knotSpritesRef = useRef<Map<KnotId, KnotSprite>>(new Map())
  const threadGraphicsRef = useRef<Map<string, ThreadGraphic>>(new Map())
  const shuttleSpritesRef = useRef<Map<string, Sprite>>(new Map())
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const facadeContainerRef = useRef<HTMLDivElement>(null)
  const pixiClickedRef = useRef(false)
  const draggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const elapsedRef = useRef(0)
  const tickerCallbacksRef = useRef<Set<TickerCallback>>(new Set())

  const [appReady, setAppReady] = useState(false)

  const addTickerCallback = useCallback((cb: TickerCallback) => {
    tickerCallbacksRef.current.add(cb)
  }, [])

  const removeTickerCallback = useCallback((cb: TickerCallback) => {
    tickerCallbacksRef.current.delete(cb)
  }, [])

  // Apply camera transform to world, scene background (parallax), and CSS facade overlay
  const applyCamera = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const camera = cameraRef.current
    world.x = camera.x
    world.y = camera.y
    world.scale.set(camera.zoom)

    // Scene background parallax — moves slower than world for depth effect
    const sceneBg = sceneBgContainerRef.current
    if (sceneBg) {
      sceneBg.x = camera.x * SCENE_BG_PARALLAX
      sceneBg.y = camera.y * SCENE_BG_PARALLAX
      sceneBg.scale.set(camera.zoom * 0.8 + 0.2) // Scale less aggressively
    }

    if (facadeContainerRef.current) {
      facadeContainerRef.current.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
    }
  }, [])

  // Initialize PixiJS Application
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

      // Scene background container (z=0, behind everything, parallax scroll)
      const sceneBg = new Container()
      sceneBg.label = 'scene-background'
      sceneBg.alpha = 0.6
      app.stage.addChild(sceneBg)
      sceneBgContainerRef.current = sceneBg

      // World container for pan/zoom (z=1, on top of background)
      const world = new Container()
      world.label = 'world'
      app.stage.addChild(world)

      appRef.current = app
      worldRef.current = world

      // Make the stage interactive for pan/zoom
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      // Ticker integration for frame-locked animation
      app.ticker.add((ticker) => {
        const deltaMs = ticker.deltaMS
        elapsedRef.current += deltaMs
        for (const cb of tickerCallbacksRef.current) {
          cb(deltaMs, elapsedRef.current)
        }
      })

      setAppReady(true)
    })()

    return () => {
      mounted = false
      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas)
        }
        appRef.current.destroy(true)
        appRef.current = null
        worldRef.current = null
        sceneBgContainerRef.current = null
      }
      knotSpritesRef.current.clear()
      threadGraphicsRef.current.clear()
      shuttleSpritesRef.current.clear()
    }
  }, [])

  return {
    appRef,
    worldRef,
    sceneBgContainerRef,
    knotSpritesRef,
    threadGraphicsRef,
    shuttleSpritesRef,
    cameraRef,
    facadeContainerRef,
    containerRef,
    pixiClickedRef,
    draggingRef,
    lastMouseRef,
    elapsedRef,
    appReady,
    applyCamera,
    addTickerCallback,
    removeTickerCallback,
  }
}
