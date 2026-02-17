/**
 * useWaveAnimation — drives wave animation playback in the browser.
 *
 * Converts a TraceResult into an AnimationTimeline, then uses
 * requestAnimationFrame to interpolate highlights at 0→1 progress.
 * Returns an AnimationState that any renderer can consume.
 *
 * Compatible with React StrictMode (which double-fires effects in dev).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TraceResult } from '#weaver/runtime'
import type { AnimationState } from '#weaver/glamour'
import { buildTimeline, interpolateHighlights } from '#weaver/glamour'

export interface UseWaveAnimationOptions {
  /** Speed multiplier (default: 1) */
  speed?: number
  /** Auto-play when traceResult changes (default: true) */
  autoPlay?: boolean
}

export function useWaveAnimation(
  traceResult: TraceResult | null,
  options: UseWaveAnimationOptions = {},
) {
  const { speed = 1, autoPlay = true } = options

  const [animationState, setAnimationState] = useState<AnimationState | null>(null)
  const rafRef = useRef<number>(0)
  const playingRef = useRef(false)

  const stop = useCallback(() => {
    playingRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    setAnimationState(null)
  }, [])

  // Store traceResult and speed in refs so the rAF callback always reads latest
  const traceRef = useRef(traceResult)
  traceRef.current = traceResult
  const speedRef = useRef(speed)
  speedRef.current = speed

  const play = useCallback(() => {
    const trace = traceRef.current
    if (!trace || trace.steps.length === 0) return

    const timeline = buildTimeline(trace)
    if (timeline.duration === 0) return

    // Stop any previous animation
    playingRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    playingRef.current = true
    const startTime = performance.now()

    const animate = (now: number) => {
      if (!playingRef.current) return

      const elapsed = (now - startTime) * speedRef.current
      const progress = Math.min(elapsed / timeline.duration, 1)
      const { knots, threads } = interpolateHighlights(timeline, progress)

      setAnimationState({
        traceResult: trace,
        progress,
        playing: progress < 1,
        speed: speedRef.current,
        activeKnots: knots,
        activeThreads: threads,
      })

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        playingRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, []) // No deps — reads from refs

  // Auto-play when traceResult changes
  useEffect(() => {
    if (traceResult && autoPlay) {
      // Use setTimeout(0) to escape React StrictMode's
      // mount→unmount→remount cycle that cancels synchronous rAF
      const tid = setTimeout(() => play(), 0)
      return () => {
        clearTimeout(tid)
        stop()
      }
    } else {
      stop()
    }
    return undefined
  }, [traceResult, autoPlay, play, stop])

  return { animationState, play, stop }
}
