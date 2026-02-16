import fs from 'fs/promises'
import path from 'path'
import { serializeWeave, deserializeWeave, type Weave } from '#weaver/core'

/**
 * Filesystem store for Weave graphs.
 * Reads/writes .weave.json files from data/graphs/ relative to cwd.
 */
class WeaveStore {
  private graphsDir: string

  constructor() {
    this.graphsDir = path.resolve(process.cwd(), 'data', 'graphs')
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.graphsDir, { recursive: true })
  }

  async save(weave: Weave): Promise<void> {
    await this.ensureDir()
    const filepath = path.join(this.graphsDir, `${weave.id}.weave.json`)
    await fs.writeFile(filepath, serializeWeave(weave), 'utf-8')
  }

  async load(id: string): Promise<Weave> {
    const filepath = path.join(this.graphsDir, `${id}.weave.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    return deserializeWeave(content)
  }

  async list(): Promise<Array<{ id: string; name: string; filename: string }>> {
    await this.ensureDir()
    const files = await fs.readdir(this.graphsDir)
    const results: Array<{ id: string; name: string; filename: string }> = []
    for (const f of files) {
      if (!f.endsWith('.weave.json')) continue
      const content = await fs.readFile(path.join(this.graphsDir, f), 'utf-8')
      const data = JSON.parse(content)
      results.push({ id: data.id, name: data.name, filename: f })
    }
    return results
  }

  async exists(id: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.graphsDir, `${id}.weave.json`))
      return true
    } catch {
      return false
    }
  }
}

export const weaveStore = new WeaveStore()
