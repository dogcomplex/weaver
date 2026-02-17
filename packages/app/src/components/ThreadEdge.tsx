import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'
import { DATA_TYPE_COLORS } from '#weaver/core'
import type { ThreadHighlight } from '#weaver/glamour'

export function ThreadEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, label, style, selected, data } = props

  const d = data as Record<string, unknown> | undefined
  const highlight = d?.highlight as ThreadHighlight | null | undefined

  // Derive thread color from label (which often matches the data type)
  const labelStr = typeof label === 'string' ? label : ''
  const dataTypeColor = DATA_TYPE_COLORS[labelStr.toUpperCase()] ?? '#6a6a9a'

  // Highlight overrides selection styling
  const strokeColor = highlight?.color ?? (selected ? '#6a6aff' : dataTypeColor)
  const strokeWidth = highlight?.width ?? (selected ? 3 : 2)

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  // Animated dash offset for wave progress visualization
  const edgeLength = Math.hypot(targetX - sourceX, targetY - sourceY)
  const dashArray = highlight?.progress != null
    ? `${edgeLength * highlight.progress} ${edgeLength}`
    : undefined
  const dashOffset = highlight?.progress != null ? 0 : undefined

  return (
    <>
      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
      />
      {/* Glow layer when highlighted */}
      {highlight && (
        <path
          d={edgePath}
          fill="none"
          stroke={highlight.color}
          strokeWidth={strokeWidth + 4}
          opacity={0.3}
          style={{ filter: `blur(3px)` }}
        />
      )}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          strokeDashoffset: dashOffset,
          transition: 'stroke 0.15s, stroke-width 0.15s',
          ...style,
        }}
      />
      {label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 8}
          textAnchor="middle"
          style={{ fontSize: 10, fill: highlight?.color ?? (selected ? '#8a8aff' : dataTypeColor), opacity: 0.9 }}
        >
          {label as string}
        </text>
      )}
    </>
  )
}
