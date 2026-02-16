import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWeave } from '../hooks/useWeave.js'
import type { Selection } from '../hooks/useSelection.js'
import type { Knot, Thread } from '#weaver/core'
import { validateWeave, type ValidationIssue } from '#weaver/core'

interface PropertiesPanelProps {
  selection: Selection | null
  onClose: () => void
}

export function PropertiesPanel({ selection, onClose }: PropertiesPanelProps) {
  const { state, dispatch } = useWeave()

  // Run validation on current weave
  const validation = useMemo(() => validateWeave(state.current), [state.current])

  if (!selection) return null

  // Filter issues relevant to selected item
  const relevantIssues = validation.issues.filter(
    (issue) =>
      (selection.type === 'knot' && issue.knotId === selection.id) ||
      (selection.type === 'thread' && issue.threadId === selection.id)
  )

  if (selection.type === 'knot') {
    const knot = state.current.knots.get(selection.id)
    if (!knot) return null
    return <KnotProperties knot={knot} dispatch={dispatch} onClose={onClose} issues={relevantIssues} />
  }

  if (selection.type === 'thread') {
    const thread = state.current.threads.get(selection.id)
    if (!thread) return null
    const sourceKnot = state.current.knots.get(thread.source)
    const targetKnot = state.current.knots.get(thread.target)
    return (
      <ThreadProperties
        thread={thread}
        sourceLabel={sourceKnot?.label ?? thread.source}
        targetLabel={targetKnot?.label ?? thread.target}
        dispatch={dispatch}
        onClose={onClose}
        issues={relevantIssues}
      />
    )
  }

  return null
}

// --- Knot Properties ---

function KnotProperties({
  knot,
  dispatch,
  onClose,
  issues = [],
}: {
  knot: Knot
  dispatch: React.Dispatch<any>
  onClose: () => void
  issues?: ValidationIssue[]
}) {
  const [label, setLabel] = useState(knot.label)
  const [knotType, setKnotType] = useState(knot.type)

  useEffect(() => {
    setLabel(knot.label)
    setKnotType(knot.type)
  }, [knot.id, knot.label, knot.type])

  const commitLabel = useCallback(() => {
    if (label !== knot.label) {
      dispatch({ type: 'updateKnot', knotId: knot.id, changes: { label } })
    }
  }, [label, knot.id, knot.label, dispatch])

  const commitType = useCallback(() => {
    if (knotType !== knot.type) {
      dispatch({ type: 'updateKnot', knotId: knot.id, changes: { type: knotType } })
    }
  }, [knotType, knot.id, knot.type, dispatch])

  const updateDataField = useCallback(
    (key: string, value: unknown) => {
      dispatch({
        type: 'updateKnot',
        knotId: knot.id,
        changes: { data: { ...knot.data, [key]: value } },
      })
    },
    [knot.id, knot.data, dispatch]
  )

  const removeDataField = useCallback(
    (key: string) => {
      const newData = { ...knot.data }
      delete newData[key]
      dispatch({
        type: 'updateKnot',
        knotId: knot.id,
        changes: { data: newData },
      })
    },
    [knot.id, knot.data, dispatch]
  )

  const addDataField = useCallback(() => {
    const key = prompt('Field name:')
    if (key && !(key in knot.data)) {
      dispatch({
        type: 'updateKnot',
        knotId: knot.id,
        changes: { data: { ...knot.data, [key]: '' } },
      })
    }
  }, [knot.id, knot.data, dispatch])

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Knot</span>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Type</label>
        <input
          value={knotType}
          onChange={(e) => setKnotType(e.target.value)}
          onBlur={commitType}
          onKeyDown={(e) => e.key === 'Enter' && commitType()}
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>ID</label>
        <div style={{ fontSize: 10, color: '#555', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {knot.id}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={labelStyle}>Data</label>
          <button onClick={addDataField} style={addBtnStyle}>+ Add</button>
        </div>
        <DataEditor
          data={knot.data}
          onUpdate={updateDataField}
          onRemove={removeDataField}
        />
      </div>

      {issues.length > 0 && <IssuesSection issues={issues} />}
    </div>
  )
}

// --- Thread Properties ---

function ThreadProperties({
  thread,
  sourceLabel,
  targetLabel,
  dispatch,
  onClose,
  issues = [],
}: {
  thread: Thread
  sourceLabel: string
  targetLabel: string
  dispatch: React.Dispatch<any>
  onClose: () => void
  issues?: ValidationIssue[]
}) {
  const [label, setLabel] = useState(thread.label ?? '')
  const [gateExpr, setGateExpr] = useState(thread.gate?.expression ?? '')

  useEffect(() => {
    setLabel(thread.label ?? '')
    setGateExpr(thread.gate?.expression ?? '')
  }, [thread.id, thread.label, thread.gate])

  const commitLabel = useCallback(() => {
    const newLabel = label || undefined
    if (newLabel !== thread.label) {
      dispatch({ type: 'updateThread', threadId: thread.id, changes: { label: newLabel } })
    }
  }, [label, thread.id, thread.label, dispatch])

  const commitGate = useCallback(() => {
    if (gateExpr && gateExpr !== thread.gate?.expression) {
      dispatch({
        type: 'updateThread',
        threadId: thread.id,
        changes: { gate: { expression: gateExpr } },
      })
    } else if (!gateExpr && thread.gate) {
      dispatch({
        type: 'updateThread',
        threadId: thread.id,
        changes: { gate: null },
      })
    }
  }, [gateExpr, thread.id, thread.gate, dispatch])

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Thread</span>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Connection</label>
        <div style={{ fontSize: 11, color: '#8a8aaa' }}>
          {sourceLabel} &rarr; {targetLabel}
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
          style={inputStyle}
          placeholder="optional"
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Gate Expression</label>
        <input
          value={gateExpr}
          onChange={(e) => setGateExpr(e.target.value)}
          onBlur={commitGate}
          onKeyDown={(e) => e.key === 'Enter' && commitGate()}
          style={inputStyle}
          placeholder="e.g. x > 5"
        />
        {thread.gate && (
          <div style={{ fontSize: 10, color: '#ca4', marginTop: 2 }}>
            Gated thread
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>ID</label>
        <div style={{ fontSize: 10, color: '#555', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {thread.id}
        </div>
      </div>

      {issues.length > 0 && <IssuesSection issues={issues} />}
    </div>
  )
}

// --- Issues Section ---

function IssuesSection({ issues }: { issues: ValidationIssue[] }) {
  const severityColors = { error: '#e55', warning: '#ca4', info: '#68a' }
  const severityIcons = { error: '\u26A0', warning: '\u26A0', info: '\u2139' }

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>Validation</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {issues.map((issue, i) => (
          <div
            key={i}
            style={{
              fontSize: 10,
              color: severityColors[issue.severity],
              display: 'flex',
              gap: 4,
              alignItems: 'flex-start',
            }}
          >
            <span>{severityIcons[issue.severity]}</span>
            <span>{issue.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Data Editor ---

function DataEditor({
  data,
  onUpdate,
  onRemove,
}: {
  data: Record<string, unknown>
  onUpdate: (key: string, value: unknown) => void
  onRemove: (key: string) => void
}) {
  const entries = Object.entries(data).filter(([k]) => !k.startsWith('__'))

  if (entries.length === 0) {
    return <div style={{ fontSize: 10, color: '#444', fontStyle: 'italic' }}>No data fields</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([key, value]) => (
        <DataField
          key={key}
          fieldKey={key}
          value={value}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function DataField({
  fieldKey,
  value,
  onUpdate,
  onRemove,
}: {
  fieldKey: string
  value: unknown
  onUpdate: (key: string, value: unknown) => void
  onRemove: (key: string) => void
}) {
  const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  const [editValue, setEditValue] = useState(strValue)
  const isLongText = strValue.length > 60

  useEffect(() => {
    setEditValue(strValue)
  }, [strValue])

  const commit = () => {
    if (editValue !== strValue) {
      // Try to parse as JSON for objects/arrays/numbers, otherwise keep as string
      let parsed: unknown = editValue
      try {
        parsed = JSON.parse(editValue)
      } catch {
        // Keep as string
      }
      onUpdate(fieldKey, parsed as any)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#6a6a9a', fontFamily: 'monospace', flex: 1 }}>
          {fieldKey}
        </span>
        <button
          onClick={() => onRemove(fieldKey)}
          style={{
            background: 'none',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
            fontSize: 12,
            padding: '0 2px',
          }}
          title="Remove field"
        >
          &times;
        </button>
      </div>
      {isLongText ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          style={{
            ...inputStyle,
            minHeight: 60,
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: 10,
          }}
        />
      ) : (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          style={{ ...inputStyle, fontSize: 10, fontFamily: 'monospace' }}
        />
      )}
    </div>
  )
}

// --- Styles ---

const panelStyle: React.CSSProperties = {
  width: 280,
  background: '#111',
  borderLeft: '1px solid #222',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  flexShrink: 0,
}

const headerStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #222',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#ccc',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: '0 4px',
}

const sectionStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #1a1a1a',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#666',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#e0e0e0',
  fontSize: 12,
  outline: 'none',
}

const addBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#666',
  cursor: 'pointer',
  fontSize: 10,
  padding: '1px 6px',
}
