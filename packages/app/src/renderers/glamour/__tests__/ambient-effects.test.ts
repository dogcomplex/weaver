/**
 * Tests for useAmbientEffects — ambient description parsing.
 *
 * The parseAmbientDescription() function is a pure function with no PixiJS dependency.
 */

import { describe, it, expect } from 'vitest'
import { parseAmbientDescription } from '../ambientParsing.js'

describe('parseAmbientDescription', () => {
  it('returns empty set for empty string', () => {
    expect(parseAmbientDescription('').size).toBe(0)
  })

  it('returns empty set for unrecognized keywords', () => {
    expect(parseAmbientDescription('The room is quiet and still').size).toBe(0)
  })

  // ─── Single effect matching ────────────────────────────────

  it('detects vignette from "safelight" keyword', () => {
    const effects = parseAmbientDescription('Warm amber safelights pulse gently')
    expect(effects.has('vignette')).toBe(true)
  })

  it('detects vignette from "glow" keyword', () => {
    const effects = parseAmbientDescription('A soft glow fills the space')
    expect(effects.has('vignette')).toBe(true)
  })

  it('detects particles-drift from "steam" keyword', () => {
    const effects = parseAmbientDescription('Steam rises from developer bath')
    expect(effects.has('particles-drift')).toBe(true)
  })

  it('detects particles-drift from "mist" keyword', () => {
    const effects = parseAmbientDescription('Mist curls through the air')
    expect(effects.has('particles-drift')).toBe(true)
  })

  it('detects particles-float from "dust" keyword', () => {
    const effects = parseAmbientDescription('Dust motes drift in light beams')
    expect(effects.has('particles-float')).toBe(true)
  })

  it('detects particles-fall from "rain" keyword', () => {
    const effects = parseAmbientDescription('Gentle rain falls outside')
    expect(effects.has('particles-fall')).toBe(true)
  })

  it('detects scene-pulse from "puls" stem', () => {
    const effects = parseAmbientDescription('A gentle pulsing rhythm')
    expect(effects.has('scene-pulse')).toBe(true)
  })

  // ─── Composability ─────────────────────────────────────────

  it('detects multiple effects from complex description', () => {
    const effects = parseAmbientDescription(
      'Warm amber safelights pulse gently. Steam rises from developer bath, dust motes drift.'
    )
    expect(effects.has('vignette')).toBe(true)      // safelight/amber
    expect(effects.has('scene-pulse')).toBe(true)    // pulse
    expect(effects.has('particles-drift')).toBe(true) // steam
    expect(effects.has('particles-float')).toBe(true) // dust motes
  })

  // ─── Case insensitivity ────────────────────────────────────

  it('matches case-insensitively', () => {
    const effects = parseAmbientDescription('STEAM and GLOWING lights')
    expect(effects.has('particles-drift')).toBe(true)
    expect(effects.has('vignette')).toBe(true)
  })

  // ─── Realistic Loci-generated descriptions ─────────────────

  it('parses darkroom description', () => {
    const effects = parseAmbientDescription(
      'Gentle red glow pulses, chemical trays steam slightly, paper prints sway gently'
    )
    expect(effects.has('vignette')).toBe(true)       // glow
    expect(effects.has('scene-pulse')).toBe(true)     // pulses
    expect(effects.has('particles-drift')).toBe(true) // steam
  })

  it('parses enchanted forest description', () => {
    const effects = parseAmbientDescription(
      'Fireflies drift lazily, mist clings to ground, luminous mushrooms pulse'
    )
    expect(effects.has('particles-float')).toBe(true)  // firefl
    expect(effects.has('particles-drift')).toBe(true)   // mist
    expect(effects.has('vignette')).toBe(true)          // luminous
    expect(effects.has('scene-pulse')).toBe(true)       // pulse
  })
})
