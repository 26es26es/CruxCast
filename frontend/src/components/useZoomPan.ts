import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

// Zoom and pan for the gym map: wheel or pinch to zoom around the pointer, drag to
// move, double-click to zoom in. The view is a scale plus an offset in pixels, kept
// so the plan always covers the frame.

export type View = { scale: number; x: number; y: number }

const MIN_SCALE = 1
const MAX_SCALE = 8
const DRAG_THRESHOLD = 4
const ANIMATION_MS = 300

const IDENTITY: View = { scale: 1, x: 0, y: 0 }

function clampView(view: View, width: number, height: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale))
  return {
    scale,
    x: Math.min(0, Math.max(width - width * scale, view.x)),
    y: Math.min(0, Math.max(height - height * scale, view.y)),
  }
}

export function useZoomPan(frameRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [view, setView] = useState<View>(IDENTITY)
  const [animating, setAnimating] = useState(false)
  const viewRef = useRef(view)
  const animationTimer = useRef<number | undefined>(undefined)

  const apply = useCallback(
    (next: View, animate = false) => {
      const frame = frameRef.current
      if (!frame) return
      const clamped = clampView(next, frame.clientWidth, frame.clientHeight)
      viewRef.current = clamped
      setView(clamped)
      window.clearTimeout(animationTimer.current)
      setAnimating(animate)
      if (animate) animationTimer.current = window.setTimeout(() => setAnimating(false), ANIMATION_MS)
    },
    [frameRef],
  )

  /** Zooms by `factor`, keeping the point (px, py) in the frame where it is. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number, animate = false) => {
      const current = viewRef.current
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor))
      const ratio = scale / current.scale
      apply({ scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }, animate)
    },
    [apply],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const frame = frameRef.current
      if (frame) zoomAt(factor, frame.clientWidth / 2, frame.clientHeight / 2, true)
    },
    [frameRef, zoomAt],
  )

  const reset = useCallback(() => apply(IDENTITY, true), [apply])

  /** Fits a box (in fractions of the plan) into the frame, at most `maxScale`. */
  const focusOn = useCallback(
    (box: { left: number; top: number; right: number; bottom: number }, maxScale = MAX_SCALE, animate = true) => {
      const frame = frameRef.current
      if (!frame) return
      const width = frame.clientWidth
      const height = frame.clientHeight
      const boxWidth = Math.max((box.right - box.left) * width, 1)
      const boxHeight = Math.max((box.bottom - box.top) * height, 1)
      const scale = Math.min(maxScale, MAX_SCALE, 0.8 * Math.min(width / boxWidth, height / boxHeight))
      const centerX = ((box.left + box.right) / 2) * width
      const centerY = ((box.top + box.bottom) / 2) * height
      apply({ scale, x: width / 2 - centerX * scale, y: height / 2 - centerY * scale }, animate)
    },
    [apply, frameRef],
  )

  useEffect(() => {
    const frame = frameRef.current
    if (!enabled || !frame) return

    const pointers = new Map<number, { x: number; y: number }>()
    let moved = 0
    let dragged = false

    const local = (event: { clientX: number; clientY: number }) => {
      const rect = frame.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = local(event)
      zoomAt(Math.exp(-event.deltaY * 0.0015), point.x, point.y)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      pointers.set(event.pointerId, local(event))
      moved = 0
      dragged = false
    }

    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous) return
      const point = local(event)

      if (pointers.size === 1) {
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        moved += Math.abs(dx) + Math.abs(dy)
        if (moved > DRAG_THRESHOLD) dragged = true
        const current = viewRef.current
        apply({ ...current, x: current.x + dx, y: current.y + dy })
      } else if (pointers.size === 2) {
        // Pinch: zoom by the change in finger distance, pan by the midpoint's move.
        const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1]
        const before = Math.hypot(previous.x - other.x, previous.y - other.y)
        const after = Math.hypot(point.x - other.x, point.y - other.y)
        const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 }
        const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }
        dragged = true
        if (before > 0) {
          const current = viewRef.current
          const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * (after / before)))
          const ratio = scale / current.scale
          apply({
            scale,
            x: midAfter.x - (midBefore.x - current.x) * ratio,
            y: midAfter.y - (midBefore.y - current.y) * ratio,
          })
        }
      }
      pointers.set(event.pointerId, point)
    }

    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
    }

    // A drag shouldn't also count as clicking the dot it started on.
    const onClickCapture = (event: MouseEvent) => {
      if (dragged) {
        event.stopPropagation()
        event.preventDefault()
        dragged = false
      }
    }

    const onDoubleClick = (event: MouseEvent) => {
      if ((event.target as Element).closest('button')) return
      const point = local(event)
      zoomAt(2, point.x, point.y, true)
    }

    const resize = new ResizeObserver(() => apply(viewRef.current))
    resize.observe(frame)

    frame.addEventListener('wheel', onWheel, { passive: false })
    frame.addEventListener('pointerdown', onPointerDown)
    frame.addEventListener('click', onClickCapture, true)
    frame.addEventListener('dblclick', onDoubleClick)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      resize.disconnect()
      frame.removeEventListener('wheel', onWheel)
      frame.removeEventListener('pointerdown', onPointerDown)
      frame.removeEventListener('click', onClickCapture, true)
      frame.removeEventListener('dblclick', onDoubleClick)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [apply, enabled, frameRef, zoomAt])

  useEffect(() => () => window.clearTimeout(animationTimer.current), [])

  return { view, animating, zoomBy, reset, focusOn, minScale: MIN_SCALE, maxScale: MAX_SCALE }
}
