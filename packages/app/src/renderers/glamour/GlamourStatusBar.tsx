/**
 * GlamourStatusBar — Compact status bar with theme selector, element counts, and hints.
 *
 * Integrates the ThemeSelector dropdown for browsing and switching themes.
 */

import type { GlamourTheme } from '#weaver/glamour'
import type { MetaphorManifest } from '#weaver/glamour'
import type { Weave } from '#weaver/core'
import { ThemeSelector } from './ThemeSelector.js'

interface GlamourStatusBarProps {
  theme: GlamourTheme
  weave: Weave
  activeManifest: MetaphorManifest | null
}

export function GlamourStatusBar({ theme, weave, activeManifest }: GlamourStatusBarProps) {
  return (
    <div style={statusBarStyle}>
      {/* Theme selector dropdown */}
      <ThemeSelector activeManifest={activeManifest} weaveId={weave.id} />

      {/* Separator */}
      <span style={{ width: 1, height: 12, background: '#1a1a2e' }} />

      {/* Counts */}
      <span style={{ fontSize: 9, color: '#3a3a5a' }}>
        {weave.knots.size} elements  {weave.threads.size} threads
      </span>

      {/* Right-aligned hints */}
      <span style={{ fontSize: 9, color: '#3a3a5a', marginLeft: 'auto' }}>
        Scroll to zoom  Middle-click to pan  Alt+click to unveil
      </span>
    </div>
  )
}

const statusBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 24,
  background: 'rgba(10, 10, 10, 0.85)',
  borderBottom: '1px solid #1a1a2e',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 12,
  zIndex: 20,
}
