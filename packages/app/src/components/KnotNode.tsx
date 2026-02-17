import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getKnotType, CATEGORY_META, type KnotCategory } from '#weaver/core'
import type { KnotHighlight } from '#weaver/glamour'

export function KnotNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const knotType = (d.knotType as string) || 'default'
  const typeDef = getKnotType(knotType)
  const catMeta = CATEGORY_META[typeDef.category as KnotCategory] ?? CATEGORY_META.default
  const highlight = d.highlight as KnotHighlight | null | undefined

  // Derive colors from category
  const accentColor = typeDef.color || catMeta.color
  const bgColor = selected
    ? blendWithBase(accentColor, 0.3)
    : blendWithBase(accentColor, 0.15)
  const borderColor = selected ? '#6a6aff' : accentColor

  // Highlight glow from wave animation
  const glowColor = highlight?.color ?? null
  const glowIntensity = highlight?.intensity ?? 0
  const glowShadow = glowColor
    ? `0 0 ${8 + glowIntensity * 12}px ${glowColor}, 0 0 ${4 + glowIntensity * 6}px ${glowColor}`
    : undefined
  const highlightBorder = glowColor
    ? `2px solid ${glowColor}`
    : `${selected ? 2 : 1}px solid ${borderColor}`

  return (
    <div
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        background: bgColor,
        border: highlightBorder,
        color: '#e0e0e0',
        fontSize: 13,
        minWidth: 80,
        textAlign: 'center',
        boxShadow: glowShadow,
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.2s',
        animation: highlight?.pulse ? 'knot-pulse 0.8s ease-in-out infinite' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: glowColor || accentColor }} />
      <div style={{ fontWeight: 600, marginBottom: 1 }}>{d.label as string}</div>
      {knotType !== 'default' && (
        <div
          style={{
            fontSize: 9,
            color: accentColor,
            opacity: 0.8,
            marginTop: 1,
            letterSpacing: '0.3px',
          }}
        >
          {typeDef.label !== (d.label as string) ? typeDef.label : knotType}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: glowColor || accentColor }} />
    </div>
  )
}

/** Blend an accent color with the dark base (#1a1a2e) at given opacity */
function blendWithBase(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const br = 0x1a, bg = 0x1a, bb = 0x2e
  const mr = Math.round(br + (r - br) * opacity)
  const mg = Math.round(bg + (g - bg) * opacity)
  const mb = Math.round(bb + (b - bb) * opacity)
  return `rgb(${mr}, ${mg}, ${mb})`
}
