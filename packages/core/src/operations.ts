import { v4 as uuid } from 'uuid'
import type {
  Weave,
  Knot,
  KnotId,
  ThreadId,
  GateCondition,
  KnotInput,
  ThreadInput,
} from './types.js'
import { cloneWeave, touchMetadata } from './helpers.js'

/**
 * mark — Place a new knot in the weave.
 * Returns a new Weave with the knot added.
 */
export function mark(weave: Weave, input: KnotInput): Weave {
  const next = cloneWeave(weave)
  const knot: Knot = {
    id: input.id ?? uuid(),
    label: input.label,
    type: input.type ?? 'default',
    position: input.position ?? { x: 0, y: 0 },
    data: input.data ?? {},
    strand: input.strand,
  }
  next.knots.set(knot.id, knot)
  next.metadata = touchMetadata(next.metadata)
  return next
}

/**
 * thread — Connect two knots with a new thread.
 * Returns a new Weave with the thread added.
 */
export function thread(
  weave: Weave,
  source: KnotId,
  target: KnotId,
  input?: ThreadInput
): Weave {
  if (!weave.knots.has(source)) {
    throw new Error(`Source knot "${source}" not found in weave`)
  }
  if (!weave.knots.has(target)) {
    throw new Error(`Target knot "${target}" not found in weave`)
  }
  const next = cloneWeave(weave)
  const t = {
    id: input?.id ?? uuid(),
    source,
    target,
    label: input?.label,
    gate: input?.gate,
    data: input?.data ?? {},
  }
  next.threads.set(t.id, t)
  next.metadata = touchMetadata(next.metadata)
  return next
}

/**
 * branch — Fork flow from one knot to multiple targets.
 * Creates a thread from source to each target.
 */
export function branch(
  weave: Weave,
  source: KnotId,
  targets: KnotId[],
  input?: ThreadInput
): Weave {
  let next = weave
  for (const target of targets) {
    next = thread(next, source, target, input)
  }
  return next
}

/**
 * join — Merge multiple paths into one knot.
 * Creates a thread from each source to the target.
 */
export function join(
  weave: Weave,
  sources: KnotId[],
  target: KnotId,
  input?: ThreadInput
): Weave {
  let next = weave
  for (const source of sources) {
    next = thread(next, source, target, input)
  }
  return next
}

/**
 * span — Bridge two disconnected knots.
 * Same as thread but semantically indicates spanning a gap.
 */
export function span(
  weave: Weave,
  source: KnotId,
  target: KnotId,
  input?: ThreadInput
): Weave {
  return thread(weave, source, target, input)
}

/**
 * knot — Close a cycle by creating an edge back to a previous knot.
 */
export function knot(
  weave: Weave,
  source: KnotId,
  target: KnotId,
  input?: ThreadInput
): Weave {
  return thread(weave, source, target, input)
}

/**
 * gate — Add a condition to an existing thread.
 * The thread only allows passage when the condition is met.
 */
export function gate(
  weave: Weave,
  threadId: ThreadId,
  condition: GateCondition
): Weave {
  const existing = weave.threads.get(threadId)
  if (!existing) {
    throw new Error(`Thread "${threadId}" not found in weave`)
  }
  const next = cloneWeave(weave)
  next.threads.set(threadId, { ...existing, gate: condition })
  next.metadata = touchMetadata(next.metadata)
  return next
}

/**
 * veil — Abstract a subgraph behind a single composite knot.
 * The selected knots and their internal threads are replaced with one knot
 * that stores the veiled subgraph in its data.
 */
export function veil(weave: Weave, knotIds: KnotId[]): Weave {
  if (knotIds.length === 0) {
    throw new Error('Cannot veil an empty set of knots')
  }
  const knotSet = new Set(knotIds)

  // Collect the veiled knots and internal threads
  const veiledKnots: Knot[] = []
  for (const id of knotIds) {
    const k = weave.knots.get(id)
    if (!k) throw new Error(`Knot "${id}" not found in weave`)
    veiledKnots.push(k)
  }

  const next = cloneWeave(weave)
  const internalThreads: typeof weave.threads extends Map<string, infer T> ? T[] : never = []
  const externalThreads: { thread: ReturnType<typeof weave.threads.get>; side: 'source' | 'target' }[] = []

  for (const [tid, t] of next.threads) {
    const sourceIn = knotSet.has(t.source)
    const targetIn = knotSet.has(t.target)
    if (sourceIn && targetIn) {
      internalThreads.push(t)
      next.threads.delete(tid)
    } else if (sourceIn) {
      externalThreads.push({ thread: t, side: 'source' })
    } else if (targetIn) {
      externalThreads.push({ thread: t, side: 'target' })
    }
  }

  // Remove veiled knots
  for (const id of knotIds) {
    next.knots.delete(id)
  }

  // Create composite knot
  const compositeId = uuid()
  const avgX = veiledKnots.reduce((s, k) => s + k.position.x, 0) / veiledKnots.length
  const avgY = veiledKnots.reduce((s, k) => s + k.position.y, 0) / veiledKnots.length

  const composite: Knot = {
    id: compositeId,
    label: `Veiled (${veiledKnots.length} knots)`,
    type: 'veiled',
    position: { x: avgX, y: avgY },
    data: {
      __veiled: true,
      __veiledKnots: veiledKnots,
      __veiledThreads: internalThreads,
    },
  }
  next.knots.set(compositeId, composite)

  // Repoint external threads to the composite
  for (const { thread: t, side } of externalThreads) {
    if (t) {
      if (side === 'source') t.source = compositeId
      else t.target = compositeId
    }
  }

  next.metadata = touchMetadata(next.metadata)
  return next
}

/**
 * reveal — Expand a veiled composite knot back to its subgraph.
 */
export function reveal(weave: Weave, compositeKnotId: KnotId): Weave {
  const composite = weave.knots.get(compositeKnotId)
  if (!composite) {
    throw new Error(`Knot "${compositeKnotId}" not found in weave`)
  }
  if (!composite.data.__veiled) {
    throw new Error(`Knot "${compositeKnotId}" is not a veiled composite`)
  }

  const next = cloneWeave(weave)
  const veiledKnots = composite.data.__veiledKnots as Knot[]
  const veiledThreads = composite.data.__veiledThreads as Array<{
    id: string; source: string; target: string; label?: string;
    gate?: GateCondition; data: Record<string, unknown>
  }>

  // Restore the veiled knots
  for (const k of veiledKnots) {
    next.knots.set(k.id, { ...k, data: { ...k.data } })
  }

  // Restore internal threads
  for (const t of veiledThreads) {
    next.threads.set(t.id, { ...t, data: { ...t.data } })
  }

  // Repoint external threads back to the original knots
  // Threads that pointed to/from the composite need to find their original knot
  const veiledKnotIds = new Set(veiledKnots.map((k) => k.id))
  for (const t of next.threads.values()) {
    if (t.source === compositeKnotId) {
      // Find a veiled knot that had an outgoing thread to this target
      const original = veiledThreads.find((vt) => veiledKnotIds.has(vt.source))
      if (original) t.source = original.source
    }
    if (t.target === compositeKnotId) {
      const original = veiledThreads.find((vt) => veiledKnotIds.has(vt.target))
      if (original) t.target = original.target
    }
  }

  // Remove the composite
  next.knots.delete(compositeKnotId)
  next.metadata = touchMetadata(next.metadata)
  return next
}

/**
 * snip — Remove a thread from the weave.
 */
export function snip(weave: Weave, threadId: ThreadId): Weave {
  if (!weave.threads.has(threadId)) {
    throw new Error(`Thread "${threadId}" not found in weave`)
  }
  const next = cloneWeave(weave)
  next.threads.delete(threadId)
  next.metadata = touchMetadata(next.metadata)
  return next
}

/**
 * cut — Remove a knot and all its connected threads from the weave.
 */
export function cut(weave: Weave, knotId: KnotId): Weave {
  if (!weave.knots.has(knotId)) {
    throw new Error(`Knot "${knotId}" not found in weave`)
  }
  const next = cloneWeave(weave)
  next.knots.delete(knotId)

  // Remove all threads connected to this knot
  for (const [tid, t] of next.threads) {
    if (t.source === knotId || t.target === knotId) {
      next.threads.delete(tid)
    }
  }

  // Remove from any strands
  for (const strand of next.strands.values()) {
    strand.knots = strand.knots.filter((id) => id !== knotId)
  }

  // Remove from any thresholds
  for (const threshold of next.thresholds) {
    threshold.boundary = threshold.boundary.filter((id) => id !== knotId)
  }

  next.metadata = touchMetadata(next.metadata)
  return next
}
