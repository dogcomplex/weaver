/**
 * useWeaveWebSocket — Shared WebSocket connection with pub/sub.
 *
 * A single WebSocket connection to the server (ws://host:4444/ws)
 * shared across the entire app. Listeners subscribe to messages
 * via the returned `subscribe` function.
 *
 * This replaces separate WebSocket connections in App.tsx and useGlamourAssets.ts.
 */

import { useEffect, useRef, useCallback } from 'react'

export type WebSocketMessage = Record<string, unknown> & { type: string }
export type WebSocketListener = (msg: WebSocketMessage) => void

export interface WeaveWebSocket {
  /** Subscribe to all WebSocket messages. Returns an unsubscribe function. */
  subscribe: (listener: WebSocketListener) => () => void
}

export function useWeaveWebSocket(): WeaveWebSocket {
  const listenersRef = useRef<Set<WebSocketListener>>(new Set())
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:4444/ws`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg && typeof msg.type === 'string') {
          for (const listener of listenersRef.current) {
            listener(msg)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [])

  const subscribe = useCallback((listener: WebSocketListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  return { subscribe }
}
