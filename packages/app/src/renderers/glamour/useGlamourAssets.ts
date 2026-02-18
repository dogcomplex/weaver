/**
 * useGlamourAssets — Asset hydration and WebSocket hot-swap.
 *
 * On mount/manifest change, fetches the server's cached asset registry
 * and provides a GlamourAssetResolver for ManifestTheme.
 * Also listens for WebSocket broadcasts:
 *   - `glamour-asset`: hot-swap knot visuals with generated PNGs
 *   - `glamour-scene-bg`: load scene background sprite
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Application, Sprite, Texture, Container } from 'pixi.js'
import type { KnotId } from '#weaver/core'
import { GlamourAssetResolver } from '#weaver/glamour'
import type { MetaphorManifest } from '#weaver/glamour'
import type { WebSocketListener } from '../../hooks/useWeaveWebSocket.js'
import type { KnotSprite } from './types.js'
import { hotSwapKnotAsset, loadSpriteTexture } from './helpers.js'

interface UseGlamourAssetsOptions {
  activeManifest: MetaphorManifest | null | undefined
  knotSpritesRef: React.MutableRefObject<Map<KnotId, KnotSprite>>
  sceneBgContainerRef: React.MutableRefObject<Container | null>
  appRef: React.MutableRefObject<Application | null>
  /** Shared WebSocket subscribe function (from useWeaveWebSocket) */
  wsSubscribe?: (listener: WebSocketListener) => () => void
}

export function useGlamourAssets({ activeManifest, knotSpritesRef, sceneBgContainerRef, appRef, wsSubscribe }: UseGlamourAssetsOptions) {
  const [assetResolver, setAssetResolver] = useState<GlamourAssetResolver | null>(null)
  const [sceneBgUrl, setSceneBgUrl] = useState<string | null>(null)

  // Keep a ref to the active manifest so the WebSocket handler can access it
  // without re-creating the connection on every manifest change
  const activeManifestRef = useRef(activeManifest)
  activeManifestRef.current = activeManifest

  // Hydrate asset resolver with already-generated assets on mount/manifest change
  useEffect(() => {
    if (!activeManifest) {
      setAssetResolver(null)
      setSceneBgUrl(null)
      return
    }
    // Clear background immediately so old manifest's bg doesn't linger during fetch
    setSceneBgUrl(null)

    // Fetch server's asset registry so resolveVisual() can find cached PNGs
    fetch('/api/ai/glamour/assets')
      .then(r => r.json())
      .then((assets: Record<string, { type: string; url: string; hash: string }>) => {
        const resolver = new GlamourAssetResolver()
        for (const [key, asset] of Object.entries(assets)) {
          resolver.register(key, asset)
        }
        setAssetResolver(resolver)

        // Check for scene background in the asset registry for THIS manifest
        const sceneBgKey = `scene-bg_${activeManifest.id}`
        const sceneBgAsset = assets[sceneBgKey]
        if (sceneBgAsset?.url) {
          setSceneBgUrl(sceneBgAsset.url)
        }
      })
      .catch(() => {}) // Silent fail — will use fallbacks
  }, [activeManifest])

  // Load scene background sprite when URL is available
  const loadSceneBackground = useCallback((url: string) => {
    const sceneBg = sceneBgContainerRef.current
    if (!sceneBg) return

    loadSpriteTexture(url).then(texture => {
      if (texture === Texture.EMPTY) return

      // Remove any existing background sprite
      for (let i = sceneBg.children.length - 1; i >= 0; i--) {
        const child = sceneBg.children[i]
        sceneBg.removeChild(child)
        child.destroy()
      }

      // Size dynamically based on viewport — cover 3× viewport for comfortable parallax
      const app = appRef.current
      const vw = app?.screen.width ?? 1920
      const vh = app?.screen.height ?? 1080
      const bgWidth = Math.max(vw * 3, 2048)
      const bgHeight = Math.max(vh * 3, 1024)

      const sprite = new Sprite(texture)
      sprite.label = 'scene-bg-image'
      sprite.anchor.set(0.5, 0.5)
      sprite.width = bgWidth
      sprite.height = bgHeight
      sceneBg.addChild(sprite)
    })
  }, [sceneBgContainerRef, appRef])

  // Apply scene background when URL changes
  useEffect(() => {
    if (sceneBgUrl) {
      loadSceneBackground(sceneBgUrl)
    } else {
      // Clear background
      const sceneBg = sceneBgContainerRef.current
      if (sceneBg) {
        for (let i = sceneBg.children.length - 1; i >= 0; i--) {
          const child = sceneBg.children[i]
          sceneBg.removeChild(child)
          child.destroy()
        }
      }
    }
  }, [sceneBgUrl, loadSceneBackground, sceneBgContainerRef])

  // Subscribe to shared WebSocket for real-time asset hot-swap
  useEffect(() => {
    if (!wsSubscribe) return

    return wsSubscribe((msg) => {
      if (msg.type === 'glamour-asset' && msg.knotId && msg.url) {
        hotSwapKnotAsset(knotSpritesRef.current, msg.knotId as string, msg.url as string)
      } else if (msg.type === 'glamour-scene-bg' && msg.url) {
        // Only accept scene-bg messages for the currently active manifest
        if (msg.manifestId && msg.manifestId === activeManifestRef.current?.id) {
          setSceneBgUrl(msg.url as string)
        }
      }
    })
  }, [wsSubscribe, knotSpritesRef])

  return { assetResolver }
}
