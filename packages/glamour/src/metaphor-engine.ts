/**
 * Metaphor Engine — The Loci's brain.
 *
 * Separates metaphor finding/scoring from workflow building.
 * This is text-in → structured-JSON-out: a Haiku-class model
 * can run it cheaply and continuously, while Sonnet/Opus handles
 * complex workflow building (the Weaver).
 *
 * Two AI roles in the Weaver system:
 *   - The Weaver: builds functional workflows (tool-calling, code-level)
 *   - The Loci: inhabits the space, adjusts glamours (text-gen, ambient)
 *
 * The MetaphorManifest output is consumed by GlamourRenderer to create
 * runtime themes — no rendering dependencies in this module.
 */

import type { FacadeControlType, FacadeBinding } from './types.js'

// ─── Input: What does this workflow look like structurally? ──────

/** Structural summary of a weave, stripped of rendering concerns */
export interface WeaveSchema {
  /** All knots with their types and data keys */
  knots: WeaveSchemaKnot[]
  /** All threads with source/target and data type */
  threads: WeaveSchemaThread[]
  /** User-described intent: "generates images from text" */
  purpose?: string
  /** Additional context: session type, audience, mood */
  context?: MetaphorContext
}

export interface WeaveSchemaKnot {
  id: string
  type: string
  label: string
  /** Top-level data keys (e.g. ['comfyui_class_type', 'inputs']) */
  dataKeys: string[]
  /** Nested parameter names from inputs (e.g. ['steps', 'cfg', 'seed']) */
  parameterNames?: string[]
}

export interface WeaveSchemaThread {
  source: string
  target: string
  dataType?: string
  label?: string
}

/** Optional context that helps the Loci pick better metaphors */
export interface MetaphorContext {
  /** Who is looking at this? */
  audience?: 'developer' | 'designer' | 'non-technical' | 'mixed'
  /** What kind of session is this? */
  sessionType?: 'solo' | 'pair' | 'group' | 'presentation' | 'game'
  /** General mood or tone */
  mood?: string
  /** Domain hints */
  domain?: string
}

// ─── Output: A complete theme manifest ──────────────────────────

/** Complete metaphor specification that GlamourRenderer can consume */
export interface MetaphorManifest {
  /** Unique ID for this manifest (generated) */
  id: string
  /** Human-readable name: "Kitchen", "Photography Studio", "Painting" */
  name: string
  /** Per-knot-type metaphor mappings */
  mappings: MetaphorMapping[]
  /** How threads should be styled */
  threadStyle: MetaphorThreadStyle
  /** How waves (data tokens) appear in this metaphor */
  waveMetaphor: string
  /** Scene-level description: "a restaurant kitchen viewed from above" */
  sceneDescription: string
  /** Scene config matching GlamourTheme.sceneConfig */
  sceneConfig: {
    background: string
    layoutMode: 'horizontal' | 'vertical' | 'radial' | 'freeform'
    spacing: { x: number; y: number }
  }
  /** AI system prompt fragment for this metaphor */
  aiVocabulary: string
  /** Quality scores */
  scores: MetaphorScores
}

/** Maps a knot type to a metaphorical element */
export interface MetaphorMapping {
  /** Which knot type this mapping applies to (e.g. 'KSampler') */
  knotType: string
  /** The metaphorical element name: "Oven", "Camera", "Brush" */
  metaphorElement: string
  /** Display label */
  label: string
  /** Why this mapping works (for AI self-documentation) */
  description: string
  /** Facade controls for this element */
  facadeControls: MetaphorFacadeControl[]
  /** Prompt for ComfyUI asset generation (if visual should be AI-generated) */
  assetPrompt?: string
  /** SVG fallback path (relative to theme assets) */
  svgFallback?: string
  /** Display size */
  size: { width: number; height: number }
}

/** Facade control definition within a metaphor (simplified from FacadeControl for manifest portability) */
export interface MetaphorFacadeControl {
  id: string
  controlType: FacadeControlType
  label: string
  /** Why this control type was chosen for this parameter */
  rationale: string
  /** Position relative to element (0-1 normalized) */
  position: { x: number; y: number }
  /** Binding to knot data */
  binding: {
    dataPath: string
    min?: number
    max?: number
    step?: number
    options?: Array<{ label: string; value: unknown }>
  }
}

/** Thread styling within a metaphor */
export interface MetaphorThreadStyle {
  /** What determines thread color: 'dataType', 'source', 'target' */
  colorBy: string
  /** Metaphorical description: "ingredients flowing between stations" */
  metaphor: string
  /** Color map for data types */
  colorMap: Record<string, { color: string; width: number; style: 'solid' | 'dashed' | 'animated' }>
}

// ─── Scoring: The 5 evaluation criteria ──────────────────────────

/** Quality evaluation of a metaphor — learned from the Loom 3/10 */
export interface MetaphorScores {
  /** Does a non-programmer immediately understand what each element does? */
  explanatoryPower: number
  /** Do the metaphorical controls accurately represent the underlying parameters? */
  truthfulness: number
  /** Does every important parameter have a metaphorical control? */
  completeness: number
  /** Do the facade controls feel natural within the metaphor? */
  intuitiveInteraction: number
  /** Does the metaphor hold at different zoom levels? */
  fractalConsistency: number
  /** Weighted average of all scores */
  overall: number
  /** Explanation of the scores */
  rationale: string
}

// ─── Granular Scoring: Component-by-component, attribute-by-attribute ───

/**
 * Score for a single attribute/parameter within a mapping.
 * Each facade control gets individually evaluated for how well
 * the metaphorical label/type explains the underlying parameter.
 */
export interface MetaphorAttributeScore {
  /** The real parameter name (e.g. "steps", "cfg", "seed") */
  parameterName: string
  /** The metaphorical control label (e.g. "Temperature Dial", "Bake Timer") */
  metaphorControl: string
  /** 1-10: does the control name/type explain what the parameter does? */
  explanatoryPower: number
  /** 1-10: does the control range/behavior match the parameter's actual effect? */
  truthfulness: number
  /** 1-10: does this control feel natural within the metaphor? */
  intuitiveness: number
  /** Why these scores — including specific weaknesses */
  rationale: string
}

/**
 * Score for a single knot-type → metaphor-element mapping.
 * Evaluated per-component before being compiled into overall scores.
 */
export interface MetaphorMappingScore {
  /** The knot type being mapped (e.g. "KSampler") */
  knotType: string
  /** The metaphorical element (e.g. "Oven") */
  metaphorElement: string
  /** 1-10: how well does this element represent the knot's functional role? */
  elementFit: number
  /** Per-attribute scores for each facade control on this element */
  attributeScores: MetaphorAttributeScore[]
  /** 1-10: do the I/O types make sense for this element in the metaphor? */
  inputOutputFit: number
  /** Weighted average of element + attributes + I/O scores */
  overallMappingScore: number
  /** Why these scores — including what works and what doesn't */
  rationale: string
}

/**
 * Analysis of how well the metaphor handles the actual data types
 * flowing through the workflow. This is critical for image-generation
 * workflows where text goes in and images come out.
 */
export interface InputOutputAnalysis {
  /** 1-10: text prompts MUST remain textual — can't abstract away what users type */
  textInputHandling: number
  /** 1-10: model/checkpoint selection — ripe for rich abstraction */
  modelInputHandling: number
  /** 1-10: latent/conditioning intermediate steps — moderate abstraction acceptable */
  intermediateHandling: number
  /** 1-10: final output IS an image — metaphor must produce something visual */
  finalOutputHandling: number
  /** Explanation of how the metaphor handles the I/O pipeline */
  rationale: string
}

/**
 * Full detailed scoring that breaks down a metaphor's quality
 * at every level: per-attribute, per-component, per-I/O-type,
 * then compiled into the 5 summary criteria.
 */
export interface MetaphorDetailedScores extends MetaphorScores {
  /** Per-mapping granular scores */
  mappingScores: MetaphorMappingScore[]
  /** How the metaphor handles actual data types flowing through */
  ioAnalysis: InputOutputAnalysis
}

// ─── Stability: How much can the Loci change? ────────────────────

/** Controls when the Loci should change metaphors vs. leave them alone */
export interface MetaphorStability {
  /**
   * - locked: user pinned this metaphor, Loci doesn't touch it
   * - guided: Loci suggests changes but waits for approval
   * - adaptive: Loci adjusts freely (within score thresholds)
   */
  mode: 'locked' | 'guided' | 'adaptive'
  /** Adaptive mode: only change if current overall score < this (default: 5) */
  minScoreThreshold?: number
  /** Lock specific element mappings while rest adapts */
  lockedMappings?: Set<string>
  /** How aggressive the Loci is with changes */
  changeRate?: 'conservative' | 'moderate' | 'experimental'
}

// ─── Engine Interface ────────────────────────────────────────────

/** The Loci's core capability — pure text-gen, no rendering deps */
export interface MetaphorEngine {
  /** Propose N metaphors for a weave, scored and ranked */
  propose(schema: WeaveSchema, count?: number): Promise<MetaphorManifest[]>

  /** Refine an existing metaphor based on user feedback */
  refine(current: MetaphorManifest, feedback: string): Promise<MetaphorManifest>

  /** Re-evaluate scores when context changes (new knots, user feedback) */
  reevaluate(manifest: MetaphorManifest, newSchema: WeaveSchema): Promise<MetaphorScores>
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Extract a WeaveSchema from a Weave (pure function) */
export function weaveToSchema(weave: { knots: Map<string, any>; threads: Map<string, any> }, purpose?: string): WeaveSchema {
  const knots: WeaveSchemaKnot[] = []
  for (const [id, knot] of weave.knots) {
    const dataKeys = Object.keys(knot.data ?? {})
    const parameterNames = knot.data?.inputs
      ? Object.keys(knot.data.inputs).filter(k => typeof knot.data.inputs[k] !== 'object' || Array.isArray(knot.data.inputs[k]))
      : []
    knots.push({ id, type: knot.type, label: knot.label, dataKeys, parameterNames })
  }

  const threads: WeaveSchemaThread[] = []
  for (const [, thread] of weave.threads) {
    threads.push({
      source: thread.source,
      target: thread.target,
      dataType: thread.data?.type,
      label: thread.label,
    })
  }

  return { knots, threads, purpose }
}

/** Calculate the overall score from individual scores (weighted average) */
export function calculateOverallScore(scores: Omit<MetaphorScores, 'overall' | 'rationale'>): number {
  const weights = {
    explanatoryPower: 0.3,     // Most important — does it click?
    truthfulness: 0.25,        // Controls must match reality
    completeness: 0.2,         // Cover all parameters
    intuitiveInteraction: 0.15, // Facades feel natural
    fractalConsistency: 0.1,   // Nice to have, hard to achieve
  }

  return (
    scores.explanatoryPower * weights.explanatoryPower +
    scores.truthfulness * weights.truthfulness +
    scores.completeness * weights.completeness +
    scores.intuitiveInteraction * weights.intuitiveInteraction +
    scores.fractalConsistency * weights.fractalConsistency
  )
}

/**
 * Calculate overall MetaphorScores from granular component-level data.
 *
 * Compiles per-mapping scores + I/O analysis into the 5 summary criteria,
 * weighting text-input and final-output knots more heavily since they're
 * the user-facing ends of the pipeline.
 */
export function calculateOverallScoreFromMappings(
  mappingScores: MetaphorMappingScore[],
  ioAnalysis: InputOutputAnalysis
): Omit<MetaphorScores, 'overall' | 'rationale'> {
  if (mappingScores.length === 0) {
    return {
      explanatoryPower: 0,
      truthfulness: 0,
      completeness: 0,
      intuitiveInteraction: 0,
      fractalConsistency: 0,
    }
  }

  // Average each attribute dimension across all mappings
  let totalExplanatory = 0
  let totalTruthfulness = 0
  let totalIntuitiveness = 0
  let totalElementFit = 0
  let mappingCount = 0

  for (const ms of mappingScores) {
    totalElementFit += ms.elementFit
    mappingCount++

    if (ms.attributeScores.length > 0) {
      const attrAvgExplanatory = ms.attributeScores.reduce((s, a) => s + a.explanatoryPower, 0) / ms.attributeScores.length
      const attrAvgTruthfulness = ms.attributeScores.reduce((s, a) => s + a.truthfulness, 0) / ms.attributeScores.length
      const attrAvgIntuitiveness = ms.attributeScores.reduce((s, a) => s + a.intuitiveness, 0) / ms.attributeScores.length

      totalExplanatory += attrAvgExplanatory
      totalTruthfulness += attrAvgTruthfulness
      totalIntuitiveness += attrAvgIntuitiveness
    } else {
      // No attributes — use element fit as proxy
      totalExplanatory += ms.elementFit
      totalTruthfulness += ms.elementFit
      totalIntuitiveness += ms.elementFit
    }
  }

  const avgExplanatory = totalExplanatory / mappingCount
  const avgTruthfulness = totalTruthfulness / mappingCount
  const avgIntuitiveness = totalIntuitiveness / mappingCount
  const avgElementFit = totalElementFit / mappingCount

  // I/O analysis weighs heavily on explanatory power and truthfulness
  const ioAvg = (
    ioAnalysis.textInputHandling * 0.35 +   // Text MUST stay textual — highest weight
    ioAnalysis.finalOutputHandling * 0.30 +   // Output IS an image — critical
    ioAnalysis.modelInputHandling * 0.20 +    // Model abstraction — important
    ioAnalysis.intermediateHandling * 0.15     // Intermediate steps — moderate
  )

  // Compile into the 5 summary scores
  // explanatoryPower: element fit + attribute explanatory power + I/O handling
  const explanatoryPower = avgElementFit * 0.4 + avgExplanatory * 0.3 + ioAvg * 0.3

  // truthfulness: attribute truthfulness + I/O accuracy
  const truthfulness = avgTruthfulness * 0.6 + ioAvg * 0.4

  // completeness: proportion of mappings with attribute scores (indicates coverage)
  const mappingsWithAttrs = mappingScores.filter(ms => ms.attributeScores.length > 0).length
  const attrCoverage = mappingsWithAttrs / mappingCount
  const avgIOFit = mappingScores.reduce((s, ms) => s + ms.inputOutputFit, 0) / mappingCount
  const completeness = attrCoverage * 5 + avgIOFit * 0.5

  // intuitiveInteraction: attribute intuitiveness
  const intuitiveInteraction = avgIntuitiveness

  // fractalConsistency: how uniform the element fits are (low variance = consistent)
  const fitVariance = mappingScores.reduce((s, ms) => s + Math.pow(ms.elementFit - avgElementFit, 2), 0) / mappingCount
  const consistencyFromVariance = Math.max(0, 10 - Math.sqrt(fitVariance) * 2)
  const fractalConsistency = consistencyFromVariance * 0.5 + avgElementFit * 0.5

  return {
    explanatoryPower: Math.round(explanatoryPower * 10) / 10,
    truthfulness: Math.round(truthfulness * 10) / 10,
    completeness: Math.min(10, Math.round(completeness * 10) / 10),
    intuitiveInteraction: Math.round(intuitiveInteraction * 10) / 10,
    fractalConsistency: Math.round(fractalConsistency * 10) / 10,
  }
}
