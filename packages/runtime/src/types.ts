import type { KnotId, ThreadId } from '#weaver/core'

/** A Wave — data token flowing through the weave */
export interface Wave {
  id: string
  payload: Record<string, unknown>
  path: KnotId[]
  status: 'flowing' | 'blocked' | 'arrived' | 'merged'
}

/** Result of a single step in a trace */
export interface TraceStep {
  knotId: KnotId
  threadId?: ThreadId
  wave: Wave
  gateResult?: { passed: boolean; expression: string }
  timestamp: number
}

/** Complete result of tracing a path through a weave */
export interface TraceResult {
  steps: TraceStep[]
  waves: Wave[]
  errors: TraceError[]
  duration: number
}

/** Error encountered during tracing */
export interface TraceError {
  knotId: KnotId
  threadId?: ThreadId
  message: string
}

/** Hook callbacks for observing execution */
export interface TraceHooks {
  onEnterKnot?: (knotId: KnotId, wave: Wave) => void
  onExitKnot?: (knotId: KnotId, wave: Wave) => void
  onTraverseThread?: (threadId: ThreadId, wave: Wave) => void
  onGateEval?: (threadId: ThreadId, passed: boolean, expression: string) => void
  onBranch?: (knotId: KnotId, branchCount: number) => void
  onJoin?: (knotId: KnotId, waveCount: number) => void
  onError?: (error: TraceError) => void
}

/** Options for trace execution */
export interface TraceOptions {
  maxSteps?: number
  hooks?: TraceHooks
}
