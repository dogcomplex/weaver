/**
 * useAmbientEffects — Scene-level ambient particle and glow effects.
 *
 * Parses sceneConfig.ambientDescription (e.g., "Warm amber safelights pulse
 * gently. Steam rises from developer bath...") into visual effects rendered
 * via PixiJS Graphics in the scene-background container.
 *
 * Performance budget: max 50 particles total.
 * All particles are Graphics circles (radius 1-3px, alpha 0.1-0.3).
 */

import { useEffect, useRef } from 'react'
import { Container, Graphics } from 'pixi.js'
import type { TickerCallback } from './usePixiApp.js'
import { parseAmbientDescription } from './ambientParsing.js'

// Re-export for convenience
export { parseAmbientDescription } from './ambientParsing.js'

// ─── Ambient Effect Types ─────────────────────────────────────

interface Particle {
  graphic: Graphics
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  radius: number
}

// ─── Hook ────────────────────────────────────────────────────────

interface UseAmbientEffectsOptions {
  sceneBgContainerRef: React.MutableRefObject<Container | null>
  appRef: React.MutableRefObject<{ screen: { width: number; height: number } } | null>
  addTickerCallback: (cb: TickerCallback) => void
  removeTickerCallback: (cb: TickerCallback) => void
  ambientDescription: string | undefined
}

export function useAmbientEffects({
  sceneBgContainerRef,
  appRef,
  addTickerCallback,
  removeTickerCallback,
  ambientDescription,
}: UseAmbientEffectsOptions) {
  const ambientContainerRef = useRef<Container | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const vignetteRef = useRef<Graphics | null>(null)

  useEffect(() => {
    const sceneBg = sceneBgContainerRef.current
    if (!sceneBg || !ambientDescription) return

    const effects = parseAmbientDescription(ambientDescription)
    if (effects.size === 0) return

    // Create ambient effects container as child of scene-bg
    const ambientContainer = new Container()
    ambientContainer.label = 'ambient-effects'
    sceneBg.addChild(ambientContainer)
    ambientContainerRef.current = ambientContainer

    const app = appRef.current
    const vw = app?.screen.width ?? 1920
    const vh = app?.screen.height ?? 1080
    const particles: Particle[] = []

    // ─── Vignette glow ────────────────────────────────────────
    if (effects.has('vignette')) {
      const vignette = new Graphics()
      vignette.label = 'ambient-vignette'
      // Warm tinted radial-ish overlay — a soft rectangle with low alpha
      vignette.rect(-vw, -vh, vw * 2, vh * 2)
      vignette.fill({ color: 0xffaa44, alpha: 0.04 })
      ambientContainer.addChild(vignette)
      vignetteRef.current = vignette
    }

    // ─── Particles: drift upward (steam/mist) ─────────────────
    if (effects.has('particles-drift')) {
      const count = Math.min(20, 50 - particles.length)
      for (let i = 0; i < count; i++) {
        const g = new Graphics()
        const radius = 1 + Math.random() * 2
        g.circle(0, 0, radius)
        g.fill({ color: 0xcccccc, alpha: 0.15 + Math.random() * 0.1 })
        const x = (Math.random() - 0.5) * vw * 2
        const y = (Math.random() - 0.5) * vh * 2
        g.x = x
        g.y = y
        ambientContainer.addChild(g)
        particles.push({
          graphic: g,
          x, y,
          vx: (Math.random() - 0.5) * 0.1,
          vy: -0.15 - Math.random() * 0.2,  // drift upward
          alpha: 0.15 + Math.random() * 0.1,
          radius,
        })
      }
    }

    // ─── Particles: float randomly (dust/motes) ───────────────
    if (effects.has('particles-float')) {
      const count = Math.min(15, 50 - particles.length)
      for (let i = 0; i < count; i++) {
        const g = new Graphics()
        const radius = 0.5 + Math.random() * 1.5
        g.circle(0, 0, radius)
        g.fill({ color: 0xffeedd, alpha: 0.1 + Math.random() * 0.15 })
        const x = (Math.random() - 0.5) * vw * 2
        const y = (Math.random() - 0.5) * vh * 2
        g.x = x
        g.y = y
        ambientContainer.addChild(g)
        particles.push({
          graphic: g,
          x, y,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,  // Brownian drift
          alpha: 0.1 + Math.random() * 0.15,
          radius,
        })
      }
    }

    // ─── Particles: fall downward (rain/drips) ────────────────
    if (effects.has('particles-fall')) {
      const count = Math.min(25, 50 - particles.length)
      for (let i = 0; i < count; i++) {
        const g = new Graphics()
        const radius = 0.5 + Math.random() * 1
        g.circle(0, 0, radius)
        g.fill({ color: 0x88aacc, alpha: 0.12 + Math.random() * 0.1 })
        const x = (Math.random() - 0.5) * vw * 2
        const y = (Math.random() - 0.5) * vh * 2
        g.x = x
        g.y = y
        ambientContainer.addChild(g)
        particles.push({
          graphic: g,
          x, y,
          vx: (Math.random() - 0.5) * 0.05,
          vy: 0.3 + Math.random() * 0.4,  // fall downward
          alpha: 0.12 + Math.random() * 0.1,
          radius,
        })
      }
    }

    particlesRef.current = particles

    // ─── Ticker: animate particles + scene pulse ──────────────
    const hasScenePulse = effects.has('scene-pulse')
    const tickerCb: TickerCallback = (_deltaMs, elapsedMs) => {
      // Animate particles
      for (const p of particlesRef.current) {
        // Brownian jitter for float-type particles
        p.x += p.vx + (Math.random() - 0.5) * 0.05
        p.y += p.vy + (Math.random() - 0.5) * 0.05
        p.graphic.x = p.x
        p.graphic.y = p.y

        // Wrap particles that drift off-screen
        if (p.y < -vh) p.y = vh
        if (p.y > vh) p.y = -vh
        if (p.x < -vw) p.x = vw
        if (p.x > vw) p.x = -vw

        // Gentle alpha oscillation
        p.graphic.alpha = p.alpha + Math.sin(elapsedMs * 0.001 + p.x) * 0.05
      }

      // Scene pulse: gentle alpha oscillation of vignette
      if (hasScenePulse && vignetteRef.current) {
        vignetteRef.current.alpha = 0.6 + Math.sin(elapsedMs * 0.0008) * 0.3
      }
    }

    addTickerCallback(tickerCb)

    return () => {
      removeTickerCallback(tickerCb)
      // Clean up
      if (ambientContainerRef.current) {
        const parent = ambientContainerRef.current.parent
        if (parent) parent.removeChild(ambientContainerRef.current)
        ambientContainerRef.current.destroy({ children: true })
        ambientContainerRef.current = null
      }
      particlesRef.current = []
      vignetteRef.current = null
    }
  }, [sceneBgContainerRef, appRef, addTickerCallback, removeTickerCallback, ambientDescription])
}
