import { useState, useCallback } from 'react'

export type SelectionType = 'knot' | 'thread'

export interface Selection {
  type: SelectionType
  id: string
}

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
