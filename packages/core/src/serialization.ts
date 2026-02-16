import type {
  Weave,
  Knot,
  Thread,
  Strand,
  Threshold,
  WeaveMetadata,
  KnotId,
  ThreadId,
  StrandId,
} from './types.js'

/** JSON-serializable shape of a Weave (Maps → plain objects) */
export interface SerializedWeave {
  id: string
  name: string
  knots: Record<KnotId, Knot>
  threads: Record<ThreadId, Thread>
  strands: Record<StrandId, Strand>
  thresholds: Threshold[]
  metadata: WeaveMetadata
}

/** Convert a Weave to a JSON string */
export function serializeWeave(weave: Weave): string {
  const serialized: SerializedWeave = {
    id: weave.id,
    name: weave.name,
    knots: Object.fromEntries(weave.knots),
    threads: Object.fromEntries(weave.threads),
    strands: Object.fromEntries(weave.strands),
    thresholds: weave.thresholds,
    metadata: weave.metadata,
  }
  return JSON.stringify(serialized, null, 2)
}

/** Parse a JSON string into a Weave */
export function deserializeWeave(json: string): Weave {
  const raw: SerializedWeave = JSON.parse(json)
  return {
    id: raw.id,
    name: raw.name,
    knots: new Map(Object.entries(raw.knots)),
    threads: new Map(Object.entries(raw.threads)),
    strands: new Map(Object.entries(raw.strands)),
    thresholds: raw.thresholds ?? [],
    metadata: raw.metadata,
  }
}

/** Convert a SerializedWeave object (not string) into a Weave */
export function fromSerialized(raw: SerializedWeave): Weave {
  return {
    id: raw.id,
    name: raw.name,
    knots: new Map(Object.entries(raw.knots)),
    threads: new Map(Object.entries(raw.threads)),
    strands: new Map(Object.entries(raw.strands)),
    thresholds: raw.thresholds ?? [],
    metadata: raw.metadata,
  }
}

/** Convert a Weave to a SerializedWeave object (not string) */
export function toSerialized(weave: Weave): SerializedWeave {
  return {
    id: weave.id,
    name: weave.name,
    knots: Object.fromEntries(weave.knots),
    threads: Object.fromEntries(weave.threads),
    strands: Object.fromEntries(weave.strands),
    thresholds: weave.thresholds,
    metadata: weave.metadata,
  }
}
