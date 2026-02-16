import { v4 as uuid } from 'uuid'
import type {
  Weave,
  Knot,
  Thread,
  KnotId,
  WeaveMetadata,
} from './types.js'

/** Create an empty Weave with the given name */
export function createWeave(name: string, id?: string): Weave {
  const now = new Date().toISOString()
  return {
    id: id ?? uuid(),
    name,
    knots: new Map(),
    threads: new Map(),
    strands: new Map(),
    thresholds: [],
    metadata: {
      created: now,
      modified: now,
      version: 1,
      description: undefined,
    },
  }
}

/** Deep-clone a Weave (for immutability) */
export function cloneWeave(weave: Weave): Weave {
  return {
    ...weave,
    knots: new Map(
      Array.from(weave.knots.entries()).map(([k, v]) => [k, { ...v, data: { ...v.data } }])
    ),
    threads: new Map(
      Array.from(weave.threads.entries()).map(([k, v]) => [
        k,
        { ...v, data: { ...v.data }, gate: v.gate ? { ...v.gate } : undefined },
      ])
    ),
    strands: new Map(
      Array.from(weave.strands.entries()).map(([k, v]) => [k, { ...v, knots: [...v.knots] }])
    ),
    thresholds: weave.thresholds.map((t) => ({
      ...t,
      boundary: [...t.boundary],
      permissions: [...t.permissions],
    })),
    metadata: { ...weave.metadata },
  }
}

/** Update metadata timestamp and version */
export function touchMetadata(metadata: WeaveMetadata): WeaveMetadata {
  return {
    ...metadata,
    modified: new Date().toISOString(),
    version: metadata.version + 1,
  }
}

/** Get all knots adjacent to the given knot (via any thread direction) */
export function neighbors(weave: Weave, knotId: KnotId): Knot[] {
  const ids = new Set<KnotId>()
  for (const thread of weave.threads.values()) {
    if (thread.source === knotId) ids.add(thread.target)
    if (thread.target === knotId) ids.add(thread.source)
  }
  return Array.from(ids)
    .map((id) => weave.knots.get(id))
    .filter((k): k is Knot => k !== undefined)
}

/** Get all threads pointing TO the given knot */
export function incoming(weave: Weave, knotId: KnotId): Thread[] {
  return Array.from(weave.threads.values()).filter((t) => t.target === knotId)
}

/** Get all threads leaving FROM the given knot */
export function outgoing(weave: Weave, knotId: KnotId): Thread[] {
  return Array.from(weave.threads.values()).filter((t) => t.source === knotId)
}

/** Find all paths between two knots (BFS, returns arrays of KnotIds) */
export function findPaths(
  weave: Weave,
  from: KnotId,
  to: KnotId,
  maxDepth: number = 20
): KnotId[][] {
  const results: KnotId[][] = []
  const queue: { path: KnotId[] }[] = [{ path: [from] }]

  while (queue.length > 0) {
    const { path } = queue.shift()!
    const current = path[path.length - 1]

    if (current === to && path.length > 1) {
      results.push(path)
      continue
    }

    if (path.length > maxDepth) continue

    for (const thread of outgoing(weave, current)) {
      if (!path.includes(thread.target)) {
        queue.push({ path: [...path, thread.target] })
      }
    }
  }

  return results
}

/** Detect all cycles in the weave (returns arrays of KnotIds forming cycles) */
export function detectCycles(weave: Weave): KnotId[][] {
  const cycles: KnotId[][] = []
  const visited = new Set<KnotId>()
  const stack = new Set<KnotId>()

  function dfs(knotId: KnotId, path: KnotId[]): void {
    visited.add(knotId)
    stack.add(knotId)

    for (const thread of outgoing(weave, knotId)) {
      if (stack.has(thread.target)) {
        const cycleStart = path.indexOf(thread.target)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), thread.target])
        }
      } else if (!visited.has(thread.target)) {
        dfs(thread.target, [...path, thread.target])
      }
    }

    stack.delete(knotId)
  }

  for (const knotId of weave.knots.keys()) {
    if (!visited.has(knotId)) {
      dfs(knotId, [knotId])
    }
  }

  return cycles
}

/** Topological sort of the weave (only valid if acyclic). Returns null if cycles exist. */
export function toposort(weave: Weave): KnotId[] | null {
  const inDegree = new Map<KnotId, number>()
  for (const knotId of weave.knots.keys()) {
    inDegree.set(knotId, 0)
  }
  for (const thread of weave.threads.values()) {
    inDegree.set(thread.target, (inDegree.get(thread.target) ?? 0) + 1)
  }

  const queue: KnotId[] = []
  for (const [knotId, degree] of inDegree) {
    if (degree === 0) queue.push(knotId)
  }

  const result: KnotId[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    for (const thread of outgoing(weave, current)) {
      const newDegree = (inDegree.get(thread.target) ?? 1) - 1
      inDegree.set(thread.target, newDegree)
      if (newDegree === 0) queue.push(thread.target)
    }
  }

  return result.length === weave.knots.size ? result : null
}
