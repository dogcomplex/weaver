import type { TraceHooks } from './types.js'

/** Create a console-logging trace hook set (useful for debugging) */
export function createLoggingHooks(): TraceHooks {
  return {
    onEnterKnot: (knotId, wave) =>
      console.log(`[Trace] Enter knot: ${knotId} (wave: ${wave.id})`),
    onExitKnot: (knotId, wave) =>
      console.log(`[Trace] Exit knot: ${knotId} (wave: ${wave.id}, status: ${wave.status})`),
    onTraverseThread: (threadId, wave) =>
      console.log(`[Trace] Traverse thread: ${threadId} → ${wave.path[wave.path.length - 1]}`),
    onGateEval: (threadId, passed, expression) =>
      console.log(`[Trace] Gate ${passed ? 'PASS' : 'BLOCK'}: ${expression} (thread: ${threadId})`),
    onBranch: (knotId, count) =>
      console.log(`[Trace] Branch at ${knotId}: ${count} paths`),
    onJoin: (knotId, count) =>
      console.log(`[Trace] Join at ${knotId}: ${count} waves`),
    onError: (error) =>
      console.error(`[Trace] Error at ${error.knotId}: ${error.message}`),
  }
}

/** Compose multiple hook sets into one (all callbacks fire) */
export function composeHooks(...hookSets: TraceHooks[]): TraceHooks {
  return {
    onEnterKnot: (knotId, wave) =>
      hookSets.forEach((h) => h.onEnterKnot?.(knotId, wave)),
    onExitKnot: (knotId, wave) =>
      hookSets.forEach((h) => h.onExitKnot?.(knotId, wave)),
    onTraverseThread: (threadId, wave) =>
      hookSets.forEach((h) => h.onTraverseThread?.(threadId, wave)),
    onGateEval: (threadId, passed, expression) =>
      hookSets.forEach((h) => h.onGateEval?.(threadId, passed, expression)),
    onBranch: (knotId, count) =>
      hookSets.forEach((h) => h.onBranch?.(knotId, count)),
    onJoin: (knotId, count) =>
      hookSets.forEach((h) => h.onJoin?.(knotId, count)),
    onError: (error) =>
      hookSets.forEach((h) => h.onError?.(error)),
  }
}
