import { useEffect, useRef } from 'react'

// Grid of cells that light up around the cursor and pulse outward on click.
// Ported from the CursorGrid background on sinankarasu.com.

const FALLOFFS = {
  linear: (t: number) => t,
  smooth: (t: number) => t * t * (3 - 2 * t),
}

type Props = {
  color: string
  cellSize?: number
  radius?: number
  falloff?: keyof typeof FALLOFFS
  holdTime?: number
  fadeDuration?: number
  lineWidth?: number
  maxOpacity?: number
  gridOpacity?: number
  pulseSpeed?: number
  /** Listen on the window so the grid works behind other content. */
  trackWindow?: boolean
  /** Clicks on elements matching this selector don't start a pulse. */
  ignoreSelector?: string
}

type Pulse = { x: number; y: number; start: number }

function hexToRgb(hex: string): [number, number, number] {
  const digits = hex.replace('#', '')
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits
  const value = parseInt(full, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function CursorGrid(props: Props) {
  const {
    cellSize = 70,
    radius = 150,
    falloff = 'smooth',
    holdTime = 250,
    fadeDuration = 1000,
    lineWidth = 1,
    maxOpacity = 0.22,
    gridOpacity = 0.02,
    pulseSpeed = 600,
    trackWindow = false,
    ignoreSelector = '',
  } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The animation loop reads options from a ref so a colour change doesn't restart it.
  const look = {
    color: props.color,
    radius,
    falloff,
    holdTime,
    fadeDuration,
    lineWidth,
    maxOpacity,
    gridOpacity,
    pulseSpeed,
  }
  const options = useRef(look)
  const wake = useRef<() => void>(() => undefined)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!container || !canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let cols = 0
    let rows = 0
    let offsetX = 0
    let offsetY = 0
    let width = 0
    let height = 0
    let intensity = new Float32Array(0)
    let touchedAt = new Float64Array(0)
    const pulses: Pulse[] = []
    let frame = 0
    let running = false
    let lastTime = 0

    const resize = () => {
      width = container.offsetWidth
      height = container.offsetHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(width / cellSize) + 1
      rows = Math.ceil(height / cellSize) + 1
      offsetX = (width - cols * cellSize) / 2
      offsetY = (height - rows * cellSize) / 2
      intensity = new Float32Array(cols * rows)
      touchedAt = new Float64Array(cols * rows)
    }

    const cellCenter = (index: number): [number, number] => [
      offsetX + (index % cols) * cellSize + cellSize / 2,
      offsetY + Math.floor(index / cols) * cellSize + cellSize / 2,
    ]

    const lightAround = (x: number, y: number) => {
      const o = options.current
      const r = Math.max(o.radius, 1)
      const ease = FALLOFFS[o.falloff]
      const now = performance.now()
      const colStart = Math.max(0, Math.floor((x - r - offsetX) / cellSize))
      const colEnd = Math.min(cols - 1, Math.floor((x + r - offsetX) / cellSize))
      const rowStart = Math.max(0, Math.floor((y - r - offsetY) / cellSize))
      const rowEnd = Math.min(rows - 1, Math.floor((y + r - offsetY) / cellSize))
      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const index = row * cols + col
          const [cx, cy] = cellCenter(index)
          const distance = Math.hypot(cx - x, cy - y)
          if (distance > r) continue
          const value = ease(1 - distance / r) * o.maxOpacity
          if (value > intensity[index]) {
            intensity[index] = value
            touchedAt[index] = now
          } else if (value > 0) {
            touchedAt[index] = now
          }
        }
      }
    }

    const draw = (time: number) => {
      const o = options.current
      const delta = Math.min(time - lastTime, 50)
      lastTime = time
      ctx.clearRect(0, 0, width, height)
      const [red, green, blue] = hexToRgb(o.color)
      const rgba = (alpha: number) => `rgba(${red}, ${green}, ${blue}, ${alpha})`

      if (o.gridOpacity > 0) {
        ctx.strokeStyle = rgba(o.gridOpacity)
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let col = 0; col <= cols; col++) {
          const x = Math.round(offsetX + col * cellSize) + 0.5
          ctx.moveTo(x, 0)
          ctx.lineTo(x, height)
        }
        for (let row = 0; row <= rows; row++) {
          const y = Math.round(offsetY + row * cellSize) + 0.5
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
        }
        ctx.stroke()
      }

      // Expanding rings from clicks light up the cells they pass through.
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i]
        const ringRadius = ((time - pulse.start) / 1000) * o.pulseSpeed
        if (ringRadius > Math.hypot(width, height)) {
          pulses.splice(i, 1)
          continue
        }
        const colStart = Math.max(0, Math.floor((pulse.x - ringRadius - cellSize - offsetX) / cellSize))
        const colEnd = Math.min(cols - 1, Math.floor((pulse.x + ringRadius + cellSize - offsetX) / cellSize))
        const rowStart = Math.max(0, Math.floor((pulse.y - ringRadius - cellSize - offsetY) / cellSize))
        const rowEnd = Math.min(rows - 1, Math.floor((pulse.y + ringRadius + cellSize - offsetY) / cellSize))
        for (let row = rowStart; row <= rowEnd; row++) {
          for (let col = colStart; col <= colEnd; col++) {
            const index = row * cols + col
            const [cx, cy] = cellCenter(index)
            const distance = Math.hypot(cx - pulse.x, cy - pulse.y)
            if (Math.abs(distance - ringRadius) < cellSize / 2 && o.maxOpacity > intensity[index]) {
              intensity[index] = o.maxOpacity
              touchedAt[index] = time
            }
          }
        }
      }

      let active = pulses.length > 0
      const fadeStep = delta / Math.max(o.fadeDuration, 16)
      const half = cellSize / 2
      for (let index = 0; index < intensity.length; index++) {
        let value = intensity[index]
        if (value <= 0) continue
        if (time - touchedAt[index] > o.holdTime) {
          value = Math.max(0, value - fadeStep)
          intensity[index] = value
          if (value <= 0) continue
        }
        active = true
        const [cx, cy] = cellCenter(index)
        const gradient = ctx.createRadialGradient(cx, cy, half * 0.1, cx, cy, cellSize)
        gradient.addColorStop(0, rgba(value))
        gradient.addColorStop(1, rgba(0))
        ctx.beginPath()
        ctx.rect(cx - half + 0.5, cy - half + 0.5, cellSize - 1, cellSize - 1)
        ctx.strokeStyle = gradient
        ctx.lineWidth = o.lineWidth
        ctx.stroke()
      }

      if (active) {
        frame = requestAnimationFrame(draw)
      } else {
        running = false
        // Leave the faint grid drawn while idle.
      }
    }

    const start = () => {
      if (running) return
      running = true
      lastTime = performance.now()
      frame = requestAnimationFrame(draw)
    }
    wake.current = start

    const localPoint = (event: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect()
      return [event.clientX - rect.left, event.clientY - rect.top]
    }
    const onMove = (event: PointerEvent) => {
      lightAround(...localPoint(event))
      start()
    }
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (ignoreSelector && target?.closest?.(ignoreSelector)) return
      const [x, y] = localPoint(event)
      pulses.push({ x, y, start: performance.now() })
      start()
    }

    const observer = new ResizeObserver(() => {
      resize()
      start()
    })
    observer.observe(container)
    resize()
    start()

    const target: Window | HTMLElement = trackWindow ? window : container
    target.addEventListener('pointermove', onMove as EventListener)
    target.addEventListener('pointerdown', onDown as EventListener)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerdown', onDown as EventListener)
    }
  }, [cellSize, trackWindow, ignoreSelector])

  // Hand the latest look to the loop and redraw (e.g. after switching theme).
  useEffect(() => {
    options.current = look
    wake.current()
  })

  return (
    <div ref={containerRef} className="cursor-grid">
      <canvas ref={canvasRef} className="cursor-grid__canvas" />
    </div>
  )
}
