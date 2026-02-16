import { describe, it, expect } from 'vitest'
import { createWeave } from '../helpers.js'
import { mark, thread, gate } from '../operations.js'
import { serializeWeave, deserializeWeave } from '../serialization.js'

describe('serialization', () => {
  it('round-trips an empty weave', () => {
    const w = createWeave('empty')
    const json = serializeWeave(w)
    const w2 = deserializeWeave(json)
    expect(w2.id).toBe(w.id)
    expect(w2.name).toBe('empty')
    expect(w2.knots.size).toBe(0)
    expect(w2.threads.size).toBe(0)
  })

  it('round-trips a weave with knots and threads', () => {
    let w = createWeave('complex')
    w = mark(w, { id: 'a', label: 'A', type: 'action', position: { x: 10, y: 20 } })
    w = mark(w, { id: 'b', label: 'B', data: { foo: 'bar' } })
    w = thread(w, 'a', 'b', { id: 't1', label: 'flow' })

    const json = serializeWeave(w)
    const w2 = deserializeWeave(json)

    expect(w2.knots.size).toBe(2)
    expect(w2.threads.size).toBe(1)

    const knot = w2.knots.get('a')!
    expect(knot.label).toBe('A')
    expect(knot.type).toBe('action')
    expect(knot.position).toEqual({ x: 10, y: 20 })

    const knotB = w2.knots.get('b')!
    expect(knotB.data.foo).toBe('bar')

    const t = w2.threads.get('t1')!
    expect(t.source).toBe('a')
    expect(t.target).toBe('b')
    expect(t.label).toBe('flow')
  })

  it('round-trips gates', () => {
    let w = createWeave('gated')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    w = gate(w, 't1', { expression: 'x > 5', fallback: 'a' })

    const json = serializeWeave(w)
    const w2 = deserializeWeave(json)

    const t = w2.threads.get('t1')!
    expect(t.gate).toBeDefined()
    expect(t.gate!.expression).toBe('x > 5')
    expect(t.gate!.fallback).toBe('a')
  })

  it('preserves metadata', () => {
    const w = createWeave('meta')
    const json = serializeWeave(w)
    const w2 = deserializeWeave(json)

    expect(w2.metadata.created).toBe(w.metadata.created)
    expect(w2.metadata.version).toBe(w.metadata.version)
  })

  it('produces valid JSON', () => {
    let w = createWeave('json-check')
    w = mark(w, { id: 'a', label: 'A' })
    const json = serializeWeave(w)
    expect(() => JSON.parse(json)).not.toThrow()
  })
})
