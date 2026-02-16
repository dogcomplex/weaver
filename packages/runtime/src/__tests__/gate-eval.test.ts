import { describe, it, expect } from 'vitest'
import { evaluateGate } from '../gate-eval.js'
import { createWave } from '../wave.js'

function wave(payload: Record<string, unknown>) {
  return createWave(payload)
}

describe('evaluateGate', () => {
  it('checks truthiness of a variable', () => {
    expect(evaluateGate('x', wave({ x: 1 }))).toBe(true)
    expect(evaluateGate('x', wave({ x: 0 }))).toBe(false)
    expect(evaluateGate('x', wave({ x: 'hello' }))).toBe(true)
    expect(evaluateGate('x', wave({ x: '' }))).toBe(false)
    expect(evaluateGate('x', wave({ x: null }))).toBe(false)
    expect(evaluateGate('x', wave({}))).toBe(false)
  })

  it('negates truthiness', () => {
    expect(evaluateGate('!x', wave({ x: 1 }))).toBe(false)
    expect(evaluateGate('!x', wave({ x: 0 }))).toBe(true)
    expect(evaluateGate('!x', wave({}))).toBe(true)
  })

  it('compares with >', () => {
    expect(evaluateGate('x > 5', wave({ x: 10 }))).toBe(true)
    expect(evaluateGate('x > 5', wave({ x: 3 }))).toBe(false)
    expect(evaluateGate('x > 5', wave({ x: 5 }))).toBe(false)
  })

  it('compares with <', () => {
    expect(evaluateGate('x < 5', wave({ x: 3 }))).toBe(true)
    expect(evaluateGate('x < 5', wave({ x: 10 }))).toBe(false)
  })

  it('compares with >=', () => {
    expect(evaluateGate('x >= 5', wave({ x: 5 }))).toBe(true)
    expect(evaluateGate('x >= 5', wave({ x: 4 }))).toBe(false)
  })

  it('compares with <=', () => {
    expect(evaluateGate('x <= 5', wave({ x: 5 }))).toBe(true)
    expect(evaluateGate('x <= 5', wave({ x: 6 }))).toBe(false)
  })

  it('compares with ==', () => {
    expect(evaluateGate('x == 5', wave({ x: 5 }))).toBe(true)
    expect(evaluateGate('x == 5', wave({ x: 6 }))).toBe(false)
    expect(evaluateGate('name == "foo"', wave({ name: 'foo' }))).toBe(true)
    expect(evaluateGate('name == "bar"', wave({ name: 'foo' }))).toBe(false)
  })

  it('compares with !=', () => {
    expect(evaluateGate('x != 5', wave({ x: 3 }))).toBe(true)
    expect(evaluateGate('x != 5', wave({ x: 5 }))).toBe(false)
  })

  it('handles && (AND)', () => {
    expect(evaluateGate('x > 0 && y > 0', wave({ x: 1, y: 1 }))).toBe(true)
    expect(evaluateGate('x > 0 && y > 0', wave({ x: 1, y: -1 }))).toBe(false)
    expect(evaluateGate('x > 0 && y > 0', wave({ x: -1, y: 1 }))).toBe(false)
  })

  it('handles || (OR)', () => {
    expect(evaluateGate('x > 0 || y > 0', wave({ x: 1, y: -1 }))).toBe(true)
    expect(evaluateGate('x > 0 || y > 0', wave({ x: -1, y: 1 }))).toBe(true)
    expect(evaluateGate('x > 0 || y > 0', wave({ x: -1, y: -1 }))).toBe(false)
  })

  it('handles nested property access', () => {
    expect(evaluateGate('data.count > 3', wave({ data: { count: 5 } }))).toBe(true)
    expect(evaluateGate('data.count > 3', wave({ data: { count: 1 } }))).toBe(false)
  })

  it('returns false on invalid expressions', () => {
    expect(evaluateGate('', wave({}))).toBe(false)
  })

  it('compares with boolean literals', () => {
    expect(evaluateGate('active == true', wave({ active: true }))).toBe(true)
    expect(evaluateGate('active == false', wave({ active: false }))).toBe(true)
    expect(evaluateGate('active == true', wave({ active: false }))).toBe(false)
  })
})
