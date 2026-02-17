import { useState, useCallback } from 'react'
import type { Selection } from '#weaver/glamour'

// Re-export for backward compat
export type { Selection, SelectionType } from '#weaver/glamour'

export function useSelection() {
  const [selection, setSelection] = useState<Selection | null>(null)

  const selectKnot = useCallback((id: string) => {
    setSelection({ type: 'knot', id })
  }, [])

  const selectThread = useCallback((id: string) => {
    setSelection({ type: 'thread', id })
  }, [])

  const clearSelection = useCallback(() => {
    setSelection(null)
  }, [])

  return { selection, selectKnot, selectThread, clearSelection, setSelection }
}
