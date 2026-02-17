/**
 * ViewTabs — tab bar for switching between renderer views.
 *
 * Three tabs: Unveiled (ClassicRenderer), ComfyUI (native graph view),
 * Glamour (Phase 3 placeholder).
 */

import type { ViewMode } from '#weaver/glamour'

interface ViewTabsProps {
  activeView: ViewMode
  onViewChange: (view: ViewMode) => void
}

interface TabDef {
  id: ViewMode
  label: string
  enabled: boolean
  badge?: string
}

const tabs: TabDef[] = [
  { id: 'unveiled', label: 'Unveiled', enabled: true },
  { id: 'comfyui', label: 'ComfyUI', enabled: true },
  { id: 'glamour', label: 'Glamour', enabled: false, badge: 'Phase 3' },
]

export function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: '#0d0d1a',
        borderBottom: '1px solid #1a1a2e',
        padding: '0 8px',
        height: 32,
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeView === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => tab.enabled && onViewChange(tab.id)}
            disabled={!tab.enabled}
            style={{
              padding: '4px 14px',
              background: isActive ? '#1a1a2e' : 'transparent',
              color: isActive ? '#e0e0e0' : tab.enabled ? '#6a6a9a' : '#3a3a5a',
              border: 'none',
              borderBottom: isActive ? '2px solid #6a6aff' : '2px solid transparent',
              cursor: tab.enabled ? 'pointer' : 'default',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.3px',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: tab.enabled ? 1 : 0.5,
            }}
          >
            {tab.label}
            {tab.badge && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: '#2a2a3e',
                  color: '#6a6a9a',
                  fontWeight: 400,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
