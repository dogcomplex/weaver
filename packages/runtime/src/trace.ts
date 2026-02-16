import type { Weave, KnotId } from '#weaver/core'
import { outgoing } from '#weaver/core'
import type { Wave, TraceResult, TraceStep, TraceError, TraceOptions } from './types.js'
import { createWave, advanceWave, blockWave, arriveWave, cloneWave } from './wave.js'
import { evaluateGate } from './gate-eval.js'

const DEFAULT_MAX_STEPS = 1000

/**
 * trace — Walk the weave from a start knot, flowing a wave through the graph.
 *
 * At each knot:
 * 1. Fire onEnterKnot hook
 * 2. Find all outgoing threads
 * 3. Evaluate gates on each thread
 * 4. For threads that pass: advance the wave to the target
 * 5. If multiple outgoing threads pass: clone the wave (branch/braid)
 * 6. If no outgoing threads: wave arrives (terminal)
 * 7. If all gates block: wave is blocked
 */
export function trace(
  weave: Weave,
  startKnot: KnotId,
  initialPayload: Record<string, unknown> = {},
  options: TraceOptions = {}
): TraceResult {
  const { maxSteps = DEFAULT_MAX_STEPS, hooks } = options
  const startTime = Date.now()

  const steps: TraceStep[] = []
  const finishedWaves: Wave[] = []
  const errors: TraceError[] = []

  if (!weave.knots.has(startKnot)) {
    errors.push({ knotId: startKnot, message: `Start knot "${startKnot}" not found` })
    return { steps, waves: finishedWaves, errors, duration: Date.now() - startTime }
  }

  // Queue of waves to process
  const queue: Wave[] = [createWave(initialPayload, startKnot)]

  let stepCount = 0

  while (queue.length > 0 && stepCount < maxSteps) {
    const wave = queue.shift()!
    const currentKnot = wave.path[wave.path.length - 1]

    hooks?.onEnterKnot?.(currentKnot, wave)

    const threads = outgoing(weave, currentKnot)

    if (threads.length === 0) {
      // Terminal knot — wave arrives
      const arrived = arriveWave(wave)
      finishedWaves.push(arrived)
      steps.push({
        knotId: currentKnot,
        wave: arrived,
        timestamp: Date.now(),
      })
      hooks?.onExitKnot?.(currentKnot, arrived)
      stepCount++
      continue
    }

    // Evaluate gates and collect passable threads
    const passable: typeof threads = []
    for (const t of threads) {
      if (t.gate) {
        const passed = evaluateGate(t.gate.expression, wave)
        hooks?.onGateEval?.(t.id, passed, t.gate.expression)

        steps.push({
          knotId: currentKnot,
          threadId: t.id,
          wave,
          gateResult: { passed, expression: t.gate.expression },
          timestamp: Date.now(),
        })

        if (passed) {
          passable.push(t)
        }
      } else {
        passable.push(t)
      }
    }

    if (passable.length === 0) {
      // All gates blocked
      const blocked = blockWave(wave)
      finishedWaves.push(blocked)
      steps.push({ knotId: currentKnot, wave: blocked, timestamp: Date.now() })
      hooks?.onExitKnot?.(currentKnot, blocked)
      stepCount++
      continue
    }

    // Branch: if multiple passable threads, clone the wave
    if (passable.length > 1) {
      hooks?.onBranch?.(currentKnot, passable.length)
    }

    for (const t of passable) {
      const nextWave = passable.length > 1 ? cloneWave(wave) : wave
      const advanced = advanceWave(nextWave, t.target)

      hooks?.onTraverseThread?.(t.id, advanced)

      steps.push({
        knotId: currentKnot,
        threadId: t.id,
        wave: advanced,
        timestamp: Date.now(),
      })

      queue.push(advanced)
    }

    hooks?.onExitKnot?.(currentKnot, wave)
    stepCount++
  }

  if (stepCount >= maxSteps) {
    errors.push({
      knotId: queue[0]?.path[queue[0].path.length - 1] ?? startKnot,
      message: `Trace exceeded max steps (${maxSteps})`,
    })
  }

  return {
    steps,
    waves: finishedWaves,
    errors,
    duration: Date.now() - startTime,
  }
}
