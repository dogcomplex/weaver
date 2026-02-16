import fs from 'fs/promises'
import path from 'path'
import {
  createWeave,
  mark,
  thread,
  branch,
  join,
  span,
  knot,
  gate,
  veil,
  reveal,
  snip,
  cut,
  serializeWeave,
  deserializeWeave,
  type KnotInput,
  type KnotId,
  type ThreadId,
  type ThreadInput,
  type GateCondition,
  type Weave,
} from '#weaver/core'

const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')

async function ensureDir(): Promise<void> {
  await fs.mkdir(GRAPHS_DIR, { recursive: true })
}

async function loadWeave(id: string): Promise<Weave> {
  const filepath = path.join(GRAPHS_DIR, `${id}.weave.json`)
  const content = await fs.readFile(filepath, 'utf-8')
  return deserializeWeave(content)
}

async function saveWeave(weave: Weave): Promise<void> {
  await ensureDir()
  const filepath = path.join(GRAPHS_DIR, `${weave.id}.weave.json`)
  await fs.writeFile(filepath, serializeWeave(weave), 'utf-8')
}

/** Create a new empty weave and save it */
export async function toolCreateWeave(name: string): Promise<Weave> {
  const weave = createWeave(name)
  await saveWeave(weave)
  return weave
}

/** Mark a new knot in a saved weave */
export async function toolMark(weaveId: string, input: KnotInput): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = mark(weave, input)
  await saveWeave(next)
  return next
}

/** Thread two knots in a saved weave */
export async function toolThread(
  weaveId: string,
  source: KnotId,
  target: KnotId,
  input?: ThreadInput
): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = thread(weave, source, target, input)
  await saveWeave(next)
  return next
}

/** Branch from one knot to many */
export async function toolBranch(
  weaveId: string,
  source: KnotId,
  targets: KnotId[]
): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = branch(weave, source, targets)
  await saveWeave(next)
  return next
}

/** Join multiple paths into one knot */
export async function toolJoin(
  weaveId: string,
  sources: KnotId[],
  target: KnotId
): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = join(weave, sources, target)
  await saveWeave(next)
  return next
}

/** Span (bridge) two disconnected knots */
export async function toolSpan(
  weaveId: string,
  source: KnotId,
  target: KnotId
): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = span(weave, source, target)
  await saveWeave(next)
  return next
}

/** Close a cycle */
export async function toolKnot(
  weaveId: string,
  source: KnotId,
  target: KnotId
): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = knot(weave, source, target)
  await saveWeave(next)
  return next
}

/** Add a gate condition to a thread */
export async function toolGate(
  weaveId: string,
  threadId: ThreadId,
  condition: GateCondition
): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = gate(weave, threadId, condition)
  await saveWeave(next)
  return next
}

/** Veil (abstract) a subgraph */
export async function toolVeil(weaveId: string, knotIds: KnotId[]): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = veil(weave, knotIds)
  await saveWeave(next)
  return next
}

/** Reveal (expand) a veiled composite */
export async function toolReveal(weaveId: string, compositeKnotId: KnotId): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = reveal(weave, compositeKnotId)
  await saveWeave(next)
  return next
}

/** Snip a thread */
export async function toolSnip(weaveId: string, threadId: ThreadId): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = snip(weave, threadId)
  await saveWeave(next)
  return next
}

/** Cut a knot and its threads */
export async function toolCut(weaveId: string, knotId: KnotId): Promise<Weave> {
  const weave = await loadWeave(weaveId)
  const next = cut(weave, knotId)
  await saveWeave(next)
  return next
}

/** List all saved weaves */
export async function toolListWeaves(): Promise<Array<{ id: string; name: string }>> {
  await ensureDir()
  const files = await fs.readdir(GRAPHS_DIR)
  const results: Array<{ id: string; name: string }> = []
  for (const f of files) {
    if (!f.endsWith('.weave.json')) continue
    const content = await fs.readFile(path.join(GRAPHS_DIR, f), 'utf-8')
    const data = JSON.parse(content)
    results.push({ id: data.id, name: data.name })
  }
  return results
}
