import type { Weave, KnotId } from '#weaver/core'
import type { TraceResult, TraceOptions, TraceStep } from './types.js'
import { trace } from './trace.js'

export type SpindleMode = 'immediate' | 'step'

/**
 * Spindle — scheduler that manages trace execution.
 *
 * Modes:
 * - 'immediate': Run the full trace at once, return the result
 * - 'step': Run one step at a time via next(), for step-through debugging
 */
export class Spindle {
  private weave: Weave
  private mode: SpindleMode
  private options: TraceOptions

  constructor(weave: Weave, mode: SpindleMode = 'immediate', options: TraceOptions = {}) {
    this.weave = weave
    this.mode = mode
    this.options = options
  }

  /** Run a full trace immediately */
  run(startKnot: KnotId, payload: Record<string, unknown> = {}): TraceResult {
    return trace(this.weave, startKnot, payload, this.options)
  }

  /** Create a step-by-step iterator for the trace */
  *steps(
    startKnot: KnotId,
    payload: Record<string, unknown> = {}
  ): Generator<TraceStep, TraceResult> {
    const result = trace(this.weave, startKnot, payload, this.options)
    for (const step of result.steps) {
      yield step
    }
    return result
  }
}
