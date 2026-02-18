/**
 * Glamour Engine — Core Type Definitions
 *
 * The Glamour system veils underlying complexity with interactive
 * metaphorical facades. These types define the renderer abstraction,
 * theme system, facade interaction, wave animation, and asset resolution.
 */

import type { Weave, Knot, Thread, KnotId, ThreadId, KnotInput, Position, GateCondition } from '#weaver/core'
import type { TraceResult, Wave } from '#weaver/runtime'

// ─── Shared Types (extracted from app) ──────────────────────────

/** Selection state — identifies a selected knot or thread */
export type SelectionType = 'knot' | 'thread'

export interface Selection {
  type: SelectionType
  id: string
}

/** View mode — which renderer tab is active */
export type ViewMode = 'unveiled' | 'comfyui' | 'glamour'

/**
 * WeaveAction — all actions a renderer can dispatch to modify the Weave.
 * Extracted from useWeave.tsx so renderers don't depend on app internals.
 */
export type WeaveAction =
  | { type: 'mark'; input: KnotInput }
  | { type: 'thread'; source: KnotId; target: KnotId }
  | { type: 'snip'; threadId: ThreadId }
  | { type: 'cut'; knotId: KnotId }
  | { type: 'gate'; threadId: ThreadId; condition: GateCondition }
  | { type: 'load'; weave: Weave }
  | { type: 'new'; name: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'markSaved' }
  | { type: 'updatePositions'; positions: Map<KnotId, { x: number; y: number }> }
  | { type: 'updateKnot'; knotId: KnotId; changes: { label?: string; type?: string; data?: Record<string, unknown> } }
  | { type: 'updateThread'; threadId: ThreadId; changes: { label?: string; data?: Record<string, unknown>; gate?: GateCondition | null } }

// ─── Renderer Abstraction ───────────────────────────────────────

/** Metadata describing a registered renderer */
export interface WeaveRendererDefinition {
  id: string
  name: string
  description?: string
  /** Whether this renderer supports editing (vs. view-only) */
  editable: boolean
  /** Whether this renderer is currently available */
  available: boolean
}

/**
 * Props passed to every renderer component.
 *
 * This is the contract between the app shell and any renderer.
 * The renderer receives Weave data + callbacks; it never owns state.
 */
export interface WeaveRendererProps {
  weave: Weave
  selection: Selection | null
  traceResult: TraceResult | null
  animationState: AnimationState | null
  onWeaveAction: (action: WeaveAction) => void
  onSelectionChange: (selection: Selection | null) => void
}

// ─── Glamour Theme ──────────────────────────────────────────────

/** Context passed to theme enchantment methods */
export interface EnchantContext {
  weave: Weave
  theme: GlamourTheme
  zoom: number
  /** IDs of knots currently unveiled (showing raw graph beneath glamour) */
  unveiledKnots: Set<KnotId>
}

/** A glamour theme defines how to enchant knots, threads, and waves */
export interface GlamourTheme {
  id: string
  name: string
  description: string

  /** Enchant a knot — produce its glamoured visual representation */
  enchantKnot(knot: Knot, context: EnchantContext): GlamourElement

  /** Enchant a thread — produce its glamoured visual path */
  enchantThread(
    thread: Thread,
    sourceKnot: Knot,
    targetKnot: Knot,
    context: EnchantContext,
  ): GlamourConnection

  /** Enchant a wave — produce its data flow animation */
  enchantWave(wave: Wave, knot: Knot, context: EnchantContext): GlamourAnimation

  /** Can this theme glamour a set of knots as a single merged entity? */
  canMerge(knotIds: KnotId[], context: EnchantContext): boolean

  /** Enchant a subgraph — merge multiple knots into one glamour element */
  enchantSubgraph(knotIds: KnotId[], context: EnchantContext): GlamourElement

  /** Describe the whole weave in this theme's metaphorical language */
  describeWeave(weave: Weave): string

  /** Describe a single knot in this theme's vocabulary */
  describeKnot(knot: Knot, weave: Weave): string

  /** Scene-level configuration */
  sceneConfig: GlamourSceneConfig

  /** System prompt fragment for AI to use this theme's vocabulary */
  aiSystemPrompt: string
}

/** Scene-level glamour configuration */
export interface GlamourSceneConfig {
  background: string | GlamourVisual
  /** Loci-generated prompt for a scene background image (wide format) */
  backgroundPrompt?: string
  /** Atmosphere/ambient description for future particle/shader effects */
  ambientDescription?: string
  /** Layout hints describing spatial arrangement of elements */
  layoutHints?: string
  ambientEffects?: GlamourAnimation[]
  layoutMode: 'free' | 'horizontal' | 'vertical' | 'radial'
  /** Default spacing between elements */
  spacing: { x: number; y: number }
}

// ─── Glamour Elements ────────────────────────────────────────────

/** Visual representation of a glamoured knot */
export interface GlamourElement {
  /** Which knot IDs this glamour covers (1 for single, N for merged subgraph) */
  veils: KnotId[]
  /** The visual asset/component to render */
  visual: GlamourVisual
  /** Interactive controls mapped to graph operations */
  facade: FacadeDefinition | null
  /** Display label (may differ from knot.label) */
  label: string
  /** Tooltip text (shown on hover) */
  tooltip?: string
  /** Position in scene space (may differ from knot.position) */
  position: Position
  /** Size of the element */
  size: { width: number; height: number }
  /** How many levels of unveiling are possible below this glamour */
  depth: number
  /** Animation hints from the Loci manifest (natural language descriptions) */
  animationHints?: {
    /** Idle animation: "Gentle bobbing, steam rising" */
    idle?: string
    /** Active/processing animation: "Rapid bubbling, lid rattling" */
    active?: string
    /** Transition animation: "Fade through smoke" */
    transition?: string
  }
  /** Interaction style from the Loci manifest */
  interactionStyle?: 'static' | 'hover-reveal' | 'click-cycle' | 'drag-control' | 'animated-idle'
}

/** Visual representation of a glamoured thread */
export interface GlamourConnection {
  /** The thread this connection represents */
  threadId: ThreadId
  /** Visual style for the connection path */
  visual: GlamourConnectionVisual
  /** Label for the connection */
  label?: string
}

/** How a glamour element should be rendered visually */
export type GlamourVisual =
  | { type: 'svg'; path: string }
  | { type: 'sprite'; url: string }
  | { type: 'color'; fill: string; stroke?: string; shape: 'rect' | 'circle' | 'hexagon' }
  | { type: 'component'; componentId: string }
  | { type: 'generated'; prompt: string; fallback: GlamourVisual }
  // ─── Future visual types (architecture prep) ─────────────────
  /** Sprite-sheet / frame-sequence animation */
  | { type: 'animated'; frames: string[]; fps: number; loop: boolean }
  /** Video playback (MP4/WebM) */
  | { type: 'video'; url: string; loop: boolean }
  /** Custom interactive widget with persistent state */
  | { type: 'interactive'; componentId: string; state: Record<string, unknown> }

/** How a glamour connection should be rendered */
export interface GlamourConnectionVisual {
  color: string
  width: number
  style: 'solid' | 'dashed' | 'dotted' | 'animated'
  /** Optional arrow/marker at each end */
  sourceMarker?: string
  targetMarker?: string
}

// ─── Facade (Interactive Controls) ───────────────────────────────

/** Definition of interactive controls on a glamour element */
export interface FacadeDefinition {
  controls: FacadeControl[]
}

/** A single interactive control within a facade */
export interface FacadeControl {
  /** Unique ID within this facade */
  id: string
  /** What kind of control */
  controlType: FacadeControlType
  /** Which knot data key this control reads from / writes to */
  binding: FacadeBinding
  /** Label displayed on or near the control */
  label?: string
  /** Position relative to the glamour element (0-1 normalized) */
  position: { x: number; y: number }
}

export type FacadeControlType =
  | 'dial'       // Rotary control (numeric)
  | 'slider'     // Linear slide (numeric)
  | 'toggle'     // On/off switch (boolean)
  | 'select'     // Dropdown / wheel selection (enum)
  | 'color'      // Color picker
  | 'text'       // Text input area
  | 'button'     // Action trigger
  | 'display'    // Read-only display

/** Binds a facade control to a knot's data field */
export interface FacadeBinding {
  /** The knot ID this control binds to */
  knotId: KnotId
  /** The data key path (e.g., 'inputs.seed', 'inputs.steps') */
  dataPath: string
  /** Transform the raw value for display */
  toDisplay?: (value: unknown) => unknown
  /** Transform the display value back to the data value */
  fromDisplay?: (displayValue: unknown) => unknown
  /** Numeric constraints */
  min?: number
  max?: number
  step?: number
  /** Enum options for 'select' controls */
  options?: Array<{ label: string; value: unknown }>
}

// ─── Wave Animation ──────────────────────────────────────────────

/** State of animation playback */
export interface AnimationState {
  /** The trace result being animated */
  traceResult: TraceResult
  /** Current playback position (0 to 1) */
  progress: number
  /** Whether animation is playing */
  playing: boolean
  /** Speed multiplier */
  speed: number
  /** Currently highlighted knots */
  activeKnots: Map<KnotId, KnotHighlight>
  /** Currently highlighted threads */
  activeThreads: Map<ThreadId, ThreadHighlight>
}

export interface KnotHighlight {
  color: string
  intensity: number  // 0-1
  pulse: boolean
}

export interface ThreadHighlight {
  color: string
  progress: number  // 0-1 along the thread path
  width: number
}

/** Animation keyframe for a glamour element */
export interface GlamourAnimation {
  /** Duration in milliseconds */
  duration: number
  /** Keyframes describing the animation */
  keyframes: GlamourKeyframe[]
  /** Whether to loop */
  loop: boolean
}

export interface GlamourKeyframe {
  /** Time offset (0-1 within duration) */
  time: number
  /** Properties to animate */
  properties: Record<string, number | string>
  /** Easing function name */
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
}

// ─── Animation Timeline ─────────────────────────────────────────

/** A compiled animation timeline derived from a TraceResult */
export interface AnimationTimeline {
  /** Total duration in ms */
  duration: number
  /** Per-knot highlight events */
  knotEvents: AnimationEvent<KnotHighlight>[]
  /** Per-thread highlight events */
  threadEvents: AnimationEvent<ThreadHighlight>[]
}

export interface AnimationEvent<T> {
  /** Target ID (knotId or threadId) */
  targetId: string
  /** Start time (0-1 normalized to total duration) */
  start: number
  /** End time (0-1) */
  end: number
  /** The highlight state during this event */
  state: T
}

// ─── Asset Resolution ────────────────────────────────────────────

export interface GlamourAsset {
  type: 'svg' | 'image' | 'fallback'
  url: string
  hash: string
}

/** The result of resolving an asset with fallback chain */
export interface AssetResolution {
  asset: GlamourAsset
  /** Which level of the fallback chain was used */
  fallbackLevel: 'exact' | 'instance' | 'type' | 'theme' | 'aurora'
}
