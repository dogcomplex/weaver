import { v4 as uuid } from 'uuid'
import type { KnotId } from '#weaver/core'
import type { Wave } from './types.js'

/** Create a new Wave with the given payload */
export function createWave(
  payload: Record<string, unknown> = {},
  startKnot?: KnotId
): Wave {
  return {
    id: uuid(),
    payload: { ...payload },
    path: startKnot ? [startKnot] : [],
    status: 'flowing',
  }
}

/** Clone a wave (for branching) with a new id */
export function cloneWave(wave: Wave): Wave {
  return {
    id: uuid(),
    payload: { ...wave.payload },
    path: [...wave.path],
    status: wave.status,
  }
}

/** Advance a wave to a new knot */
export function advanceWave(wave: Wave, knotId: KnotId): Wave {
  return {
    ...wave,
    path: [...wave.path, knotId],
  }
}

/** Block a wave (gate condition failed) */
export function blockWave(wave: Wave): Wave {
  return { ...wave, status: 'blocked' }
}

/** Mark a wave as arrived (reached a dead end or terminal) */
export function arriveWave(wave: Wave): Wave {
  return { ...wave, status: 'arrived' }
}

/** Merge payloads from multiple waves */
export function mergeWaves(waves: Wave[]): Wave {
  const merged: Record<string, unknown> = {}
  for (const w of waves) {
    Object.assign(merged, w.payload)
  }
  return {
    id: uuid(),
    payload: merged,
    path: waves.flatMap((w) => w.path),
    status: 'merged',
  }
}
