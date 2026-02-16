import type { Weave, KnotId } from '#weaver/core'
import type { TraceResult, TraceOptions } from './types.js'
import { trace } from './trace.js'

/**
 * Braid — concurrent execution of multiple traces through a weave.
 *
 * Runs multiple traces in parallel (via Promise.all) from different
 * start knots or with different payloads.
 */
export class Braid {
  private weave: Weave
  private options: TraceOptions

  constructor(weave: Weave, options: TraceOptions = {}) {
    this.weave = weave
    this.options = options
  }

  /** Run multiple traces concurrently */
  async run(
    entries: Array<{
      startKnot: KnotId
      payload?: Record<string, unknown>
    }>
  ): Promise<TraceResult[]> {
    const promises = entries.map(({ startKnot, payload }) =>
      Promise.resolve(trace(this.weave, startKnot, payload ?? {}, this.options))
    )
    return Promise.all(promises)
  }

  /** Run a single trace, but allow branching waves to execute concurrently */
  runBraided(
    startKnot: KnotId,
    payload: Record<string, unknown> = {}
  ): TraceResult {
    // For now, branching is handled within trace() itself.
    // This method exists as the API surface for future async/streaming execution.
    return trace(this.weave, startKnot, payload, this.options)
  }
}
