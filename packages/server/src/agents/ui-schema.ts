import fs from 'fs/promises'
import path from 'path'

const SCHEMAS_DIR = path.resolve(process.cwd(), 'data', 'schemas')

export interface LayoutSchema {
  panels: PanelConfig[]
  theme: ThemeConfig
  sidebar: SidebarConfig
}

export interface PanelConfig {
  id: string
  type: 'canvas' | 'log' | 'properties' | 'minimap' | 'custom'
  visible: boolean
  position: { x: number; y: number; width: string; height: string }
}

export interface ThemeConfig {
  background: string
  foreground: string
  accent: string
  knotBackground: string
  knotBorder: string
  threadColor: string
}

export interface SidebarConfig {
  visible: boolean
  width: number
  sections: string[]
}

const DEFAULT_LAYOUT: LayoutSchema = {
  panels: [
    { id: 'canvas', type: 'canvas', visible: true, position: { x: 0, y: 0, width: '100%', height: '100%' } },
    { id: 'minimap', type: 'minimap', visible: true, position: { x: 0, y: 0, width: '200px', height: '150px' } },
  ],
  theme: {
    background: '#0a0a0a',
    foreground: '#e0e0e0',
    accent: '#6a6a9a',
    knotBackground: '#1a1a2e',
    knotBorder: '#4a4a6a',
    threadColor: '#6a6a9a',
  },
  sidebar: {
    visible: true,
    width: 240,
    sections: ['graphs', 'properties'],
  },
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(SCHEMAS_DIR, { recursive: true })
}

export async function readLayout(): Promise<LayoutSchema> {
  await ensureDir()
  const filepath = path.join(SCHEMAS_DIR, 'layout.json')
  try {
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as LayoutSchema
  } catch {
    // Return default and create file
    await writeLayout(DEFAULT_LAYOUT)
    return DEFAULT_LAYOUT
  }
}

export async function writeLayout(layout: LayoutSchema): Promise<void> {
  await ensureDir()
  const filepath = path.join(SCHEMAS_DIR, 'layout.json')
  await fs.writeFile(filepath, JSON.stringify(layout, null, 2), 'utf-8')
}

export async function patchLayout(patch: Partial<LayoutSchema>): Promise<LayoutSchema> {
  const current = await readLayout()
  const updated = { ...current, ...patch }
  await writeLayout(updated)
  return updated
}
