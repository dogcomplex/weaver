import { describe, it, expect } from 'vitest'
import {
  createWeave,
  neighbors,
  incoming,
  outgoing,
  findPaths,
  detectCycles,
  toposort,
} from '../helpers.js'
import { mark, thread, knot } from '../operations.js'

function buildLinear(): ReturnType<typeof createWeave> {
  // A → B → C
  let w = createWeave('linear')
  w = mark(w, { id: 'a', label: 'A' })
  w = mark(w, { id: 'b', label: 'B' })
  w = mark(w, { id: 'c', label: 'C' })
  w = thread(w, 'a', 'b')
  w = thread(w, 'b', 'c')
  return w
}

function buildDiamond(): ReturnType<typeof createWeave> {
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
  return w
}

describe('createWeave', () => {
  it('creates an empty weave with correct name', () => {
    const w = createWeave('test')
    expect(w.name).toBe('test')
    expect(w.knots.size).toBe(0)
    expect(w.threads.size).toBe(0)
    expect(w.id).toBeTruthy()
    expect(w.metadata.version).toBe(1)
  })
})

describe('neighbors', () => {
  it('returns adjacent knots', () => {
    const w = buildLinear()
    const n = neighbors(w, 'b')
    const labels = n.map((k) => k.label).sort()
    expect(labels).toEqual(['A', 'C'])
  })

  it('returns empty for isolated knot', () => {
    let w = createWeave('test')
    w = mark(w, { id: 'a', label: 'A' })
    expect(neighbors(w, 'a')).toEqual([])
  })
})

describe('incoming', () => {
  it('returns threads pointing to a knot', () => {
    const w = buildDiamond()
    const inc = incoming(w, 'd')
    expect(inc.length).toBe(2)
    const sources = inc.map((t) => t.source).sort()
    expect(sources).toEqual(['b', 'c'])
  })
})

describe('outgoing', () => {
  it('returns threads leaving a knot', () => {
    const w = buildDiamond()
    const out = outgoing(w, 'a')
    expect(out.length).toBe(2)
    const targets = out.map((t) => t.target).sort()
    expect(targets).toEqual(['b', 'c'])
  })
})

describe('findPaths', () => {
  it('finds paths in a linear graph', () => {
    const w = buildLinear()
    const paths = findPaths(w, 'a', 'c')
    expect(paths.length).toBe(1)
    expect(paths[0]).toEqual(['a', 'b', 'c'])
  })

  it('finds multiple paths in a diamond', () => {
    const w = buildDiamond()
    const paths = findPaths(w, 'a', 'd')
    expect(paths.length).toBe(2)
    const sorted = paths.map((p) => p.join('-')).sort()
    expect(sorted).toEqual(['a-b-d', 'a-c-d'])
  })

  it('returns empty when no path exists', () => {
    const w = buildLinear()
    const paths = findPaths(w, 'c', 'a')
    expect(paths.length).toBe(0)
  })
})

describe('detectCycles', () => {
  it('returns empty for acyclic graph', () => {
    const w = buildLinear()
    const cycles = detectCycles(w)
    expect(cycles.length).toBe(0)
  })

  it('detects a cycle', () => {
    let w = buildLinear()
    w = knot(w, 'c', 'a') // close the loop
    const cycles = detectCycles(w)
    expect(cycles.length).toBeGreaterThan(0)
  })
})

describe('toposort', () => {
  it('returns topological order for acyclic graph', () => {
    const w = buildLinear()
    const order = toposort(w)
    expect(order).not.toBeNull()
    expect(order!.indexOf('a')).toBeLessThan(order!.indexOf('b'))
    expect(order!.indexOf('b')).toBeLessThan(order!.indexOf('c'))
  })

  it('returns topological order for diamond', () => {
    const w = buildDiamond()
    const order = toposort(w)
    expect(order).not.toBeNull()
    expect(order!.indexOf('a')).toBeLessThan(order!.indexOf('b'))
    expect(order!.indexOf('a')).toBeLessThan(order!.indexOf('c'))
    expect(order!.indexOf('b')).toBeLessThan(order!.indexOf('d'))
    expect(order!.indexOf('c')).toBeLessThan(order!.indexOf('d'))
  })

  it('returns null for cyclic graph', () => {
    let w = buildLinear()
    w = knot(w, 'c', 'a')
    const order = toposort(w)
    expect(order).toBeNull()
  })
})
