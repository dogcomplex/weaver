/**
 * Tests for useIdleAnimations — keyword parsing logic.
 *
 * The parseIdleHint() function is a pure function with no PixiJS dependency,
 * making it ideal for unit testing.
 */

import { describe, it, expect } from 'vitest'
import { parseIdleHint } from '../useIdleAnimations.js'

describe('parseIdleHint', () => {
  it('returns empty array for empty string', () => {
    expect(parseIdleHint('')).toEqual([])
  })

  it('returns empty array for unrecognized keywords', () => {
    expect(parseIdleHint('dancing wildly in the moonlight')).toEqual([])
  })

  // ─── Single keyword matching ────────────────────────────────

  it('parses bob keyword', () => {
    const effects = parseIdleHint('Gentle bobbing motion')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('bob')
    expect(effects[0].amplitude).toBe(3)
    expect(effects[0].frequency).toBe(0.0012)
    expect(effects[0].phase).toBeGreaterThanOrEqual(0)
    expect(effects[0].phase).toBeLessThan(Math.PI * 2)
  })

  it('parses float keyword as bob effect', () => {
    const effects = parseIdleHint('Floating gently')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('bob')
  })

  it('parses drift keyword as bob effect', () => {
    const effects = parseIdleHint('Slow drifting')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('bob')
  })

  it('parses glow keyword', () => {
    const effects = parseIdleHint('Soft glowing emanation')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('glow')
    expect(effects[0].amplitude).toBe(0.12)
  })

  it('parses shine keyword as glow effect', () => {
    const effects = parseIdleHint('A faint shine')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('glow')
  })

  it('parses pulse keyword as pulse-scale effect', () => {
    const effects = parseIdleHint('Pulsing rhythmically')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('pulse-scale')
    expect(effects[0].amplitude).toBe(0.02)
  })

  it('parses breathe keyword as pulse-scale effect', () => {
    const effects = parseIdleHint('Breathing slowly')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('pulse-scale')
  })

  it('parses spin keyword as rotate effect', () => {
    const effects = parseIdleHint('Slowly spinning')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('rotate')
    expect(effects[0].amplitude).toBe(0.03)
  })

  it('parses rotate keyword as rotate effect', () => {
    const effects = parseIdleHint('Gently rotating')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('rotate')
  })

  it('parses flicker keyword', () => {
    const effects = parseIdleHint('Flickering softly')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('flicker')
    expect(effects[0].amplitude).toBe(0.15)
  })

  it('parses twinkle keyword as flicker effect', () => {
    const effects = parseIdleHint('Twinkling stars')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('flicker')
  })

  it('parses shimmer keyword as flicker effect', () => {
    const effects = parseIdleHint('Shimmering surface')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('flicker')
  })

  it('parses swirl keyword', () => {
    const effects = parseIdleHint('Swirling mist')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('swirl')
    expect(effects[0].amplitude).toBe(0.04)
  })

  it('parses vortex keyword as swirl effect', () => {
    const effects = parseIdleHint('A slow vortex')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('swirl')
  })

  // ─── Composability ─────────────────────────────────────────

  it('stacks multiple effects from multi-keyword hint', () => {
    const effects = parseIdleHint('Gentle bobbing, soft glow emanating')
    expect(effects).toHaveLength(2)
    const types = effects.map(e => e.type)
    expect(types).toContain('bob')
    expect(types).toContain('glow')
  })

  it('stacks three effects', () => {
    const effects = parseIdleHint('Floating with a shimmer and slow pulsing')
    expect(effects).toHaveLength(3)
    const types = effects.map(e => e.type)
    expect(types).toContain('bob')     // float
    expect(types).toContain('flicker') // shimmer
    expect(types).toContain('pulse-scale') // pulsing
  })

  // ─── Case insensitivity ────────────────────────────────────

  it('matches case-insensitively', () => {
    const effects = parseIdleHint('BOBBING and GLOWING')
    expect(effects).toHaveLength(2)
  })

  // ─── Phase randomization ───────────────────────────────────

  it('assigns random phase to each effect', () => {
    // Run multiple times — phases should vary (statistically)
    const phases = new Set<number>()
    for (let i = 0; i < 10; i++) {
      const effects = parseIdleHint('bobbing')
      phases.add(effects[0].phase)
    }
    // With 10 random values in [0, 2*PI), extremely unlikely all are identical
    expect(phases.size).toBeGreaterThan(1)
  })

  // ─── Realistic Loci-generated hints ─────────────────────────

  it('parses "Gentle bobbing, steam rising" (Darkroom Loci)', () => {
    const effects = parseIdleHint('Gentle bobbing, steam rising')
    expect(effects).toHaveLength(1)
    expect(effects[0].type).toBe('bob')
  })

  it('parses "Soft pulsing glow, chemical shimmer" (Darkroom Loci)', () => {
    const effects = parseIdleHint('Soft pulsing glow, chemical shimmer')
    expect(effects).toHaveLength(3)
    const types = effects.map(e => e.type)
    expect(types).toContain('glow')
    expect(types).toContain('pulse-scale')
    expect(types).toContain('flicker') // shimmer
  })

  it('parses "Slow rotation, ethereal luminous aura" (Fantasy Loci)', () => {
    const effects = parseIdleHint('Slow rotation, ethereal luminous aura')
    expect(effects).toHaveLength(2)
    const types = effects.map(e => e.type)
    expect(types).toContain('rotate')
    expect(types).toContain('glow') // luminous
  })
})
