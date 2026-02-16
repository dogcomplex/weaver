import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'
import { DATA_TYPE_COLORS } from '#weaver/core'

export function ThreadEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, label, style, selected } = props

  // Derive thread color from label (which often matches the data type)
  const labelStr = typeof label === 'string' ? label : ''
  const dataTypeColor = DATA_TYPE_COLORS[labelStr.toUpperCase()] ?? '#6a6a9a'
  const strokeColor = selected ? '#6a6aff' : dataTypeColor

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

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
      <BaseEdge
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 3 : 2,
          transition: 'stroke 0.15s, stroke-width 0.15s',
          ...style,
        }}
      />
      {label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 8}
          textAnchor="middle"
          style={{ fontSize: 10, fill: selected ? '#8a8aff' : dataTypeColor, opacity: 0.9 }}
        >
          {label as string}
        </text>
      )}
    </>
  )
}
