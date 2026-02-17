import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Weave } from '#weaver/core'
import {
  createWeave,
} from '#weaver/core'
import * as ops from '#weaver/core'
import type { WeaveAction } from '#weaver/glamour'

interface WeaveState {
  current: Weave
  history: Weave[]
  future: Weave[]
  saved: boolean
}

function reducer(state: WeaveState, action: WeaveAction): WeaveState {
  switch (action.type) {
    case 'mark': {
      const next = ops.mark(state.current, action.input)
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    case 'thread': {
      const next = ops.thread(state.current, action.source, action.target)
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    case 'snip': {
      const next = ops.snip(state.current, action.threadId)
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    case 'cut': {
      const next = ops.cut(state.current, action.knotId)
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    case 'gate': {
      const next = ops.gate(state.current, action.threadId, action.condition)
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    case 'load':
      return { current: action.weave, history: [], future: [], saved: true }
    case 'new':
      return { current: createWeave(action.name), history: [], future: [], saved: false }
    case 'undo': {
      if (state.history.length === 0) return state
      const prev = state.history[state.history.length - 1]
      return {
        current: prev,
        history: state.history.slice(0, -1),
        future: [state.current, ...state.future],
        saved: false,
      }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        current: next,
        history: [...state.history, state.current],
        future: state.future.slice(1),
        saved: false,
      }
    }
    case 'markSaved':
      return { ...state, saved: true }
    case 'updatePositions': {
      const next = { ...state.current, knots: new Map(state.current.knots) }
      for (const [id, pos] of action.positions) {
        const knot = next.knots.get(id)
        if (knot) {
          next.knots.set(id, { ...knot, position: pos })
        }
      }
      return { ...state, current: next as Weave, saved: false }
    }
    case 'updateKnot': {
      const knot = state.current.knots.get(action.knotId)
      if (!knot) return state
      const updated = {
        ...knot,
        ...(action.changes.label !== undefined && { label: action.changes.label }),
        ...(action.changes.type !== undefined && { type: action.changes.type }),
        ...(action.changes.data !== undefined && { data: { ...knot.data, ...action.changes.data } }),
      }
      const nextKnots = new Map(state.current.knots)
      nextKnots.set(action.knotId, updated)
      const next = { ...state.current, knots: nextKnots } as Weave
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    case 'updateThread': {
      const thread = state.current.threads.get(action.threadId)
      if (!thread) return state
      const updated = {
        ...thread,
        ...(action.changes.label !== undefined && { label: action.changes.label }),
        ...(action.changes.data !== undefined && { data: { ...thread.data, ...action.changes.data } }),
        ...(action.changes.gate !== undefined && { gate: action.changes.gate === null ? undefined : action.changes.gate }),
      }
      const nextThreads = new Map(state.current.threads)
      nextThreads.set(action.threadId, updated)
      const next = { ...state.current, threads: nextThreads } as Weave
      return {
        current: next,
        history: [...state.history, state.current].slice(-50),
        future: [],
        saved: false,
      }
    }
    default:
      return state
  }
}

const initialState: WeaveState = {
  current: createWeave('untitled'),
  history: [],
  future: [],
  saved: true,
}

interface WeaveContextValue {
  state: WeaveState
  dispatch: React.Dispatch<WeaveAction>
}

const WeaveContext = createContext<WeaveContextValue | null>(null)

export function WeaveProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <WeaveContext.Provider value={{ state, dispatch }}>
      {children}
    </WeaveContext.Provider>
  )
}

export function useWeave() {
  const ctx = useContext(WeaveContext)
  if (!ctx) throw new Error('useWeave must be used within WeaveProvider')
  return ctx
}
