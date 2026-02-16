/** Unique identifier for a Knot (node where threads meet) */
export type KnotId = string

/** Unique identifier for a Thread (edge/connection) */
export type ThreadId = string

/** Unique identifier for a Strand (namespace/module) */
export type StrandId = string

/** Position in 2D canvas space */
export interface Position {
  x: number
  y: number
}

/** A Knot — a point in the weave where threads meet */
export interface Knot {
  id: KnotId
  label: string
  type: string
  position: Position
  data: Record<string, unknown>
  strand?: StrandId
}

/** A Gate condition — controls whether a thread allows passage */
export interface GateCondition {
  expression: string
  fallback?: KnotId
}

/** A Thread — a connection between two knots */
export interface Thread {
  id: ThreadId
  source: KnotId
  target: KnotId
  label?: string
  gate?: GateCondition
  data: Record<string, unknown>
}

/** A Strand — a namespace grouping of knots */
export interface Strand {
  id: StrandId
  label: string
  knots: KnotId[]
}

/** A Threshold — trust/sandbox boundary */
export interface Threshold {
  id: string
  label: string
  boundary: KnotId[]
  permissions: string[]
}

/** Metadata for a Weave */
export interface WeaveMetadata {
  created: string
  modified: string
  version: number
  description?: string
}

/** A Weave — a complete program/graph (the woven fabric) */
export interface Weave {
  id: string
  name: string
  knots: Map<KnotId, Knot>
  threads: Map<ThreadId, Thread>
  strands: Map<StrandId, Strand>
  thresholds: Threshold[]
  metadata: WeaveMetadata
}

/** Input for creating a new Knot (id auto-generated if omitted) */
export interface KnotInput {
  id?: KnotId
  label: string
  type?: string
  position?: Position
  data?: Record<string, unknown>
  strand?: StrandId
}

/** Input for creating a new Thread (id auto-generated if omitted) */
export interface ThreadInput {
  id?: ThreadId
  label?: string
  gate?: GateCondition
  data?: Record<string, unknown>
}
