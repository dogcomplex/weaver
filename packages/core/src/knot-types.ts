/**
 * Knot Type Registry
 *
 * Defines categories, colors, ports, and defaults for each knot type.
 * Auto-populates from ComfyUI/n8n imports, with built-in defaults.
 */

export interface PortDefinition {
  name: string
  type: string // e.g., 'MODEL', 'CLIP', 'LATENT', 'IMAGE', 'CONDITIONING', 'VAE', '*'
}

export interface KnotTypeDefinition {
  type: string
  label: string
  category: KnotCategory
  color: string        // accent color for the knot
  defaultData: Record<string, unknown>
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  description?: string
}

export type KnotCategory =
  | 'loader'       // Models, checkpoints, LoRAs
  | 'conditioning' // Text encoding, CLIP, prompts
  | 'sampler'      // KSampler, schedulers
  | 'latent'       // Latent images, operations
  | 'image'        // Image save, preview, load
  | 'vae'          // VAE encode/decode
  | 'control'      // Gates, flow control
  | 'utility'      // General purpose
  | 'n8n'          // n8n-sourced nodes
  | 'default'      // Untyped / generic

/** Category display names and colors */
export const CATEGORY_META: Record<KnotCategory, { label: string; color: string }> = {
  loader:       { label: 'Loaders',      color: '#4a7a4a' },
  conditioning: { label: 'Conditioning', color: '#7a4a7a' },
  sampler:      { label: 'Samplers',     color: '#4a4a7a' },
  latent:       { label: 'Latent',       color: '#7a6a3a' },
  image:        { label: 'Image',        color: '#3a6a7a' },
  vae:          { label: 'VAE',          color: '#6a4a3a' },
  control:      { label: 'Control',      color: '#7a7a3a' },
  utility:      { label: 'Utility',      color: '#4a4a4a' },
  n8n:          { label: 'n8n',          color: '#ea8744' },
  default:      { label: 'Default',      color: '#4a4a6a' },
}

/** Data type colors for threads */
export const DATA_TYPE_COLORS: Record<string, string> = {
  MODEL:        '#6a9a6a',
  CLIP:         '#9a6a9a',
  CONDITIONING: '#9a6aaa',
  LATENT:       '#aa9a5a',
  IMAGE:        '#5a9aaa',
  VAE:          '#aa6a5a',
  MASK:         '#7a7a7a',
  '*':          '#6a6a9a',
}

/** Infer category from ComfyUI class_type */
function inferCategory(classType: string): KnotCategory {
  const ct = classType.toLowerCase()
  if (ct.includes('checkpoint') || ct.includes('lora') || ct.includes('loader') || ct.includes('load_')) return 'loader'
  if (ct.includes('clip') || ct.includes('conditioning') || ct.includes('encode')) return 'conditioning'
  if (ct.includes('ksampler') || ct.includes('sampler')) return 'sampler'
  if (ct.includes('latent') || ct.includes('empty')) return 'latent'
  if (ct.includes('save') || ct.includes('preview') || ct.includes('image')) return 'image'
  if (ct.includes('vae')) return 'vae'
  if (ct.includes('gate') || ct.includes('switch') || ct.includes('reroute')) return 'control'
  return 'utility'
}

/** Built-in knot type definitions */
const BUILT_IN_TYPES: KnotTypeDefinition[] = [
  {
    type: 'default',
    label: 'Knot',
    category: 'default',
    color: CATEGORY_META.default.color,
    defaultData: {},
    inputs: [{ name: 'in', type: '*' }],
    outputs: [{ name: 'out', type: '*' }],
  },
  {
    type: 'CheckpointLoaderSimple',
    label: 'Load Checkpoint',
    category: 'loader',
    color: CATEGORY_META.loader.color,
    defaultData: { comfyui_class_type: 'CheckpointLoaderSimple' },
    inputs: [],
    outputs: [
      { name: 'MODEL', type: 'MODEL' },
      { name: 'CLIP', type: 'CLIP' },
      { name: 'VAE', type: 'VAE' },
    ],
    description: 'Load a Stable Diffusion checkpoint model',
  },
  {
    type: 'CLIPTextEncode',
    label: 'CLIP Text Encode',
    category: 'conditioning',
    color: CATEGORY_META.conditioning.color,
    defaultData: { comfyui_class_type: 'CLIPTextEncode' },
    inputs: [{ name: 'clip', type: 'CLIP' }],
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
    description: 'Encode text prompt using CLIP',
  },
  {
    type: 'KSampler',
    label: 'KSampler',
    category: 'sampler',
    color: CATEGORY_META.sampler.color,
    defaultData: { comfyui_class_type: 'KSampler' },
    inputs: [
      { name: 'model', type: 'MODEL' },
      { name: 'positive', type: 'CONDITIONING' },
      { name: 'negative', type: 'CONDITIONING' },
      { name: 'latent_image', type: 'LATENT' },
    ],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    description: 'Sample from model with conditioning',
  },
  {
    type: 'VAEDecode',
    label: 'VAE Decode',
    category: 'vae',
    color: CATEGORY_META.vae.color,
    defaultData: { comfyui_class_type: 'VAEDecode' },
    inputs: [
      { name: 'samples', type: 'LATENT' },
      { name: 'vae', type: 'VAE' },
    ],
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
    description: 'Decode latent samples to image',
  },
  {
    type: 'EmptyLatentImage',
    label: 'Empty Latent Image',
    category: 'latent',
    color: CATEGORY_META.latent.color,
    defaultData: { comfyui_class_type: 'EmptyLatentImage' },
    inputs: [],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    description: 'Create an empty latent image',
  },
  {
    type: 'SaveImage',
    label: 'Save Image',
    category: 'image',
    color: CATEGORY_META.image.color,
    defaultData: { comfyui_class_type: 'SaveImage' },
    inputs: [{ name: 'images', type: 'IMAGE' }],
    outputs: [],
    description: 'Save generated image to disk',
  },
]

/** The registry: type string → definition */
const registry = new Map<string, KnotTypeDefinition>()

// Populate with built-ins
for (const def of BUILT_IN_TYPES) {
  registry.set(def.type, def)
}

/** Get a knot type definition (returns default if not found) */
export function getKnotType(type: string): KnotTypeDefinition {
  return registry.get(type) ?? registry.get('default')!
}

/** Check if a type is registered */
export function hasKnotType(type: string): boolean {
  return registry.has(type)
}

/** Register a new knot type (or update existing) */
export function registerKnotType(def: KnotTypeDefinition): void {
  registry.set(def.type, def)
}

/** Get all registered types */
export function getAllKnotTypes(): KnotTypeDefinition[] {
  return Array.from(registry.values())
}

/** Get types by category */
export function getKnotTypesByCategory(category: KnotCategory): KnotTypeDefinition[] {
  return Array.from(registry.values()).filter(d => d.category === category)
}

/**
 * Auto-register a knot type from a ComfyUI class_type found in a workflow.
 * Only creates a minimal definition if the type isn't already registered.
 */
export function ensureKnotTypeFromComfyUI(classType: string): KnotTypeDefinition {
  if (registry.has(classType)) return registry.get(classType)!

  const category = inferCategory(classType)
  const def: KnotTypeDefinition = {
    type: classType,
    label: classType.replace(/([A-Z])/g, ' $1').trim(),
    category,
    color: CATEGORY_META[category].color,
    defaultData: { comfyui_class_type: classType },
    inputs: [{ name: 'in', type: '*' }],
    outputs: [{ name: 'out', type: '*' }],
  }
  registry.set(classType, def)
  return def
}
