/**
 * Pure helper functions for the Glamour renderer.
 * Texture loading, fallback rendering, drawing, and nested value access.
 */

import { Assets, Container, Graphics, Sprite, Texture, TextStyle } from 'pixi.js'
import type { GlamourConnection, GlamourVisual } from '#weaver/glamour'
import type { KnotSprite } from './types.js'
import type { KnotId } from '#weaver/core'
import { VISUAL_LABELS } from './types.js'

// ─── Label Style ────────────────────────────────────────────────

export const LABEL_STYLE = new TextStyle({
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 11,
  fill: '#c0c0d0',
  align: 'center',
})

// ─── Texture Cache & Loaders ────────────────────────────────────

const textureCache = new Map<string, Texture>()

export async function loadSvgTexture(path: string): Promise<Texture> {
  if (textureCache.has(path)) return textureCache.get(path)!
  try {
    const texture = await Assets.load(path)
    textureCache.set(path, texture)
    return texture
  } catch {
    return Texture.EMPTY
  }
}

export async function loadSpriteTexture(url: string): Promise<Texture> {
  if (textureCache.has(url)) return textureCache.get(url)!
  try {
    const texture = await Assets.load(url)
    textureCache.set(url, texture)
    return texture
  } catch {
    return Texture.EMPTY
  }
}

// ─── Fallback Visual Rendering ──────────────────────────────────

/**
 * Render a fallback GlamourVisual into a container.
 * Used when a 'generated' visual's asset hasn't arrived yet.
 */
export function renderFallbackVisual(
  container: Container,
  fallback: GlamourVisual,
  size: { width: number; height: number },
): void {
  if (fallback.type === 'color') {
    const fill = parseInt(fallback.fill.replace('#', ''), 16)
    const bg = new Graphics()
    bg.label = 'fallback-visual'
    bg.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 8)
    bg.fill({ color: fill, alpha: 0.6 })
    if (fallback.stroke) {
      const stroke = parseInt(fallback.stroke.replace('#', ''), 16)
      bg.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 8)
      bg.stroke({ color: stroke, width: 1.5 })
    }
    container.addChildAt(bg, 1)
  } else if (fallback.type === 'svg') {
    loadSvgTexture(fallback.path).then(texture => {
      if (texture === Texture.EMPTY) return
      const sprite = new Sprite(texture)
      sprite.label = 'fallback-visual'
      sprite.anchor.set(0.5, 0.5)
      sprite.width = size.width
      sprite.height = size.height
      if (container.children.length > 1) {
        container.addChildAt(sprite, 1)
      } else {
        container.addChild(sprite)
      }
    })
  }
}

// ─── Hot-Swap: Replace a pending knot visual with a loaded asset ─

export function hotSwapKnotAsset(
  knotSprites: Map<KnotId, KnotSprite>,
  knotId: string,
  url: string,
): void {
  const ks = knotSprites.get(knotId)
  if (!ks) return

  loadSpriteTexture(url).then(texture => {
    if (texture === Texture.EMPTY) return

    // Remove ALL visual children (any sprite/graphic that isn't the bg or label)
    for (let i = ks.container.children.length - 1; i >= 0; i--) {
      const child = ks.container.children[i]
      if (VISUAL_LABELS.has(child.label)) {
        ks.container.removeChild(child)
        child.destroy()
      }
    }

    // Insert new sprite
    const sprite = new Sprite(texture)
    sprite.label = 'sprite-asset'
    sprite.anchor.set(0.5, 0.5)
    sprite.width = ks.element.size.width
    sprite.height = ks.element.size.height
    ks.container.addChildAt(sprite, 1)
  })
}

// ─── Drawing Helpers ────────────────────────────────────────────

export function drawThread(
  graphic: Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  connection: GlamourConnection,
) {
  graphic.clear()
  const color = parseInt(connection.visual.color.replace('#', ''), 16)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)

  if (connection.visual.style === 'dashed') {
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
    const alpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.003)
    graphic.moveTo(from.x, from.y)
    graphic.lineTo(to.x, to.y)
    graphic.stroke({ color, width: connection.visual.width, alpha })
  } else {
    graphic.moveTo(from.x, from.y)
    graphic.lineTo(to.x, to.y)
    graphic.stroke({ color, width: connection.visual.width, alpha: 0.7 })
  }

  // Arrow head at target — scales with thread width
  const angle = Math.atan2(dy, dx)
  const arrowLen = Math.max(6, connection.visual.width * 3)
  const arrowSpread = 0.35
  graphic.moveTo(to.x, to.y)
  graphic.lineTo(
    to.x - arrowLen * Math.cos(angle - arrowSpread),
    to.y - arrowLen * Math.sin(angle - arrowSpread),
  )
  graphic.moveTo(to.x, to.y)
  graphic.lineTo(
    to.x - arrowLen * Math.cos(angle + arrowSpread),
    to.y - arrowLen * Math.sin(angle + arrowSpread),
  )
  graphic.stroke({ color, width: Math.max(1, connection.visual.width * 0.7), alpha: 0.6 })

  // Midpoint data type label (if thread has a label and is long enough)
  if (connection.label && len > 80) {
    const midX = from.x + dx * 0.5
    const midY = from.y + dy * 0.5
    // Small perpendicular offset so label doesn't overlap line
    const perpX = -dy / len * 8
    const perpY = dx / len * 8

    // Draw small label background + text
    const labelFontSize = 7
    const labelWidth = connection.label.length * 4.5 + 8
    const labelHeight = 12
    graphic.roundRect(
      midX + perpX - labelWidth / 2,
      midY + perpY - labelHeight / 2,
      labelWidth,
      labelHeight,
      3,
    )
    graphic.fill({ color: 0x0d0d18, alpha: 0.8 })
    graphic.stroke({ color, width: 0.5, alpha: 0.4 })
  }
}

/** Thread label style (used by scene sync to create Text labels at midpoints) */
export const THREAD_LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 7,
  fill: '#6a6a9a',
  align: 'center',
})

// ─── Utility: Nested Value Access ───────────────────────────────

export function getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
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
