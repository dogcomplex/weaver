/**
 * Loom Theme Tests
 *
 * Verifies the Loom glamour theme correctly enchants knots, threads,
 * and waves according to the weaving lexicon mappings.
 */

import { describe, it, expect } from 'vitest'
import { LoomTheme } from '../themes/loom/index.js'
import type { Knot, Thread, Weave, KnotId } from '#weaver/core'
import type { Wave } from '#weaver/runtime'
import type { EnchantContext } from '../types.js'

// ─── Helpers ────────────────────────────────────────────────────

function makeKnot(id: string, type: string, data: Record<string, unknown> = {}): Knot {
  return {
    id,
    label: `${type} Knot`,
    type,
    position: { x: 100, y: 100 },
    data,
  }
}

function makeThread(id: string, source: string, target: string, data: Record<string, unknown> = {}): Thread {
  return {
    id,
    source,
    target,
    data,
  }
}

function makeWeave(knots: Knot[], threads: Thread[] = []): Weave {
  return {
    id: 'test-weave',
    name: 'Test Weave',
    knots: new Map(knots.map(k => [k.id, k])),
    threads: new Map(threads.map(t => [t.id, t])),
    strands: new Map(),
    thresholds: [],
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1,
    },
  }
}

function makeContext(weave?: Weave, unveiledKnots?: Set<KnotId>): EnchantContext {
  const w = weave ?? makeWeave([])
  return {
    weave: w,
    theme: LoomTheme,
    zoom: 1,
    unveiledKnots: unveiledKnots ?? new Set(),
  }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('LoomTheme', () => {
  describe('metadata', () => {
    it('has correct id and name', () => {
      expect(LoomTheme.id).toBe('loom')
      expect(LoomTheme.name).toBe('The Loom')
      expect(LoomTheme.description).toBeTruthy()
    })

    it('has horizontal layout mode', () => {
      expect(LoomTheme.sceneConfig.layoutMode).toBe('horizontal')
      expect(LoomTheme.sceneConfig.spacing.x).toBe(300)
      expect(LoomTheme.sceneConfig.spacing.y).toBe(200)
    })

    it('has dark background', () => {
      expect(LoomTheme.sceneConfig.background).toBe('#0a0a0a')
    })

    it('has an AI system prompt', () => {
      expect(LoomTheme.aiSystemPrompt).toBeTruthy()
      expect(LoomTheme.aiSystemPrompt).toContain('loom')
    })
  })

  describe('enchantKnot', () => {
    it('maps CheckpointLoaderSimple to spindle', () => {
      const knot = makeKnot('k1', 'CheckpointLoaderSimple')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Spindle')
      expect(element.visual.type).toBe('svg')
      if (element.visual.type === 'svg') {
        expect(element.visual.path).toContain('spindle')
      }
      expect(element.veils).toEqual(['k1'])
    })

    it('maps CLIPTextEncode to dye vat', () => {
      const knot = makeKnot('k2', 'CLIPTextEncode')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Dye Vat')
      if (element.visual.type === 'svg') {
        expect(element.visual.path).toContain('dye-vat')
      }
    })

    it('maps KSampler to heddle frame', () => {
      const knot = makeKnot('k3', 'KSampler')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Heddle Frame')
      if (element.visual.type === 'svg') {
        expect(element.visual.path).toContain('heddle-frame')
      }
    })

    it('maps VAEDecode to winding frame', () => {
      const knot = makeKnot('k4', 'VAEDecode')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Winding Frame')
    })

    it('maps SaveImage to cloth beam', () => {
      const knot = makeKnot('k5', 'SaveImage')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Cloth Beam')
    })

    it('maps EmptyLatentImage to fiber bundle', () => {
      const knot = makeKnot('k6', 'EmptyLatentImage')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Fiber Bundle')
    })

    it('maps unknown types to tied knot', () => {
      const knot = makeKnot('k7', 'SomeCustomNode')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.label).toBe('Tied Knot')
      if (element.visual.type === 'svg') {
        expect(element.visual.path).toContain('tied-knot')
      }
    })

    it('returns color visual when knot is unveiled', () => {
      const knot = makeKnot('k1', 'KSampler')
      const unveiled = new Set<KnotId>(['k1'])
      const element = LoomTheme.enchantKnot(knot, makeContext(undefined, unveiled))
      expect(element.visual.type).toBe('color')
      expect(element.label).toContain('[KSampler]')
    })

    it('preserves knot position in element', () => {
      const knot = makeKnot('k1', 'default')
      knot.position = { x: 42, y: 99 }
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.position).toEqual({ x: 42, y: 99 })
    })
  })

  describe('enchantKnot facades', () => {
    it('provides text control for CLIPTextEncode', () => {
      const knot = makeKnot('k1', 'CLIPTextEncode')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.facade).toBeTruthy()
      expect(element.facade!.controls).toHaveLength(1)
      expect(element.facade!.controls[0].controlType).toBe('text')
      expect(element.facade!.controls[0].binding.dataPath).toBe('inputs.text')
    })

    it('provides slider controls for KSampler', () => {
      const knot = makeKnot('k1', 'KSampler')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.facade).toBeTruthy()
      expect(element.facade!.controls).toHaveLength(2)

      const stepsControl = element.facade!.controls.find(c => c.id === 'steps-slider')
      expect(stepsControl).toBeTruthy()
      expect(stepsControl!.controlType).toBe('slider')
      expect(stepsControl!.binding.min).toBe(1)
      expect(stepsControl!.binding.max).toBe(100)

      const cfgControl = element.facade!.controls.find(c => c.id === 'cfg-slider')
      expect(cfgControl).toBeTruthy()
      expect(cfgControl!.binding.min).toBe(1)
      expect(cfgControl!.binding.max).toBe(30)
    })

    it('provides dimension sliders for EmptyLatentImage', () => {
      const knot = makeKnot('k1', 'EmptyLatentImage')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.facade).toBeTruthy()
      expect(element.facade!.controls).toHaveLength(2)
      expect(element.facade!.controls[0].binding.dataPath).toBe('inputs.width')
      expect(element.facade!.controls[1].binding.dataPath).toBe('inputs.height')
    })

    it('returns null facade for types without controls', () => {
      const knot = makeKnot('k1', 'VAEDecode')
      const element = LoomTheme.enchantKnot(knot, makeContext())
      expect(element.facade).toBeNull()
    })
  })

  describe('enchantThread', () => {
    it('returns thick dark thread for MODEL data type', () => {
      const source = makeKnot('k1', 'CheckpointLoaderSimple')
      const target = makeKnot('k2', 'KSampler')
      const thread = makeThread('t1', 'k1', 'k2')
      const conn = LoomTheme.enchantThread(thread, source, target, makeContext())
      expect(conn.threadId).toBe('t1')
      expect(conn.visual.color).toBe('#6a9a6a')
      expect(conn.visual.width).toBe(4)
    })

    it('returns shimmering animated thread for LATENT', () => {
      const source = makeKnot('k1', 'KSampler')
      const target = makeKnot('k2', 'VAEDecode')
      const thread = makeThread('t1', 'k1', 'k2')
      const conn = LoomTheme.enchantThread(thread, source, target, makeContext())
      expect(conn.visual.color).toBe('#aa9a5a')
      expect(conn.visual.style).toBe('animated')
    })

    it('returns bright thread for IMAGE', () => {
      const source = makeKnot('k1', 'VAEDecode')
      const target = makeKnot('k2', 'SaveImage')
      const thread = makeThread('t1', 'k1', 'k2')
      const conn = LoomTheme.enchantThread(thread, source, target, makeContext())
      expect(conn.visual.color).toBe('#5a9aaa')
    })

    it('uses explicit data type from thread data', () => {
      const source = makeKnot('k1', 'CheckpointLoaderSimple')
      const target = makeKnot('k2', 'CLIPTextEncode')
      const thread = makeThread('t1', 'k1', 'k2', { type: 'CLIP' })
      const conn = LoomTheme.enchantThread(thread, source, target, makeContext())
      expect(conn.visual.color).toBe('#9a6a9a')
    })
  })

  describe('enchantWave', () => {
    it('returns valid animation with keyframes', () => {
      const knot = makeKnot('k1', 'KSampler')
      const wave: Wave = { id: 'w1', payload: {}, path: ['k1'], status: 'flowing' }
      const anim = LoomTheme.enchantWave(wave, knot, makeContext())
      expect(anim.duration).toBe(300)
      expect(anim.keyframes.length).toBeGreaterThan(0)
      expect(anim.loop).toBe(false)
    })
  })

  describe('canMerge', () => {
    it('returns false in Phase 3', () => {
      expect(LoomTheme.canMerge(['k1', 'k2'], makeContext())).toBe(false)
    })
  })

  describe('enchantSubgraph', () => {
    it('throws in Phase 3', () => {
      expect(() => LoomTheme.enchantSubgraph(['k1'], makeContext())).toThrow()
    })
  })

  describe('describeWeave', () => {
    it('describes empty weave', () => {
      const weave = makeWeave([])
      const desc = LoomTheme.describeWeave(weave)
      expect(desc).toContain('empty loom')
    })

    it('describes populated weave with counts', () => {
      const knots = [makeKnot('k1', 'KSampler'), makeKnot('k2', 'SaveImage')]
      const threads = [makeThread('t1', 'k1', 'k2')]
      const weave = makeWeave(knots, threads)
      const desc = LoomTheme.describeWeave(weave)
      expect(desc).toContain('2')
      expect(desc).toContain('1')
      expect(desc).toContain('tapestry')
    })
  })

  describe('describeKnot', () => {
    it('returns loom-themed description for each type', () => {
      const weave = makeWeave([])
      const types = ['CheckpointLoaderSimple', 'CLIPTextEncode', 'KSampler', 'VAEDecode', 'SaveImage', 'EmptyLatentImage', 'default']
      for (const type of types) {
        const knot = makeKnot('k1', type)
        const desc = LoomTheme.describeKnot(knot, weave)
        expect(desc).toBeTruthy()
        expect(desc.length).toBeGreaterThan(10)
      }
    })
  })
})
