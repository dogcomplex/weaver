import type { Weave } from '#weaver/core'

/** Adapter interface for translating between Weave and external workflow formats */
export interface Adapter<TExternal> {
  name: string
  fromExternal(workflow: TExternal): Weave
  toExternal(weave: Weave): TExternal
}
