/**
 * useGlamourCamera — Pan, zoom, fit-to-view camera controls.
 *
 * Handles mouse wheel zoom (toward cursor), middle-click pan,
 * and auto-fit on first render.
 */

import { useEffect, useCallback } from 'react'
import type { Weave } from '#weaver/core'
import type { Camera } from './types.js'
import { MIN_ZOOM, MAX_ZOOM, ZOOM_SPEED } from './types.js'

interface UseGlamourCameraOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  cameraRef: React.MutableRefObject<Camera>
  draggingRef: React.MutableRefObject<boolean>
  lastMouseRef: React.MutableRefObject<{ x: number; y: number }>
  applyCamera: () => void
  weave: Weave
}

export function useGlamourCamera({
  containerRef,
  cameraRef,
  draggingRef,
  lastMouseRef,
  applyCamera,
  weave,
}: UseGlamourCameraOptions) {
  // Fit camera so all knots are visible
  const fitToView = useCallback(() => {
    if (weave.knots.size === 0) return
    const el = containerRef.current
    if (!el) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const knot of weave.knots.values()) {
      minX = Math.min(minX, knot.position.x - 80)
      minY = Math.min(minY, knot.position.y - 80)
      maxX = Math.max(maxX, knot.position.x + 80)
      maxY = Math.max(maxY, knot.position.y + 80)
    }

    const graphW = maxX - minX
    const graphH = maxY - minY
    const viewW = el.clientWidth
    const viewH = el.clientHeight

    const zoom = Math.min(viewW / graphW, viewH / graphH, 1.5) * 0.85
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    cameraRef.current = {
      x: viewW / 2 - cx * zoom,
      y: viewH / 2 - cy * zoom,
      zoom,
    }
    applyCamera()
  }, [weave, applyCamera, containerRef, cameraRef])

  // Mouse wheel zoom + middle-click pan
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const camera = cameraRef.current
      const zoomDelta = -e.deltaY * ZOOM_SPEED
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * (1 + zoomDelta)))

      // Zoom toward mouse position
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const scale = newZoom / camera.zoom
      camera.x = mx - scale * (mx - camera.x)
      camera.y = my - scale * (my - camera.y)
      camera.zoom = newZoom

      applyCamera()
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey && !e.shiftKey)) {
        draggingRef.current = true
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        e.preventDefault()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      cameraRef.current.x += dx
      cameraRef.current.y += dy
      applyCamera()
    }

    const handleMouseUp = () => {
      draggingRef.current = false
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, cameraRef, draggingRef, lastMouseRef, applyCamera])

  return { fitToView }
}
