/**
 * FacadeOverlay — HTML overlay layer for facade controls.
 *
 * Renders all 8 control types positioned in world space.
 * A CSS transform on the parent div mirrors the PixiJS camera,
 * keeping overlays aligned with the canvas.
 *
 * Control types:
 *   slider  — Range input → number
 *   text    — Text input → string
 *   toggle  — CSS switch → boolean
 *   select  — Styled dropdown → string/value
 *   dial    — SVG arc knob → number
 *   display — Read-only value badge
 *   button  — Themed action button
 *   color   — Swatch + native picker → hex string
 */

import { useMemo, useCallback } from 'react'
import type { KnotId, Weave } from '#weaver/core'
import type { GlamourElement, WeaveAction, FacadeControl } from '#weaver/glamour'
import { getNestedValue, setNestedValue } from './helpers.js'

// ─── Shared Styles ──────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = { fontSize: 9, color: '#6a6a9a' }
const VALUE_STYLE: React.CSSProperties = { fontSize: 8, color: '#4a4a6a' }
const ACCENT = '#6a6aff'

const controlWrapperStyle = (cx: number, cy: number, offsetX: number, offsetY: number): React.CSSProperties => ({
  position: 'absolute',
  left: cx + offsetX,
  top: cy + offsetY,
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
})

const inputStyle: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #2a2a4e',
  borderRadius: 3,
  color: '#c0c0d0',
  fontSize: 10,
  padding: '2px 6px',
}

// ─── Props ──────────────────────────────────────────────────────

interface FacadeOverlayProps {
  facadeData: Map<KnotId, { element: GlamourElement; worldX: number; worldY: number }>
  weave: Weave
  onWeaveAction: (action: WeaveAction) => void
  hoveredKnotIds: Set<KnotId>
}

// ─── Component ──────────────────────────────────────────────────

export function FacadeOverlay({ facadeData, weave, onWeaveAction, hoveredKnotIds }: FacadeOverlayProps) {
  const updateKnotData = useCallback((knotId: KnotId, dataPath: string, value: unknown) => {
    onWeaveAction({
      type: 'updateKnot',
      knotId,
      changes: { data: setNestedValue(weave.knots.get(knotId)?.data ?? {}, dataPath, value) },
    })
  }, [weave, onWeaveAction])

  const overlays = useMemo(() => {
    const result: JSX.Element[] = []

    for (const [knotId, { element, worldX, worldY }] of facadeData) {
      if (!element.facade) continue

      // hover-reveal: only show facades when hovered (or drag-control which behaves similarly)
      const style = element.interactionStyle ?? 'hover-reveal'
      if ((style === 'hover-reveal' || style === 'drag-control') && !hoveredKnotIds.has(knotId)) {
        continue
      }
      // static: never show facades
      if (style === 'static') continue

      for (const control of element.facade.controls) {
        const cx = worldX + (control.position.x - 0.5) * element.size.width
        const cy = worldY + (control.position.y - 0.5) * element.size.height
        const key = `${knotId}-${control.id}`
        const bindKnotId = control.binding.knotId
        const dataPath = control.binding.dataPath

        const getValue = () => getNestedValue(weave.knots.get(knotId)?.data, dataPath)

        switch (control.controlType) {
          // ─── Slider ─────────────────────────────────────────
          case 'slider': {
            const currentVal = (getValue() as number) ?? control.binding.min ?? 0
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -40, -8)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <input
                  type="range"
                  min={control.binding.min ?? 0}
                  max={control.binding.max ?? 100}
                  step={control.binding.step ?? 1}
                  value={currentVal}
                  onChange={(e) => updateKnotData(bindKnotId, dataPath, parseFloat(e.target.value))}
                  style={{ width: 80, accentColor: ACCENT }}
                />
                <span style={VALUE_STYLE}>{currentVal}</span>
              </div>
            )
            break
          }

          // ─── Text ───────────────────────────────────────────
          case 'text': {
            const currentVal = (getValue() as string) ?? ''
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -60, -10)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <input
                  type="text"
                  value={currentVal}
                  onChange={(e) => updateKnotData(bindKnotId, dataPath, e.target.value)}
                  style={{ ...inputStyle, width: 120 }}
                />
              </div>
            )
            break
          }

          // ─── Toggle ─────────────────────────────────────────
          case 'toggle': {
            const currentVal = (getValue() as boolean) ?? false
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -28, -8)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <div
                  onClick={() => updateKnotData(bindKnotId, dataPath, !currentVal)}
                  style={{
                    width: 36,
                    height: 18,
                    borderRadius: 9,
                    background: currentVal ? ACCENT : '#2a2a4e',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: '#e0e0f0',
                    position: 'absolute',
                    top: 2,
                    left: currentVal ? 20 : 2,
                    transition: 'left 0.15s',
                  }} />
                </div>
              </div>
            )
            break
          }

          // ─── Select ─────────────────────────────────────────
          case 'select': {
            const currentVal = (getValue() as string) ?? ''
            const options = Array.isArray(control.binding.options) ? control.binding.options : []
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -50, -10)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <select
                  value={String(currentVal)}
                  onChange={(e) => {
                    // Find the option to get the actual value (may not be string)
                    const opt = options.find(o => String(o.value) === e.target.value)
                    updateKnotData(bindKnotId, dataPath, opt ? opt.value : e.target.value)
                  }}
                  style={{
                    ...inputStyle,
                    width: 100,
                    cursor: 'pointer',
                    appearance: 'none',
                    paddingRight: 16,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%236a6a9a'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 4px center',
                  }}
                >
                  {options.map((opt, i) => (
                    <option key={i} value={String(opt.value)}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )
            break
          }

          // ─── Dial ───────────────────────────────────────────
          case 'dial': {
            const min = control.binding.min ?? 0
            const max = control.binding.max ?? 100
            const currentVal = (getValue() as number) ?? min
            const pct = Math.max(0, Math.min(1, (currentVal - min) / (max - min || 1)))
            // Arc from -135° to +135° (270° sweep)
            const startAngle = -135
            const sweepAngle = 270
            const angle = startAngle + pct * sweepAngle
            const r = 16
            const rad = (a: number) => (a * Math.PI) / 180
            // Arc path
            const x1 = 20 + r * Math.cos(rad(startAngle))
            const y1 = 20 + r * Math.sin(rad(startAngle))
            const x2 = 20 + r * Math.cos(rad(angle))
            const y2 = 20 + r * Math.sin(rad(angle))
            const largeArc = pct * sweepAngle > 180 ? 1 : 0

            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -20, -20)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <svg width={40} height={40} style={{ cursor: 'pointer' }}>
                  {/* Track */}
                  <circle cx={20} cy={20} r={r} fill="none" stroke="#2a2a4e" strokeWidth={3}
                    strokeDasharray={`${sweepAngle * r * Math.PI / 180} ${360 * r * Math.PI / 180}`}
                    strokeDashoffset={-(360 - sweepAngle) / 2 * r * Math.PI / 180}
                    transform={`rotate(${startAngle + sweepAngle / 2 + 180}, 20, 20)`}
                  />
                  {/* Filled arc */}
                  {pct > 0.01 && (
                    <path
                      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                      fill="none" stroke={ACCENT} strokeWidth={3} strokeLinecap="round"
                    />
                  )}
                  {/* Knob dot */}
                  <circle
                    cx={20 + r * Math.cos(rad(angle))}
                    cy={20 + r * Math.sin(rad(angle))}
                    r={4} fill="#e0e0f0"
                  />
                </svg>
                {/* Use a hidden range input for interaction */}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={control.binding.step ?? 1}
                  value={currentVal}
                  onChange={(e) => updateKnotData(bindKnotId, dataPath, parseFloat(e.target.value))}
                  style={{ width: 40, opacity: 0, height: 0, margin: 0, padding: 0, position: 'absolute', bottom: 0 }}
                />
                <span style={VALUE_STYLE}>{currentVal}</span>
              </div>
            )
            break
          }

          // ─── Display ────────────────────────────────────────
          case 'display': {
            const currentVal = getValue()
            const displayStr = currentVal != null ? String(currentVal) : '—'
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -30, -8)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <div style={{
                  ...inputStyle,
                  width: 60,
                  textAlign: 'center',
                  fontSize: 10,
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}>
                  {displayStr}
                </div>
              </div>
            )
            break
          }

          // ─── Button ─────────────────────────────────────────
          case 'button': {
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -30, -8)}>
                <button
                  onClick={() => updateKnotData(bindKnotId, dataPath, Date.now())}
                  style={{
                    background: '#1a1a3e',
                    border: `1px solid ${ACCENT}`,
                    borderRadius: 4,
                    color: '#c0c0f0',
                    fontSize: 9,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#2a2a5e' }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#1a1a3e' }}
                >
                  {control.label}
                </button>
              </div>
            )
            break
          }

          // ─── Color ──────────────────────────────────────────
          case 'color': {
            const currentVal = (getValue() as string) ?? '#6a6aff'
            result.push(
              <div key={key} style={controlWrapperStyle(cx, cy, -20, -8)}>
                <span style={LABEL_STYLE}>{control.label}</span>
                <div style={{ position: 'relative', width: 24, height: 24 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: currentVal,
                    border: '1px solid #2a2a4e',
                    cursor: 'pointer',
                  }} />
                  <input
                    type="color"
                    value={currentVal}
                    onChange={(e) => updateKnotData(bindKnotId, dataPath, e.target.value)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 24,
                      height: 24,
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>
            )
            break
          }
        }
      }
    }

    return result
  }, [facadeData, weave, updateKnotData, hoveredKnotIds])

  return <>{overlays}</>
}
