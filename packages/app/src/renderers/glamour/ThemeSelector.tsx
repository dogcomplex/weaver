/**
 * ThemeSelector — Manifest browser and theme activation panel.
 *
 * Fetches available manifests from the server, displays them with
 * quality scores, and allows direct theme switching. Integrates
 * into the GlamourStatusBar as an expandable dropdown.
 *
 * Features:
 *   - Manifest list with name + overall score badge
 *   - Expandable detail view with 5 quality scores + rationale
 *   - Quick-switch: click to activate a theme
 *   - "Revert to Default" to deactivate glamour
 *   - Active theme indicator
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MetaphorManifest } from '#weaver/glamour'

// ─── Types ───────────────────────────────────────────────────────

interface ManifestSummary {
  id: string
  name: string
  score: number
  cached: boolean
}

interface ThemeSelectorProps {
  activeManifest: MetaphorManifest | null
  weaveId: string
}

// ─── Score Color ─────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return '#4ade80'  // green
  if (score >= 6) return '#facc15'  // yellow
  if (score >= 4) return '#fb923c'  // orange
  return '#f87171'                   // red
}

function scoreBadge(score: number): React.CSSProperties {
  return {
    display: 'inline-block',
    fontSize: 9,
    fontWeight: 700,
    color: scoreColor(score),
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 3,
    padding: '1px 4px',
    minWidth: 24,
    textAlign: 'center',
  }
}

// ─── Score Bar (mini) ────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value * 10))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8 }}>
      <span style={{ color: '#6a6a9a', width: 85, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(value), borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color: '#6a6a9a', width: 18, textAlign: 'right' }}>{value.toFixed(1)}</span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────

export function ThemeSelector({ activeManifest, weaveId }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [manifests, setManifests] = useState<ManifestSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedManifest, setExpandedManifest] = useState<MetaphorManifest | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Fetch manifest list when dropdown opens
  const fetchManifests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/glamour/manifests')
      if (res.ok) {
        const data = await res.json()
        // Sort by score descending
        data.sort((a: ManifestSummary, b: ManifestSummary) => b.score - a.score)
        setManifests(data)
      }
    } catch {
      // Network error — leave empty
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) fetchManifests()
  }, [open, fetchManifests])

  // Activate a manifest
  const activate = useCallback(async (manifestId: string) => {
    setActivating(manifestId)
    try {
      await fetch(`/api/ai/glamour/manifests/${manifestId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaveId }),
      })
      // Theme switch happens via WebSocket broadcast → App.tsx picks it up
    } catch {
      // Activation failed
    }
    setActivating(null)
    setOpen(false)
  }, [weaveId])

  // Deactivate
  const deactivate = useCallback(async () => {
    try {
      await fetch('/api/ai/glamour/manifests/deactivate', { method: 'POST' })
    } catch {
      // Deactivation failed
    }
    setOpen(false)
  }, [])

  // Delete a manifest
  const deleteManifest = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/glamour/manifests/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setManifests(prev => prev.filter(m => m.id !== id))
        if (expandedId === id) {
          setExpandedId(null)
          setExpandedManifest(null)
        }
      }
    } catch {
      // Delete failed
    }
  }, [expandedId])

  // Regenerate assets for a manifest (force re-activation)
  const regenerate = useCallback(async (manifestId: string) => {
    setActivating(manifestId)
    try {
      await fetch(`/api/ai/glamour/manifests/${manifestId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaveId }),
      })
    } catch {
      // Regeneration failed
    }
    setActivating(null)
  }, [weaveId])

  // Load full manifest for expanded view
  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedManifest(null)
      return
    }
    setExpandedId(id)
    try {
      const res = await fetch(`/api/ai/glamour/manifests/${id}`)
      if (res.ok) {
        setExpandedManifest(await res.json())
      }
    } catch {
      setExpandedManifest(null)
    }
  }, [expandedId])

  // ─── Trigger button (in status bar) ────────────────────────────

  const activeLabel = activeManifest ? activeManifest.name : 'Default'
  const activeScore = activeManifest ? activeManifest.scores.overall : null

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? '#1a1a3e' : 'transparent',
          border: 'none',
          color: '#9a9ac0',
          fontSize: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          borderRadius: 3,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ color: activeManifest ? '#b0b0ff' : '#6a6a9a' }}>
          {activeLabel}
        </span>
        {activeScore !== null && (
          <span style={scoreBadge(activeScore)}>{activeScore.toFixed(1)}</span>
        )}
        <span style={{ fontSize: 7, color: '#4a4a6a', marginLeft: 2 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={dropdownStyle}>
          {/* Header */}
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: '#6a6a9a', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Glamour Themes
            </span>
            {activeManifest && (
              <button
                onClick={deactivate}
                style={revertBtnStyle}
              >
                Revert to Default
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '12px 10px', fontSize: 9, color: '#4a4a6a', textAlign: 'center' }}>
                Loading themes…
              </div>
            )}

            {!loading && manifests.length === 0 && (
              <div style={{ padding: '12px 10px', fontSize: 9, color: '#4a4a6a', textAlign: 'center' }}>
                No saved themes yet. Ask the AI to suggest a metaphor.
              </div>
            )}

            {manifests.map((m) => {
              const isActive = activeManifest?.id === m.id
              const isExpanded = expandedId === m.id
              const isActivating = activating === m.id

              return (
                <div key={m.id}>
                  <div
                    style={{
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(106, 106, 255, 0.08)' : 'transparent',
                      borderLeft: isActive ? '2px solid #6a6aff' : '2px solid transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    {/* Score badge */}
                    <span style={scoreBadge(m.score)}>{m.score.toFixed(1)}</span>

                    {/* Cached indicator */}
                    {m.cached && (
                      <span style={{ fontSize: 6, color: '#4a8a4a', flexShrink: 0 }} title="Assets cached">●</span>
                    )}

                    {/* Name */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: 10,
                        color: isActive ? '#b0b0ff' : '#c0c0d0',
                        fontWeight: isActive ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => toggleExpand(m.id)}
                    >
                      {m.name}
                      {isActive && <span style={{ fontSize: 7, color: '#6a6aff', marginLeft: 4 }}>● active</span>}
                    </span>

                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(m.id)}
                      style={expandBtnStyle}
                      title="Show details"
                    >
                      {isExpanded ? '−' : '+'}
                    </button>

                    {/* Activate button */}
                    {!isActive && (
                      <button
                        onClick={() => activate(m.id)}
                        disabled={isActivating}
                        style={{
                          ...activateBtnStyle,
                          opacity: isActivating ? 0.5 : 1,
                        }}
                      >
                        {isActivating ? '…' : 'Apply'}
                      </button>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && expandedManifest && expandedManifest.id === m.id && (
                    <div style={detailPanelStyle}>
                      {/* Scene description */}
                      <div style={{ fontSize: 9, color: '#8a8ab0', marginBottom: 6, lineHeight: 1.4 }}>
                        {expandedManifest.sceneDescription}
                      </div>

                      {/* Quality scores */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                        <ScoreBar label="Explanatory" value={expandedManifest.scores.explanatoryPower} />
                        <ScoreBar label="Truthfulness" value={expandedManifest.scores.truthfulness} />
                        <ScoreBar label="Completeness" value={expandedManifest.scores.completeness} />
                        <ScoreBar label="Interaction" value={expandedManifest.scores.intuitiveInteraction} />
                        <ScoreBar label="Fractal" value={expandedManifest.scores.fractalConsistency} />
                      </div>

                      {/* Rationale */}
                      {expandedManifest.scores.rationale && (
                        <div style={{ fontSize: 8, color: '#5a5a8a', fontStyle: 'italic', lineHeight: 1.3, marginBottom: 6 }}>
                          {expandedManifest.scores.rationale}
                        </div>
                      )}

                      {/* Mapping summary */}
                      <div style={{ fontSize: 8, color: '#5a5a8a', marginBottom: 6 }}>
                        {expandedManifest.mappings.length} element{expandedManifest.mappings.length !== 1 ? 's' : ''} mapped
                        {expandedManifest.mergedGroups && expandedManifest.mergedGroups.length > 0 && (
                          <span> · {expandedManifest.mergedGroups.length} merge group{expandedManifest.mergedGroups.length !== 1 ? 's' : ''}</span>
                        )}
                        {expandedManifest.sceneConfig.backgroundPrompt && (
                          <span> · scene background</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => regenerate(m.id)}
                          disabled={activating === m.id}
                          style={detailActionBtnStyle}
                          title="Regenerate all assets for this theme"
                        >
                          {activating === m.id ? '…' : '↻ Regen'}
                        </button>
                        {!isActive && (
                          <button
                            onClick={() => deleteManifest(m.id)}
                            style={{ ...detailActionBtnStyle, color: '#f87171', borderColor: '#4a2020' }}
                            title="Delete this theme"
                          >
                            ✕ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 2,
  minWidth: 280,
  maxWidth: 360,
  background: '#0d0d18',
  border: '1px solid #1a1a2e',
  borderRadius: 6,
  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  zIndex: 100,
  overflow: 'hidden',
}

const revertBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #2a2a4e',
  borderRadius: 3,
  color: '#6a6a9a',
  fontSize: 8,
  padding: '2px 6px',
  cursor: 'pointer',
}

const expandBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#4a4a6a',
  fontSize: 10,
  cursor: 'pointer',
  width: 18,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 3,
  flexShrink: 0,
}

const activateBtnStyle: React.CSSProperties = {
  background: '#1a1a3e',
  border: '1px solid #3a3a6e',
  borderRadius: 3,
  color: '#b0b0ff',
  fontSize: 8,
  padding: '2px 8px',
  cursor: 'pointer',
  flexShrink: 0,
}

const detailPanelStyle: React.CSSProperties = {
  padding: '6px 10px 8px 20px',
  background: 'rgba(10, 10, 20, 0.5)',
  borderBottom: '1px solid #1a1a2e',
}

const detailActionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #2a2a4e',
  borderRadius: 3,
  color: '#6a6a9a',
  fontSize: 8,
  padding: '2px 6px',
  cursor: 'pointer',
}
