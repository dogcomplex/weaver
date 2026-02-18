/**
 * Shared types for the Glamour renderer modules.
 */

import type { Container, Graphics, Sprite, Text } from 'pixi.js'
import type { GlamourElement, GlamourConnection } from '#weaver/glamour'
import type { KnotId } from '#weaver/core'

/** Procedural idle animation effect parsed from animationHints */
export interface IdleEffect {
  type: 'bob' | 'glow' | 'pulse-scale' | 'rotate' | 'flicker' | 'swirl'
  amplitude: number
  frequency: number
  /** Phase offset — randomized per knot to desynchronize animations */
  phase: number
}

export interface KnotSprite {
  container: Container
  knotId: KnotId
  element: GlamourElement
  /** Active idle animation effects (managed by useIdleAnimations) */
  idleEffects?: IdleEffect[]
  /** Stored base position so animation offsets don't accumulate drift */
  basePosition?: { x: number; y: number }
  /** Whether this knot is currently hovered (for interactionStyle-based behavior) */
  hovered?: boolean
  /** Cycle index for click-cycle interactionStyle */
  cycleIndex?: number
}

export interface ThreadGraphic {
  threadId: string
  graphic: Graphics
  connection: GlamourConnection
  sourcePos: { x: number; y: number }
  targetPos: { x: number; y: number }
  /** Label text displayed at thread midpoint */
  labelText?: Text
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

// ─── Constants ──────────────────────────────────────────────────

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 3
export const ZOOM_SPEED = 0.001
export const SELECTED_TINT = 0x6a6aff
export const HIGHLIGHT_TINT = 0x4af0ff

/** Labels used for visual children inside knot containers */
export const VISUAL_LABELS = new Set(['fallback-visual', 'sprite-asset', 'svg-sprite'])
