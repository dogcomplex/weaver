/**
 * Wave Animation Engine
 *
 * Converts a TraceResult into an AnimationTimeline that any renderer
 * can consume. Each trace step maps to a time slice where knots and
 * threads light up as waves flow through them.
 */

import type { TraceResult } from '#weaver/runtime'
import type {
  AnimationTimeline,
  AnimationEvent,
  KnotHighlight,
  ThreadHighlight,
} from './types.js'

/** Default animation colors */
const WAVE_COLOR = '#4af'
const GATE_PASS_COLOR = '#4a4'
const GATE_BLOCK_COLOR = '#c44'
const ARRIVE_COLOR = '#4a4'

export interface BuildTimelineOptions {
  /** Duration per trace step in ms (default: 500) */
  stepDuration?: number
}

/**
 * Build an AnimationTimeline from a TraceResult.
 *
 * Each step in the trace maps to a time slice in the timeline.
 * Knots light up as waves enter them; threads light up as waves traverse them.
 */
export function buildTimeline(
  traceResult: TraceResult,
  options: BuildTimelineOptions = {},
): AnimationTimeline {
  const { stepDuration = 500 } = options
  const totalSteps = traceResult.steps.length

  if (totalSteps === 0) {
    return { duration: 0, knotEvents: [], threadEvents: [] }
  }

  const duration = totalSteps * stepDuration
  const knotEvents: AnimationEvent<KnotHighlight>[] = []
  const threadEvents: AnimationEvent<ThreadHighlight>[] = []

  for (let i = 0; i < totalSteps; i++) {
    const step = traceResult.steps[i]
    const start = i / totalSteps
    const end = (i + 1) / totalSteps

    // Determine knot highlight color
    let color = WAVE_COLOR
    let pulse = false
    if (step.gateResult) {
      color = step.gateResult.passed ? GATE_PASS_COLOR : GATE_BLOCK_COLOR
      pulse = true
    }
    if (step.wave.status === 'arrived') {
      color = ARRIVE_COLOR
    }

    knotEvents.push({
      targetId: step.knotId,
      start,
      end,
      state: { color, intensity: 1, pulse },
    })

    // Thread highlight if this step traversed a thread
    if (step.threadId) {
      threadEvents.push({
        targetId: step.threadId,
        start,
        end,
        state: { color: WAVE_COLOR, progress: 1, width: 3 },
      })
    }
  }

  return { duration, knotEvents, threadEvents }
}

/**
 * Given a timeline and a progress value (0-1), compute the current
 * highlight state for all knots and threads.
 */
export function interpolateHighlights(
  timeline: AnimationTimeline,
  progress: number,
): { knots: Map<string, KnotHighlight>; threads: Map<string, ThreadHighlight> } {
  const knots = new Map<string, KnotHighlight>()
  const threads = new Map<string, ThreadHighlight>()

  for (const event of timeline.knotEvents) {
    if (progress >= event.start && progress < event.end) {
      knots.set(event.targetId, event.state)
    }
  }

  for (const event of timeline.threadEvents) {
    if (progress >= event.start && progress < event.end) {
      const localProgress = (progress - event.start) / (event.end - event.start)
      threads.set(event.targetId, {
        ...event.state,
        progress: localProgress,
      })
    }
  }

  return { knots, threads }
}
