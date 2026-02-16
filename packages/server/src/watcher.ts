import { watch } from 'chokidar'
import path from 'path'
import { log } from './logger.js'

const GRAPHS_DIR = path.resolve(process.cwd(), 'data', 'graphs')

export function setupFileWatcher(broadcast: (data: unknown) => void): void {
  const watcher = watch(path.join(GRAPHS_DIR, '*.weave.json'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  })

  watcher.on('add', (filepath) => {
    const filename = path.basename(filepath)
    log.info({ filename }, 'New weave detected')
    broadcast({ type: 'graph:added', filename })
  })

  watcher.on('change', (filepath) => {
    const filename = path.basename(filepath)
    log.info({ filename }, 'Weave updated')
    broadcast({ type: 'graph:changed', filename })
  })

  watcher.on('unlink', (filepath) => {
    const filename = path.basename(filepath)
    log.info({ filename }, 'Weave removed')
    broadcast({ type: 'graph:removed', filename })
  })
}
