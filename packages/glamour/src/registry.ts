/**
 * Glamour Registries — manage available renderers and themes.
 */

import type { WeaveRendererDefinition, GlamourTheme } from './types.js'

/** Registry of available renderers */
export class RendererRegistry {
  private renderers = new Map<string, WeaveRendererDefinition>()

  register(definition: WeaveRendererDefinition): void {
    this.renderers.set(definition.id, definition)
  }

  get(id: string): WeaveRendererDefinition | undefined {
    return this.renderers.get(id)
  }

  getAll(): WeaveRendererDefinition[] {
    return Array.from(this.renderers.values())
  }

  getAvailable(): WeaveRendererDefinition[] {
    return this.getAll().filter(r => r.available)
  }
}

/** Registry of available glamour themes */
export class ThemeRegistry {
  private themes = new Map<string, GlamourTheme>()

  register(theme: GlamourTheme): void {
    this.themes.set(theme.id, theme)
  }

  get(id: string): GlamourTheme | undefined {
    return this.themes.get(id)
  }

  getAll(): GlamourTheme[] {
    return Array.from(this.themes.values())
  }
}
