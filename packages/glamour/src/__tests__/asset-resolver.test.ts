import { describe, it, expect, beforeEach } from 'vitest'
import { hashKnotConfig, GlamourAssetResolver } from '../asset-resolver.js'
import type { Knot } from '#weaver/core'

function makeKnot(overrides: Partial<Knot> = {}): Knot {
  return {
    id: 'k1',
    label: 'Test Knot',
    type: 'KSampler',
    position: { x: 0, y: 0 },
    data: { inputs: { seed: 42, steps: 20 } },
    ...overrides,
  }
}

describe('hashKnotConfig', () => {
  it('produces a deterministic hash', () => {
    const knot = makeKnot()
    const hash1 = hashKnotConfig(knot)
    const hash2 = hashKnotConfig(knot)
    expect(hash1).toBe(hash2)
  })

  it('hash is a non-empty string', () => {
    const hash = hashKnotConfig(makeKnot())
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('changes when data changes', () => {
    const knot1 = makeKnot({ data: { inputs: { seed: 42 } } })
    const knot2 = makeKnot({ data: { inputs: { seed: 99 } } })
    expect(hashKnotConfig(knot1)).not.toBe(hashKnotConfig(knot2))
  })

  it('changes when type changes', () => {
    const knot1 = makeKnot({ type: 'KSampler' })
    const knot2 = makeKnot({ type: 'VAEDecode' })
    expect(hashKnotConfig(knot1)).not.toBe(hashKnotConfig(knot2))
  })

  it('does not change when position or label changes', () => {
    const knot1 = makeKnot({ position: { x: 0, y: 0 }, label: 'A' })
    const knot2 = makeKnot({ position: { x: 100, y: 200 }, label: 'B' })
    expect(hashKnotConfig(knot1)).toBe(hashKnotConfig(knot2))
  })
})

describe('GlamourAssetResolver', () => {
  let resolver: GlamourAssetResolver

  beforeEach(() => {
    resolver = new GlamourAssetResolver()
  })

  it('falls back to aurora when cache is empty', () => {
    const result = resolver.resolve('k1', 'KSampler', 'abc123', 'loom')
    expect(result.fallbackLevel).toBe('aurora')
    expect(result.asset.type).toBe('fallback')
  })

  it('resolves exact match when cached', () => {
    const asset = { type: 'image' as const, url: '/exact.png', hash: 'abc123' }
    resolver.register('KSampler_k1_abc123', asset)
    const result = resolver.resolve('k1', 'KSampler', 'abc123', 'loom')
    expect(result.fallbackLevel).toBe('exact')
    expect(result.asset).toBe(asset)
  })

  it('falls back to type default when no exact match', () => {
    const asset = { type: 'svg' as const, url: '/ksampler.svg', hash: '' }
    resolver.register('loom_KSampler', asset)
    const result = resolver.resolve('k1', 'KSampler', 'xyz', 'loom')
    expect(result.fallbackLevel).toBe('type')
    expect(result.asset).toBe(asset)
  })

  it('falls back to theme default when no type match', () => {
    const asset = { type: 'svg' as const, url: '/default.svg', hash: '' }
    resolver.register('loom_default', asset)
    const result = resolver.resolve('k1', 'UnknownType', 'xyz', 'loom')
    expect(result.fallbackLevel).toBe('theme')
    expect(result.asset).toBe(asset)
  })

  it('falls back to aurora when nothing matches', () => {
    // Register assets for a different theme
    resolver.register('factory_KSampler', { type: 'svg', url: '/factory.svg', hash: '' })
    const result = resolver.resolve('k1', 'KSampler', 'xyz', 'loom')
    expect(result.fallbackLevel).toBe('aurora')
  })

  it('invalidate removes knot-specific entries', () => {
    resolver.register('KSampler_k1_abc', { type: 'image', url: '/a.png', hash: 'abc' })
    resolver.register('KSampler_k2_def', { type: 'image', url: '/b.png', hash: 'def' })
    expect(resolver.size).toBe(2)
    resolver.invalidate('k1')
    expect(resolver.size).toBe(1)
    // k1 should be gone
    const result = resolver.resolve('k1', 'KSampler', 'abc', 'loom')
    expect(result.fallbackLevel).toBe('aurora')
  })

  it('clear empties the entire cache', () => {
    resolver.register('a', { type: 'image', url: '/a.png', hash: 'a' })
    resolver.register('b', { type: 'image', url: '/b.png', hash: 'b' })
    expect(resolver.size).toBe(2)
    resolver.clear()
    expect(resolver.size).toBe(0)
  })

  it('has configurable base path', () => {
    const custom = new GlamourAssetResolver('/custom/path')
    expect(custom.getBasePath()).toBe('/custom/path')
  })

  it('default base path is /api/output/files/glamour-assets', () => {
    expect(resolver.getBasePath()).toBe('/api/output/files/glamour-assets')
  })
})
