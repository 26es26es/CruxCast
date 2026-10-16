import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { WallType } from '../setting'
import { clampOrbit, DEFAULT_ORBIT, MAX_ZOOM, zoomAt, type Orbit, type Point } from '../wallPerspective'

// Looking around the 3D wall. A one-finger or mouse drag either moves the picture or turns the
// wall (walking around it sideways, raising or lowering your eyes up and down): zooming in
// switches to moving, zooming back out to turning, and the setter can pick either. Right-drag
// does the other one. Pinch or Ctrl+scroll zooms around the fingers or pointer, and two fingers
// also move the picture. Drags glide on after you let go. Drags that start on an element marked
// data-no-orbit (a hold being edited) are left alone.

export type DragMode = 'turn' | 'move'

const DRAG_THRESHOLD = 5
// Degrees of turn and metres of eye height per drawing unit dragged.
const TURN_PER_UNIT = 0.09
const LIFT_PER_UNIT = 0.004
// Gliding after a drag: how fast it slows down (per 16 ms frame) and when it stops (units per ms).
const FRICTION = 0.9
const MIN_GLIDE_SPEED = 0.02
const ANIMATION_MS = 260

type Velocity = { x: number; y: number }

/** A drag of (dx, dy) drawing units applied to the view in the given mode. */
function dragged(orbit: Orbit, mode: DragMode, dx: number, dy: number): Orbit {
  if (mode === 'move') return { ...orbit, pan: { x: orbit.pan.x + dx, y: orbit.pan.y + dy } }
  // Dragging left brings the wall's right side into view; dragging down lifts your eyes.
  return { ...orbit, turn: orbit.turn - dx * TURN_PER_UNIT, lift: orbit.lift + dy * LIFT_PER_UNIT }
}

const mix = (from: number, to: number, t: number) => from + (to - from) * t
function between(from: Orbit, to: Orbit, t: number): Orbit {
  return {
    turn: mix(from.turn, to.turn, t),
    lift: mix(from.lift, to.lift, t),
    zoom: mix(from.zoom, to.zoom, t),
    pan: { x: mix(from.pan.x, to.pan.x, t), y: mix(from.pan.y, to.pan.y, t) },
  }
}

export function useWallOrbit(
  svgRef: RefObject<SVGSVGElement | null>,
  wallType: WallType,
  size: { width: number; height: number },
  options: { enabled: boolean; doubleClickZoom: boolean },
) {
  const [orbit, setOrbit] = useState<Orbit>(DEFAULT_ORBIT)
  const [mode, setModeState] = useState<DragMode>('turn')
  // True while a drag, pinch, glide or zoom is under way, so the wall can draw less detail meanwhile.
  const [moving, setMoving] = useState(false)
  const orbitRef = useRef(orbit)
  const modeRef = useRef(mode)
  const wasDragged = useRef(false)
  const frame = useRef<number | undefined>(undefined)
  const settle = useRef<number | undefined>(undefined)
  const { width, height } = size
  const { enabled, doubleClickZoom } = options

  const setMode = useCallback((next: DragMode) => {
    modeRef.current = next
    setModeState(next)
  }, [])

  const apply = useCallback(
    (next: Orbit) => {
      const before = orbitRef.current.zoom
      const clamped = clampOrbit(next, wallType, width, height)
      // Zooming in is usually followed by looking around the zoomed picture; at full view there is nothing to move.
      if (before <= 1 && clamped.zoom > 1) setMode('move')
      if (clamped.zoom <= 1 && modeRef.current === 'move') setMode('turn')
      orbitRef.current = clamped
      setOrbit(clamped)
    },
    [wallType, width, height, setMode],
  )

  const stopMotion = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
  }, [])

  /** Counts as moving now and for `ms` more, unless something else keeps it going. */
  const movingFor = useCallback((ms: number) => {
    setMoving(true)
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => setMoving(false), ms)
  }, [])

  /** Eases from the current view to `target` (used by the buttons and double-click). */
  const animateTo = useCallback(
    (target: Orbit) => {
      stopMotion()
      const from = orbitRef.current
      const to = clampOrbit(target, wallType, width, height)
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min((now - start) / ANIMATION_MS, 1)
        apply(between(from, to, 1 - (1 - t) ** 3))
        movingFor(80)
        frame.current = t < 1 ? requestAnimationFrame(step) : undefined
      }
      frame.current = requestAnimationFrame(step)
    },
    [apply, movingFor, stopMotion, wallType, width, height],
  )

  // A different wall has different limits.
  useEffect(() => apply(orbitRef.current), [apply])

  const turnBy = useCallback((turn: number) => animateTo({ ...orbitRef.current, turn: orbitRef.current.turn + turn }), [animateTo])
  const zoomBy = useCallback((factor: number) => animateTo(zoomAt(orbitRef.current, { x: width / 2, y: height / 2 }, factor)), [animateTo, width, height])
  const reset = useCallback(() => animateTo(DEFAULT_ORBIT), [animateTo])

  useEffect(() => {
    const svg = svgRef.current
    if (!enabled || !svg) return

    const pointers = new Map<number, Point>()
    let moved = 0
    let dragMode: DragMode = 'turn'
    let velocity: Velocity = { x: 0, y: 0 }
    let lastMove = 0

    // Pointer position in drawing units.
    const local = (event: { clientX: number; clientY: number }): Point => {
      const rect = svg.getBoundingClientRect()
      return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height }
    }

    const glide = () => {
      let last = performance.now()
      const step = (now: number) => {
        const elapsed = Math.min(now - last, 50)
        last = now
        const decay = FRICTION ** (elapsed / 16)
        velocity = { x: velocity.x * decay, y: velocity.y * decay }
        if (Math.hypot(velocity.x, velocity.y) < MIN_GLIDE_SPEED) {
          frame.current = undefined
          movingFor(0)
          return
        }
        apply(dragged(orbitRef.current, dragMode, velocity.x * elapsed, velocity.y * elapsed))
        frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    }

    const onWheel = (event: WheelEvent) => {
      // Plain scrolling scrolls the page; a trackpad pinch arrives as Ctrl+wheel.
      if (!event.ctrlKey) return
      event.preventDefault()
      stopMotion()
      movingFor(200)
      apply(zoomAt(orbitRef.current, local(event), Math.exp(-event.deltaY * 0.01)))
    }

    const onPointerDown = (event: PointerEvent) => {
      if ((event.button !== 0 && event.button !== 2) || (event.target as Element).closest('[data-no-orbit]')) return
      stopMotion()
      pointers.set(event.pointerId, local(event))
      if (pointers.size === 1) {
        moved = 0
        wasDragged.current = false
        velocity = { x: 0, y: 0 }
        lastMove = performance.now()
        // Right-drag (or Shift-drag) does whichever of turning and moving isn't selected.
        const other = event.button === 2 || event.shiftKey
        dragMode = other ? (modeRef.current === 'turn' ? 'move' : 'turn') : modeRef.current
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous) return
      const point = local(event)
      const current = orbitRef.current
      if (pointers.size === 1) {
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        moved += Math.abs(dx) + Math.abs(dy)
        if (moved < DRAG_THRESHOLD && !wasDragged.current) return
        wasDragged.current = true
        setMoving(true)
        // Smoothed speed, so letting go mid-swipe glides on at about the speed you were dragging.
        const now = performance.now()
        const elapsed = Math.max(now - lastMove, 1)
        lastMove = now
        velocity = { x: velocity.x * 0.4 + (dx / elapsed) * 0.6, y: velocity.y * 0.4 + (dy / elapsed) * 0.6 }
        apply(dragged(current, dragMode, dx, dy))
      } else if (pointers.size === 2) {
        // Pinch: zoom by the change in finger distance around the fingers, and move with their midpoint.
        const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1]
        const before = Math.hypot(previous.x - other.x, previous.y - other.y)
        const after = Math.hypot(point.x - other.x, point.y - other.y)
        const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 }
        const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }
        wasDragged.current = true
        setMoving(true)
        velocity = { x: 0, y: 0 }
        if (before > 0) {
          const zoomed = zoomAt(current, midBefore, after / before)
          apply({ ...zoomed, pan: { x: zoomed.pan.x + midAfter.x - midBefore.x, y: zoomed.pan.y + midAfter.y - midBefore.y } })
        }
      }
      pointers.set(event.pointerId, point)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (pointers.size > 0) {
        // Lifting one finger of a pinch: carry on with the other one without a jump.
        velocity = { x: 0, y: 0 }
        return
      }
      // A quick swipe glides on; a drag that stopped before letting go doesn't.
      const fresh = performance.now() - lastMove < 80
      if (wasDragged.current && fresh && Math.hypot(velocity.x, velocity.y) > MIN_GLIDE_SPEED * 3) glide()
      else movingFor(0)
    }

    const onDoubleClick = (event: MouseEvent) => {
      if (!doubleClickZoom) return
      const current = orbitRef.current
      if (current.zoom >= MAX_ZOOM - 0.01) animateTo(DEFAULT_ORBIT)
      else animateTo(zoomAt(current, local(event), 2))
    }

    // Right-drag is for looking around, not for the browser's menu.
    const onContextMenu = (event: MouseEvent) => event.preventDefault()

    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('dblclick', onDoubleClick)
    svg.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      svg.removeEventListener('wheel', onWheel)
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('dblclick', onDoubleClick)
      svg.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      stopMotion()
    }
  }, [animateTo, apply, doubleClickZoom, enabled, movingFor, stopMotion, svgRef, width, height])

  useEffect(() => () => window.clearTimeout(settle.current), [])

  return {
    orbit,
    moving,
    /** What a one-finger or mouse drag does. */
    mode,
    setMode,
    /** Whether the last gesture moved the view, so it shouldn't also count as a click. */
    wasDragged: () => wasDragged.current,
    turnBy,
    zoomBy,
    reset,
    /** Whether the view differs from the default one. */
    changed: JSON.stringify(orbit) !== JSON.stringify(DEFAULT_ORBIT),
  }
}
