/**
 * Glamour Asset Generator
 *
 * Bridges MetaphorManifest asset prompts to ComfyUI for image generation.
 * Generated images are cached by hash in data/output/glamour-assets/.
 *
 * Flow:
 *   1. MetaphorManifest mapping has assetPrompt: "A warm wooden oven..."
 *   2. Asset generator checks cache (hash of prompt + knot config)
 *   3. If not cached: builds a minimal txt2img ComfyUI workflow and queues it
 *   4. On completion: broadcasts { type: 'glamour-asset', knotId, url } via WebSocket
 *   5. GlamourRenderer picks up the broadcast and swaps the fallback sprite
 */

import fs from 'fs/promises'
import path from 'path'
import { ComfyUIClient } from '#weaver/adapters'
import { GlamourAssetResolver } from '#weaver/glamour'
import { log } from '../logger.js'
import { broadcast } from '../index.js'
import type { MetaphorManifest, MetaphorMapping } from '#weaver/glamour'

const ASSET_DIR = path.resolve(process.cwd(), 'data', 'output', 'glamour-assets')

// ─── Server-side Asset Resolver (singleton) ──────────────────────

/**
 * Server-side resolver tracking all generated glamour assets.
 * Assets are registered here after ComfyUI generation completes.
 * Used by the /api/glamour/assets endpoint for frontend hydration.
 */
export const serverAssetResolver = new GlamourAssetResolver()

// ─── Hash ────────────────────────────────────────────────────────

/** Generate a deterministic hash for asset caching (djb2) */
function hashPrompt(prompt: string, knotType: string): string {
  const content = JSON.stringify({ prompt, knotType })
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash).toString(36)
}

// ─── Cache Check ────────────────────────────────────────────────

/** Check if an asset already exists in cache */
async function isCached(hash: string): Promise<boolean> {
  try {
    await fs.access(path.join(ASSET_DIR, `${hash}.png`))
    return true
  } catch {
    return false
  }
}

/** Get the URL for a cached (or pending) asset */
export function assetUrl(hash: string): string {
  return `/api/output/glamour-assets/${hash}.png`
}

// ─── ComfyUI Workflow Builder ───────────────────────────────────

/**
 * Build a minimal txt2img API workflow for icon-quality asset generation.
 * Produces a 256x256 or 512x512 image from a text prompt.
 */
function buildTxt2ImgWorkflow(prompt: string, size = 512): Record<string, any> {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: 'v1-5-pruned-emaonly.safetensors',
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: `${prompt}, icon, clean design, centered, simple background, digital art, high quality`,
        clip: ['1', 1],  // CheckpointLoaderSimple output 1 = CLIP
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'text, watermark, blurry, low quality, noisy, deformed',
        clip: ['1', 1],  // CheckpointLoaderSimple output 1 = CLIP
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: size,
        height: size,
        batch_size: 1,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
        steps: 20,
        cfg: 7.5,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'glamour-asset',
        images: ['6', 0],
      },
    },
  }
}

/**
 * Build a wider-format txt2img workflow for scene background generation.
 * Produces a 1024x512 panoramic image for scene backdrop.
 */
function buildSceneBackgroundWorkflow(prompt: string): Record<string, any> {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: 'v1-5-pruned-emaonly.safetensors',
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: `${prompt}, wide panoramic view, establishing shot, environment art, clean illustration, digital painting, high quality, detailed background`,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'text, watermark, blurry, low quality, noisy, deformed, people, hands, fingers, close-up',
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: 1024,
        height: 512,
        batch_size: 1,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
        steps: 25,
        cfg: 7.5,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'glamour-scene-bg',
        images: ['6', 0],
      },
    },
  }
}

// ─── Scene Background Generation ─────────────────────────────

/** Generate a scene background image from a background prompt */
export async function generateSceneBackground(
  prompt: string,
  manifestId: string,
): Promise<{ hash: string; url: string; cached: boolean }> {
  const hash = hashPrompt(prompt, `scene-bg-${manifestId}`)
  const url = assetUrl(hash)

  if (await isCached(hash)) {
    log.info({ hash, manifestId }, 'Scene background: cache hit')
    const resolverKey = `scene-bg_${manifestId}`
    serverAssetResolver.register(resolverKey, { type: 'image', url, hash })
    broadcast({ type: 'glamour-scene-bg', manifestId, hash, url })
    return { hash, url, cached: true }
  }

  log.info({ hash, manifestId, promptLength: prompt.length }, 'Scene background: generating via ComfyUI')

  try {
    await fs.mkdir(ASSET_DIR, { recursive: true })
    const client = new ComfyUIClient()
    const workflow = buildSceneBackgroundWorkflow(prompt)
    const result = await client.queuePrompt(workflow)
    const promptId = result.prompt_id

    log.info({ promptId, hash }, 'Scene background: queued to ComfyUI')

    // Poll for completion (90s — wider image takes longer)
    const deadline = Date.now() + 90_000
    let history: Record<string, any> = {}
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500))
      try {
        history = await client.getHistory(promptId)
      } catch {
        continue
      }
      if (history[promptId]?.status?.status_str === 'success') break
      if (history[promptId]?.status?.status_str === 'error') {
        throw new Error('ComfyUI execution failed for scene background')
      }
    }

    // Find the output image
    const outputs = history[promptId]?.outputs ?? {}
    let outputFilename: string | null = null
    for (const nodeOutput of Object.values(outputs) as any[]) {
      if (nodeOutput?.images?.[0]) {
        outputFilename = nodeOutput.images[0].filename
        break
      }
    }

    if (outputFilename) {
      const comfyOutputDir = path.resolve(
        process.cwd(), 'services', 'comfyui',
        'ComfyUI_windows_portable', 'ComfyUI', 'output'
      )
      const sourcePath = path.join(comfyOutputDir, outputFilename)
      const destPath = path.join(ASSET_DIR, `${hash}.png`)

      try {
        await fs.copyFile(sourcePath, destPath)
        log.info({ hash, outputFilename }, 'Scene background: cached')
      } catch {
        const altSource = path.join(process.cwd(), 'data', 'output', outputFilename)
        await fs.copyFile(altSource, destPath)
        log.info({ hash, outputFilename, altSource: true }, 'Scene background: cached from alt dir')
      }

      const resolverKey = `scene-bg_${manifestId}`
      serverAssetResolver.register(resolverKey, { type: 'image', url, hash })
    }

    broadcast({ type: 'glamour-scene-bg', manifestId, hash, url })
    return { hash, url, cached: false }
  } catch (err: any) {
    log.error({ err, hash, manifestId }, 'Scene background generation failed')
    throw err
  }
}

// ─── Generation ─────────────────────────────────────────────────

/** Generate a single glamour asset from a prompt */
export async function generateAsset(
  prompt: string,
  knotType: string,
  knotId?: string,
  size = 512
): Promise<{ hash: string; url: string; cached: boolean }> {
  // Include knotId in hash key when present, so different instances of the same type get unique assets
  const hashKey = knotId ? `${knotType}_${knotId}` : knotType
  const hash = hashPrompt(prompt, hashKey)
  const url = assetUrl(hash)

  // Check cache
  if (await isCached(hash)) {
    log.info({ hash, knotType }, 'Glamour asset: cache hit')
    // Ensure resolver knows about cached assets too
    const resolverKey = knotId ? `${knotType}_${knotId}_${hash}` : `${knotType}_${hash}`
    serverAssetResolver.register(resolverKey, { type: 'image', url, hash })
    // Also register under instance key (knotType_knotId) so frontend resolve() finds it
    if (knotId) {
      serverAssetResolver.register(`${knotType}_${knotId}`, { type: 'image', url, hash })
    }
    // Also broadcast so live renderers can hot-swap immediately
    if (knotId) {
      broadcast({ type: 'glamour-asset', knotId, hash, url })
    }
    return { hash, url, cached: true }
  }

  log.info({ hash, knotType, promptLength: prompt.length }, 'Glamour asset: generating via ComfyUI')

  try {
    // Ensure asset directory exists
    await fs.mkdir(ASSET_DIR, { recursive: true })

    // Queue to ComfyUI
    const client = new ComfyUIClient()
    const workflow = buildTxt2ImgWorkflow(prompt, size)
    const result = await client.queuePrompt(workflow)
    const promptId = result.prompt_id

    log.info({ promptId, hash }, 'Glamour asset: queued to ComfyUI')

    // Poll for completion (max 60s for a single small image)
    const deadline = Date.now() + 60_000
    let history: Record<string, any> = {}
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500))
      try {
        history = await client.getHistory(promptId)
      } catch {
        continue
      }
      if (history[promptId]?.status?.status_str === 'success') break
      if (history[promptId]?.status?.status_str === 'error') {
        throw new Error('ComfyUI execution failed')
      }
    }

    // Find the output image
    const outputs = history[promptId]?.outputs ?? {}
    let outputFilename: string | null = null
    for (const nodeOutput of Object.values(outputs) as any[]) {
      if (nodeOutput?.images?.[0]) {
        outputFilename = nodeOutput.images[0].filename
        break
      }
    }

    if (outputFilename) {
      // Copy/rename to our cache directory with hash name
      const comfyOutputDir = path.resolve(
        process.cwd(), 'services', 'comfyui',
        'ComfyUI_windows_portable', 'ComfyUI', 'output'
      )
      const sourcePath = path.join(comfyOutputDir, outputFilename)
      const destPath = path.join(ASSET_DIR, `${hash}.png`)

      try {
        await fs.copyFile(sourcePath, destPath)
        log.info({ hash, outputFilename }, 'Glamour asset: cached')
      } catch {
        // Also check the primary output dir
        const altSource = path.join(process.cwd(), 'data', 'output', outputFilename)
        await fs.copyFile(altSource, destPath)
        log.info({ hash, outputFilename, altSource: true }, 'Glamour asset: cached from alt dir')
      }

      // Register in server-side resolver for frontend hydration
      const resolverKey = knotId ? `${knotType}_${knotId}_${hash}` : `${knotType}_${hash}`
      serverAssetResolver.register(resolverKey, { type: 'image', url, hash })
      // Also register under instance key (knotType_knotId) so frontend resolve() finds it
      if (knotId) {
        serverAssetResolver.register(`${knotType}_${knotId}`, { type: 'image', url, hash })
      }
      log.info({ resolverKey }, 'Glamour asset: registered in resolver')
    }

    // Broadcast update so the frontend refreshes the asset
    if (knotId) {
      broadcast({ type: 'glamour-asset', knotId, hash, url })
    }

    return { hash, url, cached: false }
  } catch (err: any) {
    log.error({ err, hash, knotType }, 'Glamour asset generation failed')
    throw err
  }
}

// ─── Batch Generation ───────────────────────────────────────────

/**
 * Generate all assets from a MetaphorManifest that aren't already cached.
 * Returns immediately with the list of hashes; generation happens in background.
 */
export async function generateManifestAssets(
  manifest: MetaphorManifest,
  knotIdMap?: Map<string, string>  // knotType → knotId (for broadcast targeting)
): Promise<Array<{ knotType: string; hash: string; url: string; pending: boolean }>> {
  await fs.mkdir(ASSET_DIR, { recursive: true })

  const results: Array<{ knotType: string; hash: string; url: string; pending: boolean }> = []

  for (const mapping of manifest.mappings) {
    if (!mapping.assetPrompt) continue

    // Include knotId in hash key to avoid collision when multiple mappings share a knotType
    const hashKey = mapping.knotId ? `${mapping.knotType}_${mapping.knotId}` : mapping.knotType
    const hash = hashPrompt(mapping.assetPrompt, hashKey)
    const url = assetUrl(hash)
    const cached = await isCached(hash)

    // Prefer instance-level knotId from mapping, fall back to type-level map
    const knotId = mapping.knotId ?? knotIdMap?.get(mapping.knotType)

    results.push({
      knotType: mapping.knotType,
      hash,
      url,
      pending: !cached,
    })

    if (cached) {
      // Register cached asset in resolver so hydration endpoint returns it
      const resolverKey = knotId ? `${mapping.knotType}_${knotId}_${hash}` : `${mapping.knotType}_${hash}`
      serverAssetResolver.register(resolverKey, { type: 'image', url, hash })
      // Also register under instance key (knotType_knotId) so frontend resolve() finds it
      if (knotId) {
        serverAssetResolver.register(`${mapping.knotType}_${knotId}`, { type: 'image', url, hash })
      }
      // Also register type-level key so duplicate knots of same type resolve
      serverAssetResolver.register(`${manifest.id}_${mapping.knotType}`, { type: 'image', url, hash })
      // Broadcast so live renderers can hot-swap immediately
      if (knotId) {
        broadcast({ type: 'glamour-asset', knotId, hash, url })
      }
    } else {
      // Fire and forget — don't block on ComfyUI
      generateAsset(mapping.assetPrompt, mapping.knotType, knotId).catch(err => {
        log.error({ err, knotType: mapping.knotType }, 'Background asset generation failed')
      })
    }
  }

  // Scene background generation (if backgroundPrompt exists)
  if (manifest.sceneConfig.backgroundPrompt) {
    generateSceneBackground(manifest.sceneConfig.backgroundPrompt, manifest.id).catch(err => {
      log.error({ err, manifestId: manifest.id }, 'Scene background generation failed')
    })
  }

  log.info(
    { total: results.length, pending: results.filter(r => r.pending).length, hasSceneBg: !!manifest.sceneConfig.backgroundPrompt },
    'Glamour assets: batch queued'
  )

  return results
}
