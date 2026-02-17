import { describe, it, expect } from 'vitest'
import {
  weaveToSchema,
  calculateOverallScore,
  calculateOverallScoreFromMappings,
} from '../metaphor-engine.js'
import type {
  WeaveSchema,
  MetaphorManifest,
  MetaphorScores,
  MetaphorStability,
  MetaphorEngine,
  MetaphorAttributeScore,
  MetaphorMappingScore,
  InputOutputAnalysis,
  MetaphorDetailedScores,
} from '../metaphor-engine.js'
import { createWeave, mark, thread } from '#weaver/core'

describe('MetaphorEngine types', () => {
  describe('weaveToSchema', () => {
    it('extracts schema from an empty weave', () => {
      const weave = createWeave('test')
      const schema = weaveToSchema(weave)
      expect(schema.knots).toHaveLength(0)
      expect(schema.threads).toHaveLength(0)
      expect(schema.purpose).toBeUndefined()
    })

    it('extracts schema with purpose', () => {
      const weave = createWeave('test')
      const schema = weaveToSchema(weave, 'generates images from text')
      expect(schema.purpose).toBe('generates images from text')
    })

    it('extracts knots with type, label, and data keys', () => {
      let weave = createWeave('test')
      weave = mark(weave, {
        type: 'KSampler',
        label: 'Sampler',
        position: { x: 0, y: 0 },
        data: {
          comfyui_class_type: 'KSampler',
          inputs: { steps: 20, cfg: 7.5, seed: 42 },
        },
      })
      const schema = weaveToSchema(weave)
      expect(schema.knots).toHaveLength(1)
      expect(schema.knots[0].type).toBe('KSampler')
      expect(schema.knots[0].label).toBe('Sampler')
      expect(schema.knots[0].dataKeys).toContain('comfyui_class_type')
      expect(schema.knots[0].dataKeys).toContain('inputs')
    })

    it('extracts parameter names from nested inputs', () => {
      let weave = createWeave('test')
      weave = mark(weave, {
        type: 'KSampler',
        label: 'Sampler',
        position: { x: 0, y: 0 },
        data: {
          inputs: { steps: 20, cfg: 7.5, seed: 42, sampler_name: 'euler' },
        },
      })
      const schema = weaveToSchema(weave)
      expect(schema.knots[0].parameterNames).toContain('steps')
      expect(schema.knots[0].parameterNames).toContain('cfg')
      expect(schema.knots[0].parameterNames).toContain('seed')
      expect(schema.knots[0].parameterNames).toContain('sampler_name')
    })

    it('handles knots without inputs (no parameterNames)', () => {
      let weave = createWeave('test')
      weave = mark(weave, {
        type: 'SaveImage',
        label: 'Save',
        position: { x: 0, y: 0 },
        data: { comfyui_class_type: 'SaveImage' },
      })
      const schema = weaveToSchema(weave)
      expect(schema.knots[0].parameterNames).toEqual([])
    })

    it('extracts threads with source and target', () => {
      let weave = createWeave('test')
      weave = mark(weave, { type: 'A', label: 'A', position: { x: 0, y: 0 } })
      weave = mark(weave, { type: 'B', label: 'B', position: { x: 100, y: 0 } })
      const knots = Array.from(weave.knots.keys())
      weave = thread(weave, knots[0], knots[1])
      const schema = weaveToSchema(weave)
      expect(schema.threads).toHaveLength(1)
      expect(schema.threads[0].source).toBe(knots[0])
      expect(schema.threads[0].target).toBe(knots[1])
    })

    it('extracts thread data type', () => {
      let weave = createWeave('test')
      weave = mark(weave, { type: 'A', label: 'A', position: { x: 0, y: 0 } })
      weave = mark(weave, { type: 'B', label: 'B', position: { x: 100, y: 0 } })
      const knots = Array.from(weave.knots.keys())
      weave = thread(weave, knots[0], knots[1], {
        data: { type: 'MODEL' },
      })
      const schema = weaveToSchema(weave)
      expect(schema.threads[0].dataType).toBe('MODEL')
    })
  })

  describe('calculateOverallScore', () => {
    it('calculates weighted average correctly', () => {
      const scores = {
        explanatoryPower: 10,
        truthfulness: 10,
        completeness: 10,
        intuitiveInteraction: 10,
        fractalConsistency: 10,
      }
      // All 10s should give 10
      expect(calculateOverallScore(scores)).toBeCloseTo(10, 1)
    })

    it('applies correct weights', () => {
      // Only explanatoryPower at 10, rest at 0
      const scores = {
        explanatoryPower: 10,
        truthfulness: 0,
        completeness: 0,
        intuitiveInteraction: 0,
        fractalConsistency: 0,
      }
      // Weight is 0.3
      expect(calculateOverallScore(scores)).toBeCloseTo(3.0, 1)
    })

    it('weights explanatoryPower highest (0.30)', () => {
      const base = {
        explanatoryPower: 0,
        truthfulness: 0,
        completeness: 0,
        intuitiveInteraction: 0,
        fractalConsistency: 0,
      }
      // Each dimension at 10, rest 0
      const ep = calculateOverallScore({ ...base, explanatoryPower: 10 })
      const tr = calculateOverallScore({ ...base, truthfulness: 10 })
      const co = calculateOverallScore({ ...base, completeness: 10 })
      const ii = calculateOverallScore({ ...base, intuitiveInteraction: 10 })
      const fc = calculateOverallScore({ ...base, fractalConsistency: 10 })

      // explanatoryPower should contribute most
      expect(ep).toBeGreaterThan(tr)
      expect(tr).toBeGreaterThan(co)
      expect(co).toBeGreaterThan(ii)
      expect(ii).toBeGreaterThan(fc)
    })

    it('handles the Loom 3/10 scenario', () => {
      // Loom metaphor scores: mediocre across the board
      const loomScores = {
        explanatoryPower: 3,
        truthfulness: 3,
        completeness: 2,
        intuitiveInteraction: 3,
        fractalConsistency: 4,
      }
      const overall = calculateOverallScore(loomScores)
      // Should be around 2.9 (weighted avg of low scores)
      expect(overall).toBeLessThan(4)
      expect(overall).toBeGreaterThan(2)
    })

    it('gives zero for all-zero scores', () => {
      const scores = {
        explanatoryPower: 0,
        truthfulness: 0,
        completeness: 0,
        intuitiveInteraction: 0,
        fractalConsistency: 0,
      }
      expect(calculateOverallScore(scores)).toBe(0)
    })
  })

  describe('calculateOverallScoreFromMappings', () => {
    it('returns zeros for empty mappings', () => {
      const ioAnalysis: InputOutputAnalysis = {
        textInputHandling: 8,
        modelInputHandling: 9,
        intermediateHandling: 7,
        finalOutputHandling: 6,
        rationale: 'test',
      }
      const result = calculateOverallScoreFromMappings([], ioAnalysis)
      expect(result.explanatoryPower).toBe(0)
      expect(result.truthfulness).toBe(0)
    })

    it('compiles scores from single mapping with attributes', () => {
      const mappingScores: MetaphorMappingScore[] = [
        {
          knotType: 'KSampler',
          metaphorElement: 'Oven',
          elementFit: 8,
          attributeScores: [
            {
              parameterName: 'steps',
              metaphorControl: 'Bake Timer',
              explanatoryPower: 9,
              truthfulness: 7,
              intuitiveness: 8,
              rationale: 'Timer maps well to iteration count',
            },
            {
              parameterName: 'cfg',
              metaphorControl: 'Temperature Dial',
              explanatoryPower: 8,
              truthfulness: 8,
              intuitiveness: 9,
              rationale: 'Temperature = intensity of generation',
            },
          ],
          inputOutputFit: 7,
          overallMappingScore: 7.5,
          rationale: 'Oven works well for core generation',
        },
      ]
      const ioAnalysis: InputOutputAnalysis = {
        textInputHandling: 8,
        modelInputHandling: 9,
        intermediateHandling: 7,
        finalOutputHandling: 6,
        rationale: 'Text as recipe cards, model as recipe book',
      }
      const result = calculateOverallScoreFromMappings(mappingScores, ioAnalysis)

      // All scores should be reasonable non-zero values
      expect(result.explanatoryPower).toBeGreaterThan(4)
      expect(result.truthfulness).toBeGreaterThan(4)
      expect(result.intuitiveInteraction).toBeGreaterThan(4)
      expect(result.fractalConsistency).toBeGreaterThan(4)
    })

    it('handles mapping without attribute scores', () => {
      const mappingScores: MetaphorMappingScore[] = [
        {
          knotType: 'SaveImage',
          metaphorElement: 'Plate',
          elementFit: 5,
          attributeScores: [],
          inputOutputFit: 6,
          overallMappingScore: 5.5,
          rationale: 'Plate is okay for output',
        },
      ]
      const ioAnalysis: InputOutputAnalysis = {
        textInputHandling: 7,
        modelInputHandling: 8,
        intermediateHandling: 6,
        finalOutputHandling: 5,
        rationale: 'Food output, not image output',
      }
      const result = calculateOverallScoreFromMappings(mappingScores, ioAnalysis)
      // Should still produce scores using element fit as proxy
      expect(result.explanatoryPower).toBeGreaterThan(0)
      expect(result.intuitiveInteraction).toBe(5) // uses element fit as proxy
    })

    it('fractal consistency rewards uniform element fits', () => {
      const uniformMappings: MetaphorMappingScore[] = [
        { knotType: 'A', metaphorElement: 'X', elementFit: 7, attributeScores: [], inputOutputFit: 7, overallMappingScore: 7, rationale: '' },
        { knotType: 'B', metaphorElement: 'Y', elementFit: 7, attributeScores: [], inputOutputFit: 7, overallMappingScore: 7, rationale: '' },
        { knotType: 'C', metaphorElement: 'Z', elementFit: 7, attributeScores: [], inputOutputFit: 7, overallMappingScore: 7, rationale: '' },
      ]
      const variedMappings: MetaphorMappingScore[] = [
        { knotType: 'A', metaphorElement: 'X', elementFit: 10, attributeScores: [], inputOutputFit: 7, overallMappingScore: 9, rationale: '' },
        { knotType: 'B', metaphorElement: 'Y', elementFit: 2, attributeScores: [], inputOutputFit: 7, overallMappingScore: 4, rationale: '' },
        { knotType: 'C', metaphorElement: 'Z', elementFit: 9, attributeScores: [], inputOutputFit: 7, overallMappingScore: 8, rationale: '' },
      ]
      const io: InputOutputAnalysis = { textInputHandling: 7, modelInputHandling: 7, intermediateHandling: 7, finalOutputHandling: 7, rationale: '' }

      const uniform = calculateOverallScoreFromMappings(uniformMappings, io)
      const varied = calculateOverallScoreFromMappings(variedMappings, io)

      // Uniform element fits should yield higher fractal consistency
      expect(uniform.fractalConsistency).toBeGreaterThan(varied.fractalConsistency)
    })
  })

  describe('type contracts', () => {
    it('WeaveSchema has correct shape', () => {
      const schema: WeaveSchema = {
        knots: [
          { id: 'k1', type: 'KSampler', label: 'Sampler', dataKeys: ['inputs'], parameterNames: ['steps'] },
        ],
        threads: [
          { source: 'k1', target: 'k2', dataType: 'MODEL' },
        ],
        purpose: 'image generation',
        context: {
          audience: 'non-technical',
          sessionType: 'solo',
          mood: 'creative',
          domain: 'art',
        },
      }
      expect(schema.knots).toHaveLength(1)
      expect(schema.context?.audience).toBe('non-technical')
    })

    it('MetaphorStability modes are typed correctly', () => {
      const locked: MetaphorStability = { mode: 'locked' }
      const guided: MetaphorStability = { mode: 'guided', minScoreThreshold: 5 }
      const adaptive: MetaphorStability = {
        mode: 'adaptive',
        minScoreThreshold: 4,
        lockedMappings: new Set(['KSampler']),
        changeRate: 'experimental',
      }
      expect(locked.mode).toBe('locked')
      expect(guided.minScoreThreshold).toBe(5)
      expect(adaptive.lockedMappings?.has('KSampler')).toBe(true)
      expect(adaptive.changeRate).toBe('experimental')
    })

    it('MetaphorEngine interface requires propose, refine, reevaluate', () => {
      // Type-level test: a mock engine must implement all three methods
      const mockEngine: MetaphorEngine = {
        propose: async () => [],
        refine: async (current) => current,
        reevaluate: async () => ({
          explanatoryPower: 5,
          truthfulness: 5,
          completeness: 5,
          intuitiveInteraction: 5,
          fractalConsistency: 5,
          overall: 5,
          rationale: 'test',
        }),
      }
      expect(mockEngine.propose).toBeDefined()
      expect(mockEngine.refine).toBeDefined()
      expect(mockEngine.reevaluate).toBeDefined()
    })

    it('MetaphorManifest has all required fields', () => {
      const manifest: MetaphorManifest = {
        id: 'kitchen-1',
        name: 'Kitchen',
        mappings: [
          {
            knotType: 'KSampler',
            metaphorElement: 'Oven',
            label: 'The Oven',
            description: 'Samples = baking',
            facadeControls: [
              {
                id: 'temperature',
                controlType: 'slider',
                label: 'Temperature',
                rationale: 'CFG maps to heat level',
                position: { x: 0.5, y: 0.8 },
                binding: { dataPath: 'inputs.cfg', min: 1, max: 20, step: 0.5 },
              },
            ],
            assetPrompt: 'A warm kitchen oven icon',
            size: { width: 200, height: 160 },
          },
        ],
        threadStyle: {
          colorBy: 'dataType',
          metaphor: 'ingredients flowing',
          colorMap: {
            MODEL: { color: '#8B4513', width: 3, style: 'solid' },
          },
        },
        waveMetaphor: 'dish being passed along',
        sceneDescription: 'a restaurant kitchen',
        sceneConfig: {
          background: '#2a1a0a',
          layoutMode: 'horizontal',
          spacing: { x: 300, y: 200 },
        },
        aiVocabulary: 'Talk about cooking and recipes',
        scores: {
          explanatoryPower: 7,
          truthfulness: 8,
          completeness: 6,
          intuitiveInteraction: 7,
          fractalConsistency: 5,
          overall: 6.85,
          rationale: 'Kitchen metaphor works well for most concepts',
        },
      }
      expect(manifest.name).toBe('Kitchen')
      expect(manifest.mappings[0].facadeControls).toHaveLength(1)
      expect(manifest.scores.overall).toBeCloseTo(6.85, 1)
    })

    it('MetaphorAttributeScore has correct shape', () => {
      const attrScore: MetaphorAttributeScore = {
        parameterName: 'steps',
        metaphorControl: 'Bake Timer',
        explanatoryPower: 8,
        truthfulness: 7,
        intuitiveness: 9,
        rationale: 'Timer maps to iteration count naturally',
      }
      expect(attrScore.parameterName).toBe('steps')
      expect(attrScore.explanatoryPower).toBeGreaterThan(0)
      expect(attrScore.truthfulness).toBeGreaterThan(0)
      expect(attrScore.intuitiveness).toBeGreaterThan(0)
    })

    it('MetaphorMappingScore has correct shape', () => {
      const mappingScore: MetaphorMappingScore = {
        knotType: 'KSampler',
        metaphorElement: 'Oven',
        elementFit: 8,
        attributeScores: [
          {
            parameterName: 'cfg',
            metaphorControl: 'Temperature',
            explanatoryPower: 9,
            truthfulness: 8,
            intuitiveness: 9,
            rationale: 'Higher temp = more creative',
          },
        ],
        inputOutputFit: 7,
        overallMappingScore: 7.8,
        rationale: 'Oven works well for the core sampling step',
      }
      expect(mappingScore.knotType).toBe('KSampler')
      expect(mappingScore.attributeScores).toHaveLength(1)
      expect(mappingScore.overallMappingScore).toBeGreaterThan(0)
    })

    it('InputOutputAnalysis has correct shape', () => {
      const ioAnalysis: InputOutputAnalysis = {
        textInputHandling: 8,
        modelInputHandling: 9,
        intermediateHandling: 7,
        finalOutputHandling: 6,
        rationale: 'Text as recipe, model as cookbook, output as plated dish (not quite an image)',
      }
      expect(ioAnalysis.textInputHandling).toBeGreaterThan(0)
      expect(ioAnalysis.finalOutputHandling).toBeGreaterThan(0)
      expect(ioAnalysis.rationale.length).toBeGreaterThan(0)
    })

    it('MetaphorDetailedScores extends MetaphorScores', () => {
      const detailed: MetaphorDetailedScores = {
        explanatoryPower: 7,
        truthfulness: 8,
        completeness: 6,
        intuitiveInteraction: 7,
        fractalConsistency: 5,
        overall: 6.85,
        rationale: 'Good kitchen metaphor',
        mappingScores: [
          {
            knotType: 'KSampler',
            metaphorElement: 'Oven',
            elementFit: 8,
            attributeScores: [],
            inputOutputFit: 7,
            overallMappingScore: 7.5,
            rationale: '',
          },
        ],
        ioAnalysis: {
          textInputHandling: 8,
          modelInputHandling: 9,
          intermediateHandling: 7,
          finalOutputHandling: 6,
          rationale: 'Solid overall',
        },
      }
      // Has both MetaphorScores fields and granular fields
      expect(detailed.explanatoryPower).toBe(7)
      expect(detailed.mappingScores).toHaveLength(1)
      expect(detailed.ioAnalysis.textInputHandling).toBe(8)
    })
  })
})
