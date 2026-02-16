import type { Wave } from './types.js'

/**
 * Evaluate a gate expression against a wave's payload.
 * Uses a safe subset of expressions — no eval(), no arbitrary code.
 *
 * Supported:
 * - Property access: `x`, `payload.name`
 * - Comparisons: `x > 5`, `name == "foo"`, `count != 0`
 * - Boolean: `x > 5 && y < 10`, `a || b`
 * - Truthiness: `x` (truthy check)
 * - Negation: `!x`
 */
export function evaluateGate(expression: string, wave: Wave): boolean {
  const payload = wave.payload

  try {
    // Simple truthiness check (just a variable name)
    if (/^[a-zA-Z_]\w*$/.test(expression.trim())) {
      return !!payload[expression.trim()]
    }

    // Negation
    if (/^!\s*[a-zA-Z_]\w*$/.test(expression.trim())) {
      const varName = expression.trim().slice(1).trim()
      return !payload[varName]
    }

    // Handle && and || by splitting and recursing
    if (expression.includes('&&')) {
      return expression.split('&&').every((part) => evaluateGate(part.trim(), wave))
    }
    if (expression.includes('||')) {
      return expression.split('||').some((part) => evaluateGate(part.trim(), wave))
    }

    // Comparison operators
    const compMatch = expression.match(
      /^([a-zA-Z_][\w.]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/
    )
    if (compMatch) {
      const [, varPath, operator, rawValue] = compMatch
      const left = resolveValue(varPath, payload)
      const right = parseValue(rawValue.trim())
      return compare(left, operator, right)
    }

    // Fallback: treat as truthy
    return !!resolveValue(expression.trim(), payload)
  } catch {
    return false
  }
}

function resolveValue(path: string, payload: Record<string, unknown>): unknown {
  const parts = path.split('.')
  let current: unknown = payload
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function parseValue(raw: string): unknown {
  // String literal
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  // Boolean
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  // Number
  const num = Number(raw)
  if (!isNaN(num)) return num
  // Fallback: string
  return raw
}

function compare(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case '==': return left == right // eslint-disable-line eqeqeq
    case '!=': return left != right // eslint-disable-line eqeqeq
    case '>': return Number(left) > Number(right)
    case '<': return Number(left) < Number(right)
    case '>=': return Number(left) >= Number(right)
    case '<=': return Number(left) <= Number(right)
    default: return false
  }
}
