import { describe, it, expect } from 'vitest'
import { createWeave } from '../helpers.js'
import {
  mark, thread, branch, join, span, knot,
  gate, veil, reveal, snip, cut,
} from '../operations.js'

describe('mark', () => {
  it('adds a knot to an empty weave', () => {
    const w = createWeave('test')
    const w2 = mark(w, { label: 'A' })
    expect(w2.knots.size).toBe(1)
    const k = Array.from(w2.knots.values())[0]
    expect(k.label).toBe('A')
    expect(k.type).toBe('default')
  })

  it('does not mutate the original weave', () => {
    const w = createWeave('test')
    const w2 = mark(w, { label: 'A' })
    expect(w.knots.size).toBe(0)
    expect(w2.knots.size).toBe(1)
  })

  it('uses provided id when given', () => {
    const w = createWeave('test')
    const w2 = mark(w, { id: 'custom-id', label: 'B' })
    expect(w2.knots.has('custom-id')).toBe(true)
  })

  it('increments metadata version', () => {
    const w = createWeave('test')
    const w2 = mark(w, { label: 'A' })
    expect(w2.metadata.version).toBe(w.metadata.version + 1)
  })
})

describe('thread', () => {
  it('connects two knots', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    const w2 = thread(w, 'a', 'b')
    expect(w2.threads.size).toBe(1)
    const t = Array.from(w2.threads.values())[0]
    expect(t.source).toBe('a')
    expect(t.target).toBe('b')
  })

  it('throws for missing source knot', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'b', label: 'B' })
    expect(() => thread(w, 'missing', 'b')).toThrow('Source knot')
  })

  it('throws for missing target knot', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    expect(() => thread(w, 'a', 'missing')).toThrow('Target knot')
  })
})

describe('branch', () => {
  it('creates threads from source to all targets', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    const w2 = branch(w, 'a', ['b', 'c'])
    expect(w2.threads.size).toBe(2)
    const threads = Array.from(w2.threads.values())
    expect(threads.every((t) => t.source === 'a')).toBe(true)
    const targets = threads.map((t) => t.target).sort()
    expect(targets).toEqual(['b', 'c'])
  })
})

describe('join', () => {
  it('creates threads from all sources to target', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    const w2 = join(w, ['a', 'b'], 'c')
    expect(w2.threads.size).toBe(2)
    const threads = Array.from(w2.threads.values())
    expect(threads.every((t) => t.target === 'c')).toBe(true)
  })
})

describe('span', () => {
  it('bridges two knots', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    const w2 = span(w, 'a', 'b')
    expect(w2.threads.size).toBe(1)
  })
})

describe('knot (cycle)', () => {
  it('closes a cycle', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b')
    const w2 = knot(w, 'b', 'a')
    expect(w2.threads.size).toBe(2)
    const threads = Array.from(w2.threads.values())
    const cycle = threads.find((t) => t.source === 'b' && t.target === 'a')
    expect(cycle).toBeDefined()
  })
})

describe('gate', () => {
  it('adds a condition to a thread', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    const w2 = gate(w, 't1', { expression: 'x > 5' })
    const t = w2.threads.get('t1')!
    expect(t.gate).toBeDefined()
    expect(t.gate!.expression).toBe('x > 5')
  })

  it('throws for missing thread', () => {
    const w = createWeave('test')
    expect(() => gate(w, 'missing', { expression: 'x' })).toThrow('Thread')
  })

  it('does not mutate original thread', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    gate(w, 't1', { expression: 'x > 5' })
    expect(w.threads.get('t1')!.gate).toBeUndefined()
  })
})

describe('veil & reveal', () => {
  it('veils knots into a composite and reveals them back', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    w = thread(w, 'a', 'b', { id: 'ab' })
    w = thread(w, 'b', 'c', { id: 'bc' })

    // Veil a and b
    const veiled = veil(w, ['a', 'b'])
    expect(veiled.knots.size).toBe(2) // composite + c
    expect(veiled.knots.has('a')).toBe(false)
    expect(veiled.knots.has('b')).toBe(false)
    expect(veiled.threads.has('ab')).toBe(false)

    // Find the composite
    const composite = Array.from(veiled.knots.values()).find(
      (k) => k.type === 'veiled'
    )!
    expect(composite).toBeDefined()
    expect(composite.data.__veiled).toBe(true)

    // Reveal it back
    const revealed = reveal(veiled, composite.id)
    expect(revealed.knots.has('a')).toBe(true)
    expect(revealed.knots.has('b')).toBe(true)
    expect(revealed.threads.has('ab')).toBe(true)
  })

  it('throws when veiling empty set', () => {
    const w = createWeave('test')
    expect(() => veil(w, [])).toThrow('empty')
  })

  it('throws when revealing non-veiled knot', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    expect(() => reveal(w, 'a')).toThrow('not a veiled')
  })
})

describe('snip', () => {
  it('removes a thread', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    const w2 = snip(w, 't1')
    expect(w2.threads.size).toBe(0)
  })

  it('does not remove the knots', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b', { id: 't1' })
    const w2 = snip(w, 't1')
    expect(w2.knots.size).toBe(2)
  })

  it('throws for missing thread', () => {
    const w = createWeave('test')
    expect(() => snip(w, 'missing')).toThrow('Thread')
  })
})

describe('cut', () => {
  it('removes a knot and all its threads', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = mark(w, { id: 'c', label: 'C' })
    w = thread(w, 'a', 'b')
    w = thread(w, 'b', 'c')
    const w2 = cut(w, 'b')
    expect(w2.knots.size).toBe(2)
    expect(w2.knots.has('b')).toBe(false)
    expect(w2.threads.size).toBe(0) // both threads touched b
  })

  it('throws for missing knot', () => {
    const w = createWeave('test')
    expect(() => cut(w, 'missing')).toThrow('Knot')
  })

  it('does not mutate original', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    w = mark(w, { id: 'b', label: 'B' })
    w = thread(w, 'a', 'b')
    cut(w, 'a')
    expect(w.knots.size).toBe(2)
    expect(w.threads.size).toBe(1)
  })
})
