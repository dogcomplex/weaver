/**
 * ManifestTheme — Data-Driven Glamour from MetaphorManifest
 *
 * Converts a MetaphorManifest (produced by the Loci) into a live
 * GlamourTheme that the renderer can consume. This is the bridge
 * between AI-generated metaphors and visual rendering.
 *
 * Visual fallback chain per knot:
 *   1. assetResolver cached image → { type: 'sprite', url }
 *   2. mapping.assetPrompt → { type: 'generated', prompt, fallback }
 *   3. mapping.svgFallback → { type: 'svg', path }
 *   4. default → { type: 'color', fill, stroke, shape: 'rect' }
 */

import type { Knot, Thread, KnotId, Weave } from '#weaver/core'
import type { Wave } from '#weaver/runtime'
import type {
  GlamourTheme,
  GlamourElement,
  GlamourConnection,
  GlamourAnimation,
  GlamourSceneConfig,
  GlamourVisual,
  GlamourConnectionVisual,
  EnchantContext,
  FacadeDefinition,
  FacadeControl,
} from '../../types.js'
import type {
  MetaphorManifest,
  MetaphorMapping,
  MetaphorMergeGroup,
  MetaphorFacadeControl,
} from '../../metaphor-engine.js'
import { GlamourAssetResolver, hashKnotConfig } from '../../asset-resolver.js'

// ─── Default Colors ──────────────────────────────────────────────

const DEFAULT_FILL = '#1a1a3e'
const DEFAULT_STROKE = '#3a3a6e'
const DEFAULT_THREAD_COLOR = '#4a4a6a'
const DEFAULT_THREAD_WIDTH = 2

// ─── Default SVG Fallbacks (Loom theme assets as universal fallbacks) ──
// Used when the Loci doesn't generate svgFallback in mappings (it usually doesn't).
// Maps common ComfyUI knot types to Loom theme SVGs for a nicer fallback than color boxes.
const DEFAULT_SVG_FALLBACKS: Record<string, string> = {
  CheckpointLoaderSimple: '/glamour/loom/fiber-bundle.svg',
  KSampler: '/glamour/loom/spindle.svg',
  CLIPTextEncode: '/glamour/loom/dye-vat.svg',
  VAEDecode: '/glamour/loom/cloth-beam.svg',
  SaveImage: '/glamour/loom/winding-frame.svg',
  EmptyLatentImage: '/glamour/loom/heddle-frame.svg',
}

// ─── ManifestTheme ──────────────────────────────────────────────

export class ManifestTheme implements GlamourTheme {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly sceneConfig: GlamourSceneConfig
  readonly aiSystemPrompt: string

  /** Instance-level lookup: knotId → MetaphorMapping (highest priority) */
  private mappingsById: Map<string, MetaphorMapping>
  /** Type-level fallback: knotType → MetaphorMapping (first mapping of each type) */
  private mappingsByType: Map<string, MetaphorMapping>

  constructor(
    private manifest: MetaphorManifest,
    /** knotType → knotId — used to inject proper knotId into facade bindings */
    private knotIdMap: Map<string, KnotId>,
    private assetResolver?: GlamourAssetResolver,
  ) {
    this.id = `manifest-${manifest.id}`
    this.name = manifest.name
    this.description = manifest.sceneDescription
    this.aiSystemPrompt = manifest.aiVocabulary

    // Normalize layoutMode: manifest uses 'freeform', GlamourSceneConfig uses 'free'
    const layoutMode = manifest.sceneConfig.layoutMode === 'freeform'
      ? 'free' as const
      : manifest.sceneConfig.layoutMode as 'horizontal' | 'vertical' | 'radial' | 'free'

    this.sceneConfig = {
      background: manifest.sceneConfig.background,
      backgroundPrompt: manifest.sceneConfig.backgroundPrompt,
      ambientDescription: manifest.sceneConfig.ambientDescription,
      layoutHints: manifest.sceneConfig.layoutHints,
      layoutMode,
      spacing: manifest.sceneConfig.spacing,
    }

    // Build lookup maps — instance-level (by knotId) takes priority over type-level
    this.mappingsById = new Map()
    this.mappingsByType = new Map()
    for (const mapping of manifest.mappings) {
      if (mapping.knotId) {
        this.mappingsById.set(mapping.knotId, mapping)
      }
      // Type-level: first mapping of each type wins (don't overwrite with duplicates)
      if (!this.mappingsByType.has(mapping.knotType)) {
        this.mappingsByType.set(mapping.knotType, mapping)
      }
    }
  }

  // ─── enchantKnot ───────────────────────────────────────────────

  enchantKnot(knot: Knot, context: EnchantContext): GlamourElement {
    const mapping = this.mappingsById.get(knot.id) ?? this.mappingsByType.get(knot.type)

    // If unveiled, show raw info
    if (context.unveiledKnots.has(knot.id)) {
      return {
        veils: [knot.id],
        visual: { type: 'color', fill: '#1a1a2e', stroke: '#3a3a5a', shape: 'rect' },
        facade: null,
        label: `${knot.label} [${knot.type}]`,
        tooltip: mapping?.description ?? knot.type,
        position: knot.position,
        size: { width: (mapping?.size.width ?? 80), height: 40 },
        depth: 1,
      }
    }

    // No mapping for this knot type — use default
    if (!mapping) {
      return {
        veils: [knot.id],
        visual: { type: 'color', fill: DEFAULT_FILL, stroke: DEFAULT_STROKE, shape: 'rect' },
        facade: null,
        label: knot.label || knot.type,
        tooltip: `Unknown element: ${knot.type}`,
        position: knot.position,
        size: { width: 80, height: 80 },
        depth: 2,
      }
    }

    const visual = this.resolveVisual(knot, mapping)
    const facade = this.buildFacade(knot.id, mapping)

    return {
      veils: [knot.id],
      visual,
      facade,
      label: mapping.label,
      tooltip: mapping.description,
      position: knot.position,
      size: mapping.size,
      depth: 2,
      animationHints: mapping.animationHints,
      interactionStyle: mapping.interactionStyle,
    }
  }

  // ─── enchantThread ─────────────────────────────────────────────

  enchantThread(
    thread: Thread,
    sourceKnot: Knot,
    _targetKnot: Knot,
    _context: EnchantContext,
  ): GlamourConnection {
    const { visual, colorMapLabel } = this.resolveThreadVisual(thread, sourceKnot)

    return {
      threadId: thread.id,
      visual,
      // Prefer colorMap label (metaphorical name), fall back to thread label
      label: colorMapLabel ?? thread.label,
    }
  }

  // ─── enchantWave ──────────────────────────────────────────────

  enchantWave(_wave: Wave, _knot: Knot, _context: EnchantContext): GlamourAnimation {
    // Simple shuttle-style animation matching the manifest's wave metaphor
    return {
      duration: 300,
      keyframes: [
        { time: 0, properties: { x: -30, opacity: 0 }, easing: 'easeIn' },
        { time: 0.3, properties: { x: 0, opacity: 1 }, easing: 'easeOut' },
        { time: 0.7, properties: { x: 0, opacity: 1 }, easing: 'easeIn' },
        { time: 1, properties: { x: 30, opacity: 0 }, easing: 'easeOut' },
      ],
      loop: false,
    }
  }

  // ─── canMerge / enchantSubgraph ─────────────────────────────────

  /**
   * Check if a set of knots matches any merge group in the manifest.
   * Matches when the knot types of the provided IDs exactly cover a merge group's knotTypes.
   */
  canMerge(knotIds: KnotId[], context: EnchantContext): boolean {
    if (!this.manifest.mergedGroups || this.manifest.mergedGroups.length === 0) return false
    const group = this.findMergeGroup(knotIds, context)
    return group !== null
  }

  /**
   * Produce a single GlamourElement for a merged group of knots.
   * The merged element uses the group's label, asset prompt, and combined facade controls.
   * Position is the centroid of all merged knots.
   */
  enchantSubgraph(knotIds: KnotId[], context: EnchantContext): GlamourElement {
    const group = this.findMergeGroup(knotIds, context)
    if (!group) {
      throw new Error('No matching merge group for these knots — use canMerge() to check first')
    }

    // Calculate centroid position from all knots in the group
    let cx = 0, cy = 0, count = 0
    for (const knotId of knotIds) {
      const knot = context.weave.knots.get(knotId)
      if (knot) {
        cx += knot.position.x
        cy += knot.position.y
        count++
      }
    }
    if (count > 0) { cx /= count; cy /= count }

    // Resolve visual (use group asset prompt if available)
    let visual: GlamourVisual
    if (group.assetPrompt) {
      visual = {
        type: 'generated',
        prompt: group.assetPrompt,
        fallback: { type: 'color', fill: '#2a1a3e', stroke: '#5a3a8e', shape: 'rect' },
      }
    } else {
      visual = { type: 'color', fill: '#2a1a3e', stroke: '#5a3a8e', shape: 'rect' }
    }

    // Build combined facade with controls from all inner knots
    const facade = this.buildMergedFacade(knotIds, group)

    return {
      veils: knotIds,
      visual,
      facade,
      label: group.label,
      tooltip: `${group.description} (${knotIds.length} knots merged)`,
      position: { x: cx, y: cy },
      size: group.size,
      depth: 3, // Deeper than individual knots — indicates fractal depth
    }
  }

  /** Find a merge group that matches a set of knot IDs by their types */
  private findMergeGroup(knotIds: KnotId[], context: EnchantContext): MetaphorMergeGroup | null {
    if (!this.manifest.mergedGroups) return null

    // Get the set of knot types for the provided IDs
    const knotTypes = new Set<string>()
    for (const knotId of knotIds) {
      const knot = context.weave.knots.get(knotId)
      if (knot) knotTypes.add(knot.type)
    }

    // Find a group whose knotTypes match
    for (const group of this.manifest.mergedGroups) {
      const groupTypes = new Set(group.knotTypes)
      if (groupTypes.size !== knotTypes.size) continue
      let match = true
      for (const t of groupTypes) {
        if (!knotTypes.has(t)) { match = false; break }
      }
      if (match) return group
    }

    return null
  }

  /** Build facade controls for a merged group, injecting proper knotIds */
  private buildMergedFacade(_knotIds: KnotId[], group: MetaphorMergeGroup): FacadeDefinition | null {
    if (!group.facadeControls || group.facadeControls.length === 0) return null

    const controls: FacadeControl[] = group.facadeControls.map((mc: MetaphorFacadeControl) => {
      // Use binding.knotType to find the right knotId from the class-level map
      const targetKnotId = mc.binding.knotType
        ? this.knotIdMap.get(mc.binding.knotType)
        : undefined
      return {
        id: mc.id,
        // Normalize 'dropdown' → 'select' for backward compat with old manifests
        controlType: (mc.controlType as string) === 'dropdown' ? 'select' : mc.controlType,
        label: mc.label,
        position: mc.position,
        binding: {
          knotId: targetKnotId ?? _knotIds[0],
          dataPath: mc.binding.dataPath,
          min: mc.binding.min,
          max: mc.binding.max,
          step: mc.binding.step,
          options: Array.isArray(mc.binding.options) ? mc.binding.options : undefined,
        },
      }
    })

    return { controls }
  }

  /** Get merge groups from the manifest (for renderer use) */
  getMergeGroups(): MetaphorMergeGroup[] {
    return this.manifest.mergedGroups ?? []
  }

  // ─── describeWeave / describeKnot ──────────────────────────────

  describeWeave(weave: Weave): string {
    const knotCount = weave.knots.size
    const threadCount = weave.threads.size
    if (knotCount === 0) {
      return `${this.manifest.sceneDescription} — empty, waiting to be filled.`
    }
    return `${this.manifest.sceneDescription} — ${knotCount} element${knotCount !== 1 ? 's' : ''} connected by ${threadCount} thread${threadCount !== 1 ? 's' : ''}.`
  }

  describeKnot(knot: Knot, _weave: Weave): string {
    const mapping = this.mappingsById.get(knot.id) ?? this.mappingsByType.get(knot.type)
    if (mapping) {
      return mapping.description
    }
    return `${knot.label} — a ${knot.type} element.`
  }

  // ─── Visual Resolution ─────────────────────────────────────────

  /**
   * Resolve the visual for a knot, using the fallback chain:
   * 1. Asset resolver cached image → sprite
   * 2. Asset prompt → generated (with color fallback)
   * 3. SVG fallback → svg
   * 4. Default color
   */
  private resolveVisual(knot: Knot, mapping: MetaphorMapping): GlamourVisual {
    const hash = hashKnotConfig(knot)

    // Level 1: Check asset resolver for cached image
    if (this.assetResolver) {
      const resolution = this.assetResolver.resolve(
        knot.id,
        knot.type,
        hash,
        this.manifest.id,
      )
      if (resolution.fallbackLevel === 'exact' || resolution.fallbackLevel === 'instance' || resolution.fallbackLevel === 'type') {
        return { type: 'sprite', url: resolution.asset.url }
      }
    }

    // Level 2: Asset prompt → generated visual with SVG fallback (or color fallback)
    if (mapping.assetPrompt) {
      const svgPath = mapping.svgFallback ?? DEFAULT_SVG_FALLBACKS[mapping.knotType]
      const fallback: GlamourVisual = svgPath
        ? { type: 'svg', path: svgPath }
        : { type: 'color', fill: DEFAULT_FILL, stroke: DEFAULT_STROKE, shape: 'rect' }
      return {
        type: 'generated',
        prompt: mapping.assetPrompt,
        fallback,
      }
    }

    // Level 3: SVG fallback
    const svgPath = mapping.svgFallback ?? DEFAULT_SVG_FALLBACKS[mapping.knotType]
    if (svgPath) {
      return { type: 'svg', path: svgPath }
    }

    // Level 4: Default color
    return {
      type: 'color',
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      shape: 'rect',
    }
  }

  // ─── Thread Visual Resolution ──────────────────────────────────

  private resolveThreadVisual(thread: Thread, sourceKnot: Knot): { visual: GlamourConnectionVisual; colorMapLabel?: string } {
    const { threadStyle } = this.manifest

    // Determine the data type for color lookup
    let dataType = '*'
    if (threadStyle.colorBy === 'dataType') {
      // Check explicit thread data type
      if (thread.data?.type && typeof thread.data.type === 'string') {
        dataType = thread.data.type
      } else if (thread.label && threadStyle.colorMap[thread.label]) {
        // Use thread label if it matches a colorMap key (e.g. "CLIP", "MODEL", "LATENT")
        dataType = thread.label
      } else {
        // Infer from source knot
        dataType = this.inferDataType(sourceKnot)
      }
    } else if (threadStyle.colorBy === 'source') {
      dataType = sourceKnot.type
    }

    // Lookup in color map
    const style = threadStyle.colorMap[dataType] ?? threadStyle.colorMap['*']
    if (style) {
      return {
        visual: {
          color: style.color,
          width: style.width,
          style: style.style,
        },
        colorMapLabel: style.label,
      }
    }

    // Fallback
    return {
      visual: {
        color: DEFAULT_THREAD_COLOR,
        width: DEFAULT_THREAD_WIDTH,
        style: 'solid',
      },
    }
  }

  /** Infer data type from source knot type (same logic as LoomTheme) */
  private inferDataType(sourceKnot: Knot): string {
    switch (sourceKnot.type) {
      case 'CheckpointLoaderSimple': return 'MODEL'
      case 'CLIPTextEncode': return 'CONDITIONING'
      case 'KSampler': return 'LATENT'
      case 'VAEDecode': return 'IMAGE'
      case 'EmptyLatentImage': return 'LATENT'
      default: return '*'
    }
  }

  // ─── Facade Building ────────────────────────────────────────────

  /**
   * Convert MetaphorFacadeControl[] → FacadeDefinition, injecting
   * the actual knotId into each control's binding.
   */
  private buildFacade(knotId: KnotId, mapping: MetaphorMapping): FacadeDefinition | null {
    if (!mapping.facadeControls || mapping.facadeControls.length === 0) {
      return null
    }

    const controls: FacadeControl[] = mapping.facadeControls.map((mc: MetaphorFacadeControl) => ({
      id: mc.id,
      // Normalize 'dropdown' → 'select' for backward compat with old manifests
      controlType: (mc.controlType as string) === 'dropdown' ? 'select' : mc.controlType,
      label: mc.label,
      position: mc.position,
      binding: {
        knotId,
        dataPath: mc.binding.dataPath,
        min: mc.binding.min,
        max: mc.binding.max,
        step: mc.binding.step,
        options: Array.isArray(mc.binding.options) ? mc.binding.options : undefined,
      },
    }))

    return { controls }
  }
}

// ─── Utility: Build knotType → knotId map from a Weave ───────────

/**
 * Builds a Map<knotType, KnotId> from a Weave.
 * Uses the first knot found for each type.
 * Exported for use by the server when constructing ManifestTheme.
 */
export function buildKnotIdMap(weave: Weave): Map<string, KnotId> {
  const map = new Map<string, KnotId>()
  for (const [knotId, knot] of weave.knots) {
    if (!map.has(knot.type)) {
      map.set(knot.type, knotId)
    }
  }
  return map
}

/**
 * Builds a Map<knotType, KnotId[]> — all knot instances per type.
 * Use when manifests have instance-level mappings for duplicate types.
 */
export function buildFullKnotIdMap(weave: Weave): Map<string, KnotId[]> {
  const map = new Map<string, KnotId[]>()
  for (const [knotId, knot] of weave.knots) {
    const list = map.get(knot.type) ?? []
    list.push(knotId)
    map.set(knot.type, list)
  }
  return map
}
