/**
 * ContextMenu — Lightweight right-click context menu for glamour elements.
 *
 * Appears at cursor position when right-clicking a knot in the Glamour view.
 * Provides actions: Unveil/Conceal, Properties (select), Delete.
 */

import { useEffect, useRef } from 'react'
import type { KnotId } from '#weaver/core'

export interface ContextMenuState {
  knotId: KnotId
  x: number  // viewport X
  y: number  // viewport Y
  isUnveiled: boolean
  depth: number
}

interface ContextMenuProps {
  menu: ContextMenuState | null
  onClose: () => void
  onUnveil: (knotId: KnotId) => void
  onSelect: (knotId: KnotId) => void
  onDelete: (knotId: KnotId) => void
}

export function ContextMenu({ menu, onClose, onUnveil, onSelect, onDelete }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!menu) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Use setTimeout to avoid closing immediately on the same right-click
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [menu, onClose])

  // Close on Escape
  useEffect(() => {
    if (!menu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menu, onClose])

  if (!menu) return null

  const items = [
    {
      label: menu.isUnveiled ? 'Conceal' : 'Unveil',
      hint: 'Alt+Click',
      action: () => { onUnveil(menu.knotId); onClose() },
    },
    {
      label: 'Properties',
      hint: 'Click',
      action: () => { onSelect(menu.knotId); onClose() },
    },
    { type: 'separator' as const },
    {
      label: 'Delete',
      hint: 'Del',
      danger: true,
      action: () => { onDelete(menu.knotId); onClose() },
    },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 200,
        background: '#0d0d18',
        border: '1px solid #2a2a4e',
        borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        padding: '4px 0',
        minWidth: 160,
      }}
    >
      {items.map((item, i) => {
        if ('type' in item && item.type === 'separator') {
          return <div key={i} style={{ height: 1, background: '#1a1a2e', margin: '4px 0' }} />
        }
        const it = item as { label: string; hint?: string; danger?: boolean; action: () => void }
        return (
          <button
            key={i}
            onClick={it.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '5px 12px',
              background: 'none',
              border: 'none',
              color: it.danger ? '#f87171' : '#c0c0d0',
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            <span>{it.label}</span>
            {it.hint && (
              <span style={{ fontSize: 9, color: '#4a4a6a', marginLeft: 16 }}>{it.hint}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
