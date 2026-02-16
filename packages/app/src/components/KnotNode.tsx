import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getKnotType, CATEGORY_META, type KnotCategory } from '#weaver/core'

export function KnotNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const knotType = (d.knotType as string) || 'default'
  const typeDef = getKnotType(knotType)
  const catMeta = CATEGORY_META[typeDef.category as KnotCategory] ?? CATEGORY_META.default

  // Derive colors from category
  const accentColor = typeDef.color || catMeta.color
  const bgColor = selected
    ? blendWithBase(accentColor, 0.3)
    : blendWithBase(accentColor, 0.15)
  const borderColor = selected ? '#6a6aff' : accentColor

  return (
    <div
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        background: bgColor,
        border: `${selected ? 2 : 1}px solid ${borderColor}`,
        color: '#e0e0e0',
        fontSize: 13,
        minWidth: 80,
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: accentColor }} />
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
      <Handle type="source" position={Position.Bottom} style={{ background: accentColor }} />
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
