import { describe, it, expect } from 'vitest'
import { buildTimeline, interpolateHighlights } from '../animation.js'
import type { TraceResult, TraceStep, Wave } from '#weaver/runtime'

function makeWave(overrides: Partial<Wave> = {}): Wave {
  return {
    id: 'w1',
    payload: {},
    path: [],
    status: 'flowing',
    ...overrides,
  }
}

function makeStep(overrides: Partial<TraceStep> = {}): TraceStep {
  return {
    knotId: 'k1',
    wave: makeWave(),
    timestamp: Date.now(),
    ...overrides,
  }
}

function makeTraceResult(steps: TraceStep[] = []): TraceResult {
  return {
    steps,
    waves: steps.map(s => s.wave),
    errors: [],
    duration: steps.length * 500,
  }
}

describe('buildTimeline', () => {
  it('returns empty timeline for empty trace', () => {
    const timeline = buildTimeline(makeTraceResult())
    expect(timeline.duration).toBe(0)
    expect(timeline.knotEvents).toHaveLength(0)
    expect(timeline.threadEvents).toHaveLength(0)
  })

  it('creates one knot event per trace step', () => {
    const steps = [
      makeStep({ knotId: 'k1' }),
      makeStep({ knotId: 'k2' }),
      makeStep({ knotId: 'k3' }),
    ]
    const timeline = buildTimeline(makeTraceResult(steps))
    expect(timeline.knotEvents).toHaveLength(3)
    expect(timeline.knotEvents[0].targetId).toBe('k1')
    expect(timeline.knotEvents[1].targetId).toBe('k2')
    expect(timeline.knotEvents[2].targetId).toBe('k3')
  })

  it('creates thread events when threadId is present', () => {
    const steps = [
      makeStep({ knotId: 'k1', threadId: 't1' }),
      makeStep({ knotId: 'k2' }), // no thread
      makeStep({ knotId: 'k3', threadId: 't2' }),
    ]
    const timeline = buildTimeline(makeTraceResult(steps))
    expect(timeline.threadEvents).toHaveLength(2)
    expect(timeline.threadEvents[0].targetId).toBe('t1')
    expect(timeline.threadEvents[1].targetId).toBe('t2')
  })

  it('uses default wave color (#4af) for normal steps', () => {
    const timeline = buildTimeline(makeTraceResult([makeStep()]))
    expect(timeline.knotEvents[0].state.color).toBe('#4af')
    expect(timeline.knotEvents[0].state.pulse).toBe(false)
  })

  it('uses green for gate-pass steps', () => {
    const step = makeStep({
      gateResult: { passed: true, expression: 'x > 0' },
    })
    const timeline = buildTimeline(makeTraceResult([step]))
    expect(timeline.knotEvents[0].state.color).toBe('#4a4')
    expect(timeline.knotEvents[0].state.pulse).toBe(true)
  })

  it('uses red for gate-block steps', () => {
    const step = makeStep({
      gateResult: { passed: false, expression: 'x > 0' },
    })
    const timeline = buildTimeline(makeTraceResult([step]))
    expect(timeline.knotEvents[0].state.color).toBe('#c44')
    expect(timeline.knotEvents[0].state.pulse).toBe(true)
  })

  it('uses green for arrived waves', () => {
    const step = makeStep({
      wave: makeWave({ status: 'arrived' }),
    })
    const timeline = buildTimeline(makeTraceResult([step]))
    expect(timeline.knotEvents[0].state.color).toBe('#4a4')
  })

  it('evenly divides time across steps', () => {
    const steps = [
      makeStep({ knotId: 'k1' }),
      makeStep({ knotId: 'k2' }),
      makeStep({ knotId: 'k3' }),
      makeStep({ knotId: 'k4' }),
    ]
    const timeline = buildTimeline(makeTraceResult(steps))
    expect(timeline.knotEvents[0].start).toBe(0)
    expect(timeline.knotEvents[0].end).toBeCloseTo(0.25)
    expect(timeline.knotEvents[1].start).toBeCloseTo(0.25)
    expect(timeline.knotEvents[1].end).toBeCloseTo(0.5)
    expect(timeline.knotEvents[3].start).toBeCloseTo(0.75)
    expect(timeline.knotEvents[3].end).toBeCloseTo(1)
  })

  it('respects custom stepDuration', () => {
    const steps = [makeStep(), makeStep()]
    const timeline = buildTimeline(makeTraceResult(steps), { stepDuration: 1000 })
    expect(timeline.duration).toBe(2000)
  })

  it('default stepDuration is 500ms', () => {
    const steps = [makeStep(), makeStep(), makeStep()]
    const timeline = buildTimeline(makeTraceResult(steps))
    expect(timeline.duration).toBe(1500)
  })
})

describe('interpolateHighlights', () => {
  const steps = [
    makeStep({ knotId: 'k1', threadId: 't1' }),
    makeStep({ knotId: 'k2', threadId: 't2' }),
    makeStep({ knotId: 'k3' }),
  ]
  const timeline = buildTimeline(makeTraceResult(steps))

  it('at progress=0, highlights first step', () => {
    const { knots, threads } = interpolateHighlights(timeline, 0)
    expect(knots.has('k1')).toBe(true)
    expect(knots.has('k2')).toBe(false)
    expect(threads.has('t1')).toBe(true)
  })

  it('at progress=0.5, highlights second step', () => {
    const { knots, threads } = interpolateHighlights(timeline, 0.5)
    expect(knots.has('k1')).toBe(false)
    expect(knots.has('k2')).toBe(true)
    expect(threads.has('t2')).toBe(true)
  })

  it('at progress=0.8, highlights third step', () => {
    const { knots } = interpolateHighlights(timeline, 0.8)
    expect(knots.has('k3')).toBe(true)
    expect(knots.has('k1')).toBe(false)
  })

  it('at progress=1.0 (past end), returns empty', () => {
    const { knots, threads } = interpolateHighlights(timeline, 1.0)
    expect(knots.size).toBe(0)
    expect(threads.size).toBe(0)
  })

  it('thread progress is interpolated locally within the event', () => {
    // At progress 0.166 (midpoint of first step [0, 0.333])
    const { threads } = interpolateHighlights(timeline, 0.166)
    const t1 = threads.get('t1')
    expect(t1).toBeDefined()
    // Local progress should be ~0.5 (halfway through the first step)
    expect(t1!.progress).toBeGreaterThan(0.3)
    expect(t1!.progress).toBeLessThan(0.7)
  })
})
