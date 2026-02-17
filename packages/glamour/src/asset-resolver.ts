/**
 * Glamour Asset Resolution
 *
 * Hash-based asset lookup with fallback chain, ported from the
 * ComfyUI-LOKI prototype's image resolution system.
 *
 * Fallback chain: exact hash → type default → theme default → aurora gradient
 */

import type { Knot, KnotId } from '#weaver/core'
import type { GlamourAsset, AssetResolution } from './types.js'

/**
 * Generate a deterministic hash from a knot's configuration.
 * Same algorithm as LOKI prototype's generateNodeHash().
 */
export function hashKnotConfig(knot: Knot): string {
  const content = JSON.stringify({
    type: knot.type,
    data: knot.data,
  })
  // djb2 hash — fast and deterministic
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash).toString(36)
}

/**
 * Resolves glamour assets using a fallback chain:
 * 1. Exact hash match (knot-specific generated asset)
 * 2. Type fallback (default asset for this knot type)
 * 3. Theme default (generic theme asset)
 * 4. Aurora gradient (hardcoded fallback)
 */
export class GlamourAssetResolver {
  private cache = new Map<string, GlamourAsset>()
  private basePath: string

  constructor(basePath: string = '/api/output/files/glamour-assets') {
    this.basePath = basePath
  }

  /** Get the base path for asset URLs */
  getBasePath(): string {
    return this.basePath
  }

  /**
   * Resolve an asset with the fallback chain.
   */
  resolve(
    knotId: KnotId,
    knotType: string,
    hash: string,
    themeId: string,
  ): AssetResolution {
    // Level 1: Exact hash
    const exactKey = `${knotType}_${knotId}_${hash}`
    const exactAsset = this.cache.get(exactKey)
    if (exactAsset) {
      return { asset: exactAsset, fallbackLevel: 'exact' }
    }

    // Level 2: Type default
    const typeKey = `${themeId}_${knotType}`
    const typeAsset = this.cache.get(typeKey)
    if (typeAsset) {
      return { asset: typeAsset, fallbackLevel: 'type' }
    }

    // Level 3: Theme default
    const themeKey = `${themeId}_default`
    const themeAsset = this.cache.get(themeKey)
    if (themeAsset) {
      return { asset: themeAsset, fallbackLevel: 'theme' }
    }

    // Level 4: Aurora gradient fallback
    return {
      asset: { type: 'fallback', url: '', hash: '' },
      fallbackLevel: 'aurora',
    }
  }

  /** Register an asset in the cache */
  register(key: string, asset: GlamourAsset): void {
    this.cache.set(key, asset)
  }

  /** Invalidate cached assets for a specific knot */
  invalidate(knotId: KnotId): void {
    for (const key of this.cache.keys()) {
      if (key.includes(knotId)) {
        this.cache.delete(key)
      }
    }
  }

  /** Clear entire cache */
  clear(): void {
    this.cache.clear()
  }

  /** Get the number of cached assets */
  get size(): number {
    return this.cache.size
  }
}
