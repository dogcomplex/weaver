import { describe, it, expect } from 'vitest'
import { ManifestTheme, buildKnotIdMap } from '../themes/manifest/index.js'
import { GlamourAssetResolver, hashKnotConfig } from '../asset-resolver.js'
import type { MetaphorManifest } from '../metaphor-engine.js'
import type { Knot, Weave, Thread, KnotId, ThreadId, Position } from '#weaver/core'
import type { EnchantContext, GlamourTheme } from '../types.js'

// ─── Test Fixtures ──────────────────────────────────────────────

function makeKnot(overrides: Partial<Knot> & { id: string; type: string }): Knot {
  return {
    label: overrides.type,
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  } as Knot
}

function makeThread(id: string, source: string, target: string, data?: Record<string, unknown>): Thread {
  return { id, source, target, label: '', data: data ?? {} } as Thread
}

function makeWeave(knots: Knot[], threads: Thread[] = []): Weave {
  const knotMap = new Map<KnotId, Knot>()
  const threadMap = new Map<ThreadId, Thread>()
  for (const k of knots) knotMap.set(k.id, k)
  for (const t of threads) threadMap.set(t.id, t)
  return {
    id: 'test-weave',
    name: 'Test Weave',
    knots: knotMap,
    threads: threadMap,
  } as Weave
}

const testManifest: MetaphorManifest = {
  id: 'kitchen-01',
  name: 'Kitchen',
  mappings: [
    {
      knotType: 'CheckpointLoaderSimple',
      metaphorElement: 'Pantry',
      label: 'Pantry',
      description: 'The pantry stores your ingredients (model weights).',
      facadeControls: [],
      assetPrompt: 'A wooden pantry cabinet, icon style',
      size: { width: 100, height: 120 },
    },
    {
      knotType: 'CLIPTextEncode',
      metaphorElement: 'Recipe Card',
      label: 'Recipe Card',
      description: 'The recipe card holds your instructions (text prompt).',
      facadeControls: [
        {
          id: 'recipe-text',
          controlType: 'text',
          label: 'Recipe',
          rationale: 'Text input matches the prompt parameter naturally',
          position: { x: 0.5, y: 0.85 },
          binding: { dataPath: 'inputs.text' },
        },
      ],
      size: { width: 100, height: 100 },
    },
    {
      knotType: 'KSampler',
      metaphorElement: 'Oven',
      label: 'Oven',
      description: 'The oven combines ingredients with heat and time.',
      facadeControls: [
        {
          id: 'temperature',
          controlType: 'slider',
          label: 'Temperature',
          rationale: 'CFG maps to temperature — higher = more guidance',
          position: { x: 0.3, y: 0.9 },
          binding: { dataPath: 'inputs.cfg', min: 1, max: 30, step: 0.5 },
        },
        {
          id: 'timer',
          controlType: 'slider',
          label: 'Timer',
          rationale: 'Steps map to baking time — more time = more refined',
          position: { x: 0.7, y: 0.9 },
          binding: { dataPath: 'inputs.steps', min: 1, max: 100, step: 1 },
        },
      ],
      assetPrompt: 'A warm kitchen oven icon',
      svgFallback: '/glamour/kitchen/oven.svg',
      size: { width: 120, height: 100 },
    },
    {
      knotType: 'SaveImage',
      metaphorElement: 'Serving Plate',
      label: 'Serving Plate',
      description: 'The serving plate presents the finished dish (output image).',
      facadeControls: [],
      size: { width: 100, height: 100 },
    },
  ],
  threadStyle: {
    colorBy: 'dataType',
    metaphor: 'ingredients flowing between stations',
    colorMap: {
      MODEL: { color: '#8B4513', width: 4, style: 'solid' },
      CONDITIONING: { color: '#DAA520', width: 2.5, style: 'solid' },
      LATENT: { color: '#CD853F', width: 3, style: 'animated' },
      IMAGE: { color: '#FF6347', width: 3.5, style: 'solid' },
      '*': { color: '#808080', width: 2, style: 'solid' },
    },
  },
  waveMetaphor: 'A serving tray carrying dishes between stations',
  sceneDescription: 'A restaurant kitchen viewed from above',
  sceneConfig: {
    background: '#2a1a0a',
    layoutMode: 'horizontal',
    spacing: { x: 300, y: 200 },
  },
  aiVocabulary: 'Use kitchen terminology: pantry, recipe cards, oven, serving plates.',
  scores: {
    explanatoryPower: 8,
    truthfulness: 7,
    completeness: 8,
    intuitiveInteraction: 9,
    fractalConsistency: 7,
    overall: 7.8,
    rationale: 'Kitchen metaphor works well for image generation pipeline.',
  },
}

function makeContext(theme: GlamourTheme, weave: Weave): EnchantContext {
  return {
    weave,
    theme,
    zoom: 1,
    unveiledKnots: new Set(),
  }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('ManifestTheme — Construction', () => {
  it('sets id, name, description from manifest', () => {
    const theme = new ManifestTheme(testManifest, new Map())
    expect(theme.id).toBe('manifest-kitchen-01')
    expect(theme.name).toBe('Kitchen')
    expect(theme.description).toBe('A restaurant kitchen viewed from above')
  })

  it('normalizes layoutMode freeform → free', () => {
    const freeformManifest = {
      ...testManifest,
      sceneConfig: { ...testManifest.sceneConfig, layoutMode: 'freeform' as const },
    }
    const theme = new ManifestTheme(freeformManifest, new Map())
    expect(theme.sceneConfig.layoutMode).toBe('free')
  })

  it('keeps horizontal/vertical/radial layoutMode unchanged', () => {
    const theme = new ManifestTheme(testManifest, new Map())
    expect(theme.sceneConfig.layoutMode).toBe('horizontal')
  })

  it('sets aiSystemPrompt from manifest vocabulary', () => {
    const theme = new ManifestTheme(testManifest, new Map())
    expect(theme.aiSystemPrompt).toContain('kitchen')
  })
})

describe('ManifestTheme — enchantKnot', () => {
  it('returns mapped element for known knot type', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map([['KSampler', 'k1']]))
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.label).toBe('Oven')
    expect(element.size.width).toBe(120)
    expect(element.size.height).toBe(100)
    expect(element.veils).toContain('k1')
  })

  it('returns color fallback for knot type without asset', () => {
    const knot = makeKnot({ id: 'k1', type: 'SaveImage' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.visual.type).toBe('color')
    expect(element.label).toBe('Serving Plate')
  })

  it('returns generated visual for knot type with assetPrompt', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map([['KSampler', 'k1']]))
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.visual.type).toBe('generated')
    if (element.visual.type === 'generated') {
      expect(element.visual.prompt).toContain('oven')
      // Fallback should be svg since svgFallback is defined
      expect(element.visual.fallback.type).toBe('svg')
    }
  })

  it('returns generated visual with color fallback when no svg', () => {
    const knot = makeKnot({ id: 'k1', type: 'CheckpointLoaderSimple' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.visual.type).toBe('generated')
    if (element.visual.type === 'generated') {
      expect(element.visual.fallback.type).toBe('color')
    }
  })

  it('returns sprite visual when asset resolver has cached image', () => {
    const resolver = new GlamourAssetResolver()
    const knot = makeKnot({ id: 'k1', type: 'KSampler', data: {} })
    const weave = makeWeave([knot])

    // Register an asset with the exact key format
    const hash = hashKnotConfig(knot)
    resolver.register(`KSampler_k1_${hash}`, {
      type: 'image',
      url: '/api/output/glamour-assets/abc123.png',
      hash: 'abc123',
    })

    const theme = new ManifestTheme(testManifest, new Map([['KSampler', 'k1']]), resolver)
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.visual.type).toBe('sprite')
    if (element.visual.type === 'sprite') {
      expect(element.visual.url).toContain('abc123')
    }
  })

  it('returns default element for unknown knot type', () => {
    const knot = makeKnot({ id: 'k1', type: 'CustomNode' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.visual.type).toBe('color')
    expect(element.label).toBe('CustomNode')
  })

  it('returns unveiled element when knot is unveiled', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler', label: 'My Sampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx: EnchantContext = {
      ...makeContext(theme, weave),
      unveiledKnots: new Set(['k1']),
    }
    const element = theme.enchantKnot(knot, ctx)

    expect(element.facade).toBeNull()
    expect(element.label).toContain('[KSampler]')
    expect(element.depth).toBe(1)
  })
})

describe('ManifestTheme — Facade Controls', () => {
  it('builds facade controls with knotId binding injection', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map([['KSampler', 'k1']]))
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.facade).not.toBeNull()
    expect(element.facade!.controls).toHaveLength(2)
    expect(element.facade!.controls[0].binding.knotId).toBe('k1')
    expect(element.facade!.controls[0].label).toBe('Temperature')
    expect(element.facade!.controls[1].label).toBe('Timer')
  })

  it('returns null facade when no controls defined', () => {
    const knot = makeKnot({ id: 'k1', type: 'SaveImage' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    expect(element.facade).toBeNull()
  })

  it('preserves control binding constraints', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map([['KSampler', 'k1']]))
    const ctx = makeContext(theme, weave)
    const element = theme.enchantKnot(knot, ctx)

    const tempControl = element.facade!.controls.find(c => c.id === 'temperature')!
    expect(tempControl.binding.min).toBe(1)
    expect(tempControl.binding.max).toBe(30)
    expect(tempControl.binding.step).toBe(0.5)
    expect(tempControl.binding.dataPath).toBe('inputs.cfg')
  })
})

describe('ManifestTheme — enchantThread', () => {
  it('uses manifest threadStyle colorMap for known data type', () => {
    const source = makeKnot({ id: 'k1', type: 'CheckpointLoaderSimple' })
    const target = makeKnot({ id: 'k2', type: 'KSampler' })
    const thread = makeThread('t1', 'k1', 'k2')
    const weave = makeWeave([source, target], [thread])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const conn = theme.enchantThread(thread, source, target, ctx)

    // CheckpointLoaderSimple → MODEL
    expect(conn.visual.color).toBe('#8B4513')
    expect(conn.visual.width).toBe(4)
    expect(conn.visual.style).toBe('solid')
  })

  it('uses wildcard style for unknown data type', () => {
    const source = makeKnot({ id: 'k1', type: 'CustomNode' })
    const target = makeKnot({ id: 'k2', type: 'CustomNode2' })
    const thread = makeThread('t1', 'k1', 'k2')
    const weave = makeWeave([source, target], [thread])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const conn = theme.enchantThread(thread, source, target, ctx)

    expect(conn.visual.color).toBe('#808080')
  })

  it('uses explicit thread data type when available', () => {
    const source = makeKnot({ id: 'k1', type: 'CustomNode' })
    const target = makeKnot({ id: 'k2', type: 'CustomNode2' })
    const thread = makeThread('t1', 'k1', 'k2', { type: 'IMAGE' })
    const weave = makeWeave([source, target], [thread])
    const theme = new ManifestTheme(testManifest, new Map())
    const ctx = makeContext(theme, weave)
    const conn = theme.enchantThread(thread, source, target, ctx)

    expect(conn.visual.color).toBe('#FF6347')
    expect(conn.visual.style).toBe('solid')
  })
})

describe('ManifestTheme — describeWeave / describeKnot', () => {
  it('describeWeave uses scene description', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const desc = theme.describeWeave(weave)

    expect(desc).toContain('restaurant kitchen')
    expect(desc).toContain('1 element')
  })

  it('describeWeave for empty weave', () => {
    const weave = makeWeave([])
    const theme = new ManifestTheme(testManifest, new Map())
    const desc = theme.describeWeave(weave)

    expect(desc).toContain('empty')
  })

  it('describeKnot uses mapping description', () => {
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const desc = theme.describeKnot(knot, weave)

    expect(desc).toContain('oven')
  })

  it('describeKnot falls back for unknown type', () => {
    const knot = makeKnot({ id: 'k1', type: 'CustomNode', label: 'My Custom' })
    const weave = makeWeave([knot])
    const theme = new ManifestTheme(testManifest, new Map())
    const desc = theme.describeKnot(knot, weave)

    expect(desc).toContain('My Custom')
    expect(desc).toContain('CustomNode')
  })
})

describe('ManifestTheme — canMerge / enchantSubgraph', () => {
  it('canMerge returns false', () => {
    const theme = new ManifestTheme(testManifest, new Map())
    const weave = makeWeave([])
    const ctx = makeContext(theme, weave)
    expect(theme.canMerge([], ctx)).toBe(false)
  })

  it('enchantSubgraph throws', () => {
    const theme = new ManifestTheme(testManifest, new Map())
    const weave = makeWeave([])
    const ctx = makeContext(theme, weave)
    expect(() => theme.enchantSubgraph([], ctx)).toThrow('No matching merge group')
  })
})

describe('ManifestTheme — enchantWave', () => {
  it('returns a valid animation', () => {
    const theme = new ManifestTheme(testManifest, new Map())
    const knot = makeKnot({ id: 'k1', type: 'KSampler' })
    const weave = makeWeave([knot])
    const ctx = makeContext(theme, weave)
    const anim = theme.enchantWave({} as any, knot, ctx)

    expect(anim.duration).toBeGreaterThan(0)
    expect(anim.keyframes.length).toBeGreaterThan(0)
    expect(anim.loop).toBe(false)
  })
})

describe('buildKnotIdMap', () => {
  it('maps knot types to first knot ID', () => {
    const k1 = makeKnot({ id: 'k1', type: 'KSampler' })
    const k2 = makeKnot({ id: 'k2', type: 'CLIPTextEncode' })
    const k3 = makeKnot({ id: 'k3', type: 'KSampler' })
    const weave = makeWeave([k1, k2, k3])

    const map = buildKnotIdMap(weave)
    expect(map.get('KSampler')).toBe('k1')  // First KSampler
    expect(map.get('CLIPTextEncode')).toBe('k2')
    expect(map.size).toBe(2)
  })

  it('returns empty map for empty weave', () => {
    const weave = makeWeave([])
    const map = buildKnotIdMap(weave)
    expect(map.size).toBe(0)
  })
})
