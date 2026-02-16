import { useCallback, useEffect, useRef } from 'react'

export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export interface ContextMenuItem {
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  menu: ContextMenuState
  onClose: () => void
}

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Delay to avoid catching the same right-click
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickAway)
      document.addEventListener('keydown', handleEsc)
    }, 0)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '4px 0',
        minWidth: 160,
        zIndex: 1000,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      {menu.items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            if (!item.disabled) {
              item.onClick()
              onClose()
            }
          }}
          disabled={item.disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '6px 12px',
            background: 'none',
            border: 'none',
            color: item.disabled ? '#444' : item.danger ? '#e55' : '#ccc',
            cursor: item.disabled ? 'default' : 'pointer',
            fontSize: 12,
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) {
              ;(e.target as HTMLElement).style.background = '#2a2a4e'
            }
          }}
          onMouseLeave={(e) => {
            ;(e.target as HTMLElement).style.background = 'none'
          }}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span style={{ fontSize: 10, color: '#555', marginLeft: 16 }}>{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  )
}
