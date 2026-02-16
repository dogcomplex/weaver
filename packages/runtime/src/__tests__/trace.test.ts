import { describe, it, expect } from 'vitest'
import { createWeave } from '#weaver/core'
import { mark, thread, gate as addGate, branch as branchOp } from '#weaver/core'
import { trace } from '../trace.js'

describe('trace', () => {
  it('traces a linear path', () => {
    let w = createWeave('linear')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    w = thread(w, 'a', 'b')
    w = thread(w, 'b', 'c')

    const result = trace(w, 'a', { x: 1 })
    expect(result.errors).toHaveLength(0)
    expect(result.waves).toHaveLength(1)
    expect(result.waves[0].status).toBe('arrived')
    expect(result.waves[0].path).toContain('a')
    expect(result.waves[0].path).toContain('c')
  })

  it('traces with a passing gate', () => {
    let w = createWeave('gated-pass')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    w = addGate(w, 't1', { expression: 'x > 5' })

    const result = trace(w, 'a', { x: 10 })
    expect(result.errors).toHaveLength(0)
    expect(result.waves).toHaveLength(1)
    expect(result.waves[0].status).toBe('arrived')
  })

  it('blocks wave when gate fails', () => {
    let w = createWeave('gated-block')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    w = addGate(w, 't1', { expression: 'x > 5' })

    const result = trace(w, 'a', { x: 2 })
    expect(result.waves).toHaveLength(1)
    expect(result.waves[0].status).toBe('blocked')
  })

  it('branches into multiple waves at fork', () => {
    let w = createWeave('branching')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    w = branchOp(w, 'a', ['b', 'c'])

    const result = trace(w, 'a')
    expect(result.errors).toHaveLength(0)
    expect(result.waves).toHaveLength(2)
    expect(result.waves.every((wave) => wave.status === 'arrived')).toBe(true)
  })

  it('handles diamond pattern', () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    let w = createWeave('diamond')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    w = mark(w, { id: 'd', label: 'D' })
    w = thread(w, 'a', 'b')
    w = thread(w, 'a', 'c')
    w = thread(w, 'b', 'd')
    w = thread(w, 'c', 'd')

    const result = trace(w, 'a')
    expect(result.errors).toHaveLength(0)
    // Two waves arrive at D (one via B, one via C)
    expect(result.waves).toHaveLength(2)
  })

  it('respects max steps', () => {
    let w = createWeave('cycle')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b')
    w = thread(w, 'b', 'a') // cycle

    const result = trace(w, 'a', {}, { maxSteps: 10 })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('max steps')
  })

  it('errors on missing start knot', () => {
    const w = createWeave('empty')
    const result = trace(w, 'missing')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('not found')
  })

  it('arrives immediately at terminal knot', () => {
    let w = createWeave('terminal')
    w = mark(w, { id: 'a', label: 'A' })

    const result = trace(w, 'a', { data: 'test' })
    expect(result.waves).toHaveLength(1)
    expect(result.waves[0].status).toBe('arrived')
    expect(result.waves[0].payload.data).toBe('test')
  })

  it('fires hooks during tracing', () => {
    let w = createWeave('hooked')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b')

    const entered: string[] = []
    const result = trace(w, 'a', {}, {
      hooks: {
        onEnterKnot: (knotId) => entered.push(knotId),
      },
    })

    expect(entered).toContain('a')
    expect(entered).toContain('b')
    expect(result.errors).toHaveLength(0)
  })
})
