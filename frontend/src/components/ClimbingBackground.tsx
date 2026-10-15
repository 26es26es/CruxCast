import { useEffect, useRef } from 'react'

// A faint grid of climbing pictograms, revealed by slowly drifting noise clouds.
// Drawn on one canvas from pre-rendered sprites at a low frame rate so it stays cheap.

type Glyph = {
  paths: string[]
  /** Holds look natural at any angle; people and shoes stay upright. */
  rotates: boolean
  /** Relative frequency. */
  weight: number
}

// Line drawings on a 24×24 grid, stroked like the icons in icons.tsx.
const GLYPHS: Glyph[] = [
  // Jug
  { paths: ['M3 18C3 10 8 5 14 5c4 0 7 2 7 5 0 2-2 3-4 3s-3 1-3 3v2z', 'M8.5 14a1 1 0 1 0 0 .01'], rotates: true, weight: 3 },
  // Sloper
  { paths: ['M3 18c0-6 4-10 9-10s9 4 9 10z', 'M12 14a1 1 0 1 0 0 .01'], rotates: true, weight: 3 },
  // Crimp
  { paths: ['M3 14a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1H3z'], rotates: true, weight: 3 },
  // Pocket
  { paths: ['M5 7c3-3 11-3 14 0s2 9-1 11-11 2-13-1-3-7 0-10z', 'M10 12.5a2.5 2 0 1 0 5 0a2.5 2 0 1 0-5 0'], rotates: true, weight: 2 },
  // Pinch
  { paths: ['M10 3c3 0 5 3 5 8s-1 10-4 10-4-4-4-9 0-9 3-9z', 'M11 12a1 1 0 1 0 0 .01'], rotates: true, weight: 2 },
  // Volume
  { paths: ['M3 19 12 5l9 14z', 'M12 5v14'], rotates: true, weight: 1 },
  // Climbing shoe
  { paths: ['M2 17c0-1.5 1-3 2.5-3H8l4-5c1-1 2.5-1 3.5 0l1.5 2c2.5 0 5 1.5 5 4v2z', 'M2 19h20', 'M11 10.5 13 14'], rotates: false, weight: 2 },
  // Climber reaching
  { paths: ['M15 4.5a1.5 1.5 0 1 0 0 .01', 'M14 7.5 12 13', 'M13.5 8.5 9 5', 'M13.5 8.5 19 7', 'M12 13l-4 3', 'M12 13l3 5'], rotates: false, weight: 2 },
  // Carabiner
  { paths: ['M9 3h5a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z', 'M9 8v8'], rotates: true, weight: 1 },
  // Chalk bag
  { paths: ['M6 9h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z', 'M5 9h14', 'M9 6.5l1-1.5M12 6V4M15 6.5l-1-1.5'], rotates: false, weight: 1 },
]

const WEIGHTED = GLYPHS.flatMap((glyph, index) => Array<number>(glyph.weight).fill(index))

const CELL = 30
const GLYPH_SIZE = 16
const FRAME_MS = 1000 / 15
/** Share of cells that swap to a new glyph each frame. */
const SWAP_RATE = 0.003
/** One in this many glyphs is drawn in the accent colour. */
const ACCENT_ODDS = 28

type Props = {
  color: string
  accent: string
  /** Opacity of a fully revealed glyph. */
  opacity: number
}

// ---------- Value noise ----------

const PERM = (() => {
  const values = Array.from({ length: 256 }, (_, i) => i)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return Uint8Array.from([...values, ...values])
})()

function lattice(x: number, y: number): number {
  return PERM[PERM[x & 255] + (y & 255)] / 255
}

function noise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const top = lattice(x0, y0) + (lattice(x0 + 1, y0) - lattice(x0, y0)) * u
  const bottom = lattice(x0, y0 + 1) + (lattice(x0 + 1, y0 + 1) - lattice(x0, y0 + 1)) * u
  return top + (bottom - top) * v
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** How visible the cell at (col, row) is at time t (seconds), from 0 to 1. */
function reveal(col: number, row: number, t: number): number {
  const broad = noise(col * 0.085 + t * 0.045, row * 0.085 - t * 0.03)
  const detail = noise(col * 0.2 - t * 0.035, row * 0.2 + t * 0.05)
  return smoothstep(0.5, 0.78, broad * 0.7 + detail * 0.3)
}

// ---------- Sprites ----------

function renderSprites(color: string, pixelRatio: number): HTMLCanvasElement[] {
  const size = Math.ceil(GLYPH_SIZE * pixelRatio)
  return GLYPHS.map((glyph) => {
    const sprite = document.createElement('canvas')
    sprite.width = size
    sprite.height = size
    const ctx = sprite.getContext('2d')!
    ctx.scale(size / 24, size / 24)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.75
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const path of glyph.paths) ctx.stroke(new Path2D(path))
    return sprite
  })
}

export function ClimbingBackground({ color, accent, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const look = useRef({ color, accent, opacity })
  const redraw = useRef<() => void>(() => undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let sprites = { main: [] as HTMLCanvasElement[], accent: [] as HTMLCanvasElement[], key: '' }
    let cols = 0
    let rows = 0
    let glyphs = new Uint8Array(0)
    let angles = new Float32Array(0)
    let accented = new Uint8Array(0)
    let frame = 0
    let lastFrame = -Infinity
    const startedAt = performance.now()

    const randomizeCell = (index: number) => {
      const glyph = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)]
      glyphs[index] = glyph
      angles[index] = GLYPHS[glyph].rotates ? (Math.random() - 0.5) * Math.PI : 0
      accented[index] = Math.random() * ACCENT_ODDS < 1 ? 1 : 0
    }

    const resize = () => {
      canvas.width = Math.round(canvas.offsetWidth * pixelRatio)
      canvas.height = Math.round(canvas.offsetHeight * pixelRatio)
      cols = Math.ceil(canvas.offsetWidth / CELL) + 1
      rows = Math.ceil(canvas.offsetHeight / CELL) + 1
      glyphs = new Uint8Array(cols * rows)
      angles = new Float32Array(cols * rows)
      accented = new Uint8Array(cols * rows)
      for (let i = 0; i < glyphs.length; i++) randomizeCell(i)
    }

    const draw = (now: number) => {
      const { color, accent, opacity } = look.current
      const key = `${color}|${accent}`
      if (sprites.key !== key) {
        sprites = { main: renderSprites(color, pixelRatio), accent: renderSprites(accent, pixelRatio), key }
      }

      const t = (now - startedAt) / 1000
      const half = GLYPH_SIZE / 2
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const alpha = reveal(col, row, t) * opacity
          if (alpha < 0.004) continue
          const index = row * cols + col
          const angle = angles[index]
          const cos = Math.cos(angle) * pixelRatio
          const sin = Math.sin(angle) * pixelRatio
          ctx.setTransform(cos, sin, -sin, cos, (col * CELL + CELL / 2) * pixelRatio, (row * CELL + CELL / 2) * pixelRatio)
          ctx.globalAlpha = alpha
          const sprite = (accented[index] ? sprites.accent : sprites.main)[glyphs[index]]
          ctx.drawImage(sprite, -half, -half, GLYPH_SIZE, GLYPH_SIZE)
        }
      }
      ctx.globalAlpha = 1
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - lastFrame < FRAME_MS) return
      lastFrame = now
      const swaps = Math.ceil(glyphs.length * SWAP_RATE)
      for (let i = 0; i < swaps; i++) randomizeCell(Math.floor(Math.random() * glyphs.length))
      draw(now)
    }

    const observer = new ResizeObserver(() => {
      resize()
      draw(performance.now())
    })
    observer.observe(canvas)
    resize()

    if (reduceMotion) {
      draw(performance.now())
      redraw.current = () => draw(performance.now())
    } else {
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      redraw.current = () => undefined
    }
  }, [])

  // Pick up theme changes; the animation loop reads this on its next frame.
  useEffect(() => {
    look.current = { color, accent, opacity }
    redraw.current()
  }, [color, accent, opacity])

  return <canvas ref={canvasRef} className="climbing-background" />
}
