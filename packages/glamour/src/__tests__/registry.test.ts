import { describe, it, expect, beforeEach } from 'vitest'
import { RendererRegistry, ThemeRegistry } from '../registry.js'
import type { WeaveRendererDefinition, GlamourTheme } from '../types.js'

describe('RendererRegistry', () => {
  let registry: RendererRegistry

  beforeEach(() => {
    registry = new RendererRegistry()
  })

  it('registers and retrieves a renderer definition', () => {
    const def: WeaveRendererDefinition = {
      id: 'classic',
      name: 'Classic',
      editable: true,
      available: true,
    }
    registry.register(def)
    expect(registry.get('classic')).toBe(def)
  })

  it('returns undefined for unknown renderer', () => {
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('getAll returns all registered renderers', () => {
    const a: WeaveRendererDefinition = { id: 'a', name: 'A', editable: true, available: true }
    const b: WeaveRendererDefinition = { id: 'b', name: 'B', editable: false, available: false }
    registry.register(a)
    registry.register(b)
    expect(registry.getAll()).toHaveLength(2)
  })

  it('getAvailable filters unavailable renderers', () => {
    registry.register({ id: 'ok', name: 'OK', editable: true, available: true })
    registry.register({ id: 'nope', name: 'Nope', editable: false, available: false })
    const available = registry.getAvailable()
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('ok')
  })

  it('duplicate registration overwrites', () => {
    registry.register({ id: 'x', name: 'V1', editable: true, available: true })
    registry.register({ id: 'x', name: 'V2', editable: true, available: true })
    expect(registry.get('x')?.name).toBe('V2')
    expect(registry.getAll()).toHaveLength(1)
  })
})

describe('ThemeRegistry', () => {
  let registry: ThemeRegistry

  // Minimal mock theme
  const mockTheme = (id: string, name: string): GlamourTheme => ({
    id,
    name,
    description: `${name} theme`,
    enchantKnot: () => ({} as any),
    enchantThread: () => ({} as any),
    enchantWave: () => ({} as any),
    canMerge: () => false,
    enchantSubgraph: () => ({} as any),
    describeWeave: () => '',
    describeKnot: () => '',
    sceneConfig: { background: '#000', layoutMode: 'free', spacing: { x: 300, y: 200 } },
    aiSystemPrompt: '',
  })

  beforeEach(() => {
    registry = new ThemeRegistry()
  })

  it('registers and retrieves a theme', () => {
    const loom = mockTheme('loom', 'The Loom')
    registry.register(loom)
    expect(registry.get('loom')).toBe(loom)
  })

  it('returns undefined for unknown theme', () => {
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('getAll returns all registered themes', () => {
    registry.register(mockTheme('loom', 'Loom'))
    registry.register(mockTheme('factory', 'Factory'))
    registry.register(mockTheme('garden', 'Garden'))
    expect(registry.getAll()).toHaveLength(3)
  })

  it('duplicate registration overwrites', () => {
    registry.register(mockTheme('loom', 'V1'))
    registry.register(mockTheme('loom', 'V2'))
    expect(registry.get('loom')?.name).toBe('V2')
    expect(registry.getAll()).toHaveLength(1)
  })
})
