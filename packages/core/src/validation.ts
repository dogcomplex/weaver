/**
 * Weave Validation
 *
 * Checks for structural issues: orphan knots, missing required inputs,
 * type mismatches on threads, cycles (informational).
 */

import type { Weave, KnotId } from './types.js'
import { incoming, outgoing, detectCycles } from './helpers.js'
import { getKnotType, hasKnotType } from './knot-types.js'

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  knotId?: KnotId
  threadId?: string
  message: string
}

export interface ValidationResult {
  valid: boolean        // true if no errors (warnings/info OK)
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

/** Validate a Weave and return all issues */
export function validateWeave(weave: Weave): ValidationResult {
  const issues: ValidationIssue[] = []

  // 1. Check for orphan knots (no incoming or outgoing threads)
  for (const [knotId, knot] of weave.knots) {
    const inThreads = incoming(weave, knotId)
    const outThreads = outgoing(weave, knotId)

    if (inThreads.length === 0 && outThreads.length === 0 && weave.knots.size > 1) {
      issues.push({
        severity: 'warning',
        knotId,
        message: `"${knot.label}" is disconnected (no threads)`,
      })
    }
  }

  // 2. Check for knots with missing required inputs (if type is registered)
  for (const [knotId, knot] of weave.knots) {
    if (!hasKnotType(knot.type)) continue
    const typeDef = getKnotType(knot.type)

    // Count incoming threads by checking if required inputs have connections
    const inThreads = incoming(weave, knotId)
    const requiredInputs = typeDef.inputs.filter(p => p.type !== '*')

    if (requiredInputs.length > 0 && inThreads.length < requiredInputs.length) {
      const missing = requiredInputs.length - inThreads.length
      issues.push({
        severity: 'warning',
        knotId,
        message: `"${knot.label}" may be missing ${missing} input connection(s)`,
      })
    }
  }

  // 3. Check for threads referencing non-existent knots
  for (const [threadId, thread] of weave.threads) {
    if (!weave.knots.has(thread.source)) {
      issues.push({
        severity: 'error',
        threadId,
        message: `Thread references missing source knot "${thread.source}"`,
      })
    }
    if (!weave.knots.has(thread.target)) {
      issues.push({
        severity: 'error',
        threadId,
        message: `Thread references missing target knot "${thread.target}"`,
      })
    }
  }

  // 4. Check for self-loops
  for (const [threadId, thread] of weave.threads) {
    if (thread.source === thread.target) {
      issues.push({
        severity: 'warning',
        threadId,
        knotId: thread.source,
        message: `Thread is a self-loop on "${weave.knots.get(thread.source)?.label}"`,
      })
    }
  }

  // 5. Detect cycles (informational — not necessarily an error)
  const cycles = detectCycles(weave)
  if (cycles.length > 0) {
    issues.push({
      severity: 'info',
      message: `Weave contains ${cycles.length} cycle(s) — may cause infinite loops during trace`,
    })
  }

  // 6. Empty weave check
  if (weave.knots.size === 0) {
    issues.push({
      severity: 'info',
      message: 'Weave is empty — add knots to build a workflow',
    })
  }

  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  }
}
