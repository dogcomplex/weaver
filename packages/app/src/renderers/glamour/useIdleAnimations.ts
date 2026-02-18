/**
 * useIdleAnimations — Keyword-driven procedural idle animations.
 *
 * Parses the Loci's natural-language `animationHints.idle` strings,
 * extracts keywords, and maps them to procedural PixiJS effects
 * via the existing addTickerCallback infrastructure.
 *
 * Effects are subtle and composable: multiple keywords = stacked effects.
 * Phase randomization prevents all knots from animating in sync.
 */

import { useEffect, useRef } from 'react'
import type { KnotId } from '#weaver/core'
import type { KnotSprite, IdleEffect } from './types.js'
import type { TickerCallback } from './usePixiApp.js'

// ─── Keyword → Effect Mapping ──────────────────────────────────

interface KeywordRule {
  pattern: RegExp
  effect: IdleEffect['type']
  amplitude: number
  frequency: number
}

const KEYWORD_RULES: KeywordRule[] = [
  { pattern: /\b(bob|float|hover|drift|sway|undulat|rock|nod)/i,          effect: 'bob',         amplitude: 3,    frequency: 0.0012 },
  { pattern: /\b(glow|shine|glint|luminous|sheen|radi|light|bright)/i,    effect: 'glow',        amplitude: 0.12, frequency: 0.002  },
  { pattern: /\b(puls|throb|beat|breath|expand|contract|swell)/i,          effect: 'pulse-scale', amplitude: 0.02, frequency: 0.0015 },
  { pattern: /\b(spin|rotat|turn|revolv|gyrat)/i,                          effect: 'rotate',      amplitude: 0.03, frequency: 0.001  },
  { pattern: /\b(flicker|blink|flash|twinkl|shimmer|strob|spark)/i,        effect: 'flicker',     amplitude: 0.15, frequency: 0.006  },
  { pattern: /\b(swirl|spiral|vortex|whirl|churn|eddy)/i,                  effect: 'swirl',       amplitude: 0.04, frequency: 0.0012 },
]

/**
 * Parse a natural-language idle hint string into procedural effects.
 * Exported for testing — this is a pure function with no PixiJS dependency.
 */
export function parseIdleHint(hint: string): IdleEffect[] {
  const effects: IdleEffect[] = []
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(hint)) {
      effects.push({
        type: rule.effect,
        amplitude: rule.amplitude,
        frequency: rule.frequency,
        phase: Math.random() * Math.PI * 2,  // desync per-instance
      })
    }
  }
  return effects
}

// ─── Effect Application ──────────────────────────────────────────

function applyIdleEffects(ks: KnotSprite, elapsedMs: number): void {
  if (!ks.idleEffects || ks.idleEffects.length === 0) return
  if (!ks.basePosition) return

  let yOffset = 0
  let scaleOffset = 0
  let rotationOffset = 0
  let alphaOffset = 0

  for (const fx of ks.idleEffects) {
    const t = elapsedMs * fx.frequency + fx.phase
    switch (fx.type) {
      case 'bob':
        yOffset += Math.sin(t) * fx.amplitude
        break
      case 'glow':
        alphaOffset += Math.sin(t) * fx.amplitude
        break
      case 'pulse-scale':
        scaleOffset += Math.sin(t) * fx.amplitude
        break
      case 'rotate':
        rotationOffset += Math.sin(t) * fx.amplitude
        break
      case 'flicker':
        // Intermittent jitter — only active part of the cycle
        alphaOffset += (Math.random() - 0.5) * fx.amplitude * (Math.sin(t) > 0.3 ? 1 : 0)
        break
      case 'swirl':
        rotationOffset += Math.sin(t) * fx.amplitude
        scaleOffset += Math.sin(t * 1.3) * fx.amplitude * 0.5
        break
    }
  }

  // Apply composited offsets to the knot container
  ks.container.y = ks.basePosition.y + yOffset
  ks.container.scale.set(1 + scaleOffset)
  ks.container.rotation = rotationOffset

  // Alpha: clamp to [0.5, 1], base is 0.85 for unselected knots
  const baseAlpha = 0.85
  ks.container.alpha = Math.max(0.5, Math.min(1, baseAlpha + alphaOffset))
}

// ─── Hook ────────────────────────────────────────────────────────

interface UseIdleAnimationsOptions {
  knotSpritesRef: React.MutableRefObject<Map<KnotId, KnotSprite>>
  addTickerCallback: (cb: TickerCallback) => void
  removeTickerCallback: (cb: TickerCallback) => void
}

export function useIdleAnimations({
  knotSpritesRef,
  addTickerCallback,
  removeTickerCallback,
}: UseIdleAnimationsOptions) {
  // Track whether we've already parsed effects for each knot
  const parsedKnotsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Ticker callback: runs every frame, iterates all knot sprites
    const tickerCb: TickerCallback = (_deltaMs, elapsedMs) => {
      for (const [knotId, ks] of knotSpritesRef.current) {
        // Parse idle effects on first encounter (lazy init)
        if (!parsedKnotsRef.current.has(knotId)) {
          parsedKnotsRef.current.add(knotId)
          const hint = ks.element.animationHints?.idle
          if (hint) {
            const effects = parseIdleHint(hint)
            // Double amplitude for 'animated-idle' interaction style
            if (ks.element.interactionStyle === 'animated-idle') {
              for (const fx of effects) {
                fx.amplitude *= 2
              }
            }
            ks.idleEffects = effects
          }
          // Store base position so animations don't drift
          ks.basePosition = { x: ks.container.x, y: ks.container.y }
        }

        // Apply effects
        applyIdleEffects(ks, elapsedMs)
      }
    }

    addTickerCallback(tickerCb)

    return () => {
      removeTickerCallback(tickerCb)
      // Reset knot animations on cleanup
      for (const [, ks] of knotSpritesRef.current) {
        if (ks.basePosition) {
          ks.container.y = ks.basePosition.y
          ks.container.scale.set(1)
          ks.container.rotation = 0
          ks.container.alpha = 0.85
        }
      }
      parsedKnotsRef.current.clear()
    }
  }, [knotSpritesRef, addTickerCallback, removeTickerCallback])
}
