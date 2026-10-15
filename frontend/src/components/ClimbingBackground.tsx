import { useEffect, useRef } from 'react'

// A faint grid of climbing pictograms, revealed by slowly drifting noise clouds.
// Drawn on one canvas from pre-rendered sprites at a low frame rate so it stays cheap.

type Glyph = {
  paths: string[]
  /** Holds can sit at any angle; people and gear only tilt a little. */
  spin: boolean
  /** Relative frequency. */
  weight: number
}

// Line drawings on a 24×24 grid. Mostly climbers and shoes, so it reads as climbing.
const GLYPHS: Glyph[] = [
  // Climber reaching for a hold
  { paths: ['M15 4.5a1.5 1.5 0 1 0 0 .01', 'M14 7.5 12 13', 'M13.5 8.5 9 5', 'M13.5 8.5 19 7', 'M12 13l-4 3', 'M12 13l3 5'], spin: false, weight: 3 },
  // Climber mid-dyno
  { paths: ['M12 4.2a1.6 1.6 0 1 0 0 .01', 'M12 6.8V13', 'M12 8.2 7.5 3.8', 'M12 8.2l4.5-4.4', 'M12 13l-4 5.5', 'M12 13l4 5.5', 'M4.5 20.5h3M16.5 20.5h3'], spin: false, weight: 3 },
  // Climber hanging from a hold
  { paths: ['M14 2.5h4', 'M11 7.2a1.6 1.6 0 1 0 0 .01', 'M12.2 8.5 15.5 3', 'M11.5 9.6 11 15', 'M11.5 10.2 8 13.2', 'M11 15l-2 5', 'M11 15l2.6 4.6'], spin: false, weight: 3 },
  // Climber heel-hooking
  { paths: ['M8 5a1.5 1.5 0 1 0 0 .01', 'M9 7.5 12 12', 'M9.2 8.2 5.5 4', 'M10.2 9.4 14.5 8.2', 'M12 12l5.5-2.8 1.5 1.3', 'M12 12l-1 7'], spin: false, weight: 3 },
  // Climber topping out
  { paths: ['M12 6a1.6 1.6 0 1 0 0 .01', 'M12 8.6V14', 'M12 10 8 6', 'M12 10l4-4', 'M12 14l-2.2 6', 'M12 14l2.2 6', 'M3 21h18'], spin: false, weight: 3 },
  // Downturned climbing shoe with velcro straps
  { paths: ['M3.2 17.4C2.3 15.8 2.4 12.7 3.8 10.6h5.6c2.5 1.5 6.4 2.7 9.4 3.7 1.9.6 3.1 1.4 3.4 2.3-.4 1-1.7 1.4-3.1 1.4H5c-.8 0-1.4-.2-1.8-.6z', 'M12.6 16.6c2.7-.5 5.7-.7 9.2.1', 'M3.8 10.6 3.2 8.2h1.7', 'M8.6 10.8l-1.1 4.5', 'M11.9 12.1l-1.1 4'], spin: false, weight: 4 },
  // Chalk bag with a fleece rim and chalk dust
  { paths: ['M5.5 9.5c1-1.2 2-1.2 3 0s2 1.2 3 0 2-1.2 3 0 2 1.2 3 0', 'M6.3 10.3l.9 8.4a2.5 2.5 0 0 0 2.5 2.3h4.6a2.5 2.5 0 0 0 2.5-2.3l.9-8.4', 'M7 15h10', 'M10 6h.01M12.5 4.5h.01M14.5 6.2h.01M11.5 2.5h.01'], spin: false, weight: 2 },
  // Chalky hand
  { paths: ['M8.3 21C6.2 19.6 5 17.2 5 14.6V10.4a1.2 1.2 0 0 1 2.4 0V13V5.6a1.2 1.2 0 0 1 2.4 0V12V4.4a1.2 1.2 0 0 1 2.4 0V12V5.6a1.2 1.2 0 0 1 2.4 0V13.4l1.5-2.1a1.3 1.3 0 0 1 2.1 1.5l-2.3 4.6C15.6 19.6 13.6 21 11.2 21z'], spin: false, weight: 3 },
  // Crash pad
  { paths: ['M3.5 9.5h17a1.6 1.6 0 0 1 0 3.2h-17a1.6 1.6 0 0 1 0-3.2z', 'M3.5 13.5h17a1.6 1.6 0 0 1 0 3.2h-17a1.6 1.6 0 0 1 0-3.2z', 'M8 8.6v9M16 8.6v9'], spin: false, weight: 1 },
  // Boulder brush
  { paths: ['M4 20.5l8.2-8.2', 'M12.2 12.3l2-2 5.5 5.5-2 2z', 'M14.9 15.4l-1 1M16.6 17.1l-1 1M17.4 13.7l1-1M15.7 12l1-1'], spin: false, weight: 1 },
  // Hangboard
  { paths: ['M2.5 7h19v6h-19z', 'M5.5 10.3h3.5M10.3 10.3h3.4M15 10.3h3.5', 'M6.5 7V4.5M17.5 7V4.5'], spin: false, weight: 1 },
  // Summit
  { paths: ['M2 20 9.5 8l3.5 5.5L15.5 10 22 20z', 'M9.5 8V3.5l3.5 1.2-3.5 1.2'], spin: false, weight: 1 },
  // Jug
  { paths: ['M3 18C3 10 8 5 14 5c4 0 7 2 7 5 0 2-2 3-4 3s-3 1-3 3v2z', 'M8.5 14a1 1 0 1 0 0 .01'], spin: true, weight: 1 },
  // Sloper
  { paths: ['M3 18c0-6 4-10 9-10s9 4 9 10z', 'M12 14a1 1 0 1 0 0 .01'], spin: true, weight: 1 },
  // Crimp
  { paths: ['M3 14a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1H3z'], spin: true, weight: 1 },
  // Pocket
  { paths: ['M5 7c3-3 11-3 14 0s2 9-1 11-11 2-13-1-3-7 0-10z', 'M10 12.5a2.5 2 0 1 0 5 0a2.5 2 0 1 0-5 0'], spin: true, weight: 1 },
  // Pinch
  { paths: ['M10 3c3 0 5 3 5 8s-1 10-4 10-4-4-4-9 0-9 3-9z', 'M11 12a1 1 0 1 0 0 .01'], spin: true, weight: 1 },
]

const WEIGHTED = GLYPHS.flatMap((glyph, index) => Array<number>(glyph.weight).fill(index))

const CELL = 38
const GLYPH_SIZE = 22
const FRAME_MS = 1000 / 15
/** Share of cells that swap to a new glyph each frame. */
const SWAP_RATE = 0.003
/** Share of glyphs drawn in each brand colour instead of the neutral one. */
const TINT_SHARE = 1 / 7

type Props = {
  color: string
  /** Brand colours a few glyphs are drawn in (pink and blue). */
  tints: [string, string]
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
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const path of glyph.paths) ctx.stroke(new Path2D(path))
    return sprite
  })
}

export function ClimbingBackground({ color, tints, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const look = useRef({ color, tints, opacity })
  const redraw = useRef<() => void>(() => undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    // Index 0 is the neutral colour, 1 and 2 the brand tints.
    let sprites = { sets: [] as HTMLCanvasElement[][], key: '' }
    let cols = 0
    let rows = 0
    let glyphs = new Uint8Array(0)
    let angles = new Float32Array(0)
    let tinted = new Uint8Array(0)
    let frame = 0
    let lastFrame = -Infinity
    const startedAt = performance.now()

    const randomizeCell = (index: number) => {
      const glyph = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)]
      glyphs[index] = glyph
      const range = GLYPHS[glyph].spin ? Math.PI : 0.4
      angles[index] = (Math.random() - 0.5) * range
      const roll = Math.random()
      tinted[index] = roll < TINT_SHARE ? 1 : roll < 2 * TINT_SHARE ? 2 : 0
    }

    const resize = () => {
      canvas.width = Math.round(canvas.offsetWidth * pixelRatio)
      canvas.height = Math.round(canvas.offsetHeight * pixelRatio)
      cols = Math.ceil(canvas.offsetWidth / CELL) + 1
      rows = Math.ceil(canvas.offsetHeight / CELL) + 1
      glyphs = new Uint8Array(cols * rows)
      angles = new Float32Array(cols * rows)
      tinted = new Uint8Array(cols * rows)
      for (let i = 0; i < glyphs.length; i++) randomizeCell(i)
    }

    const draw = (now: number) => {
      const { color, tints, opacity } = look.current
      const key = [color, ...tints].join('|')
      if (sprites.key !== key) {
        sprites = { sets: [color, ...tints].map((c) => renderSprites(c, pixelRatio)), key }
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
          const sprite = sprites.sets[tinted[index]][glyphs[index]]
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
    look.current = { color, tints, opacity }
    redraw.current()
  }, [color, tints, opacity])

  return <canvas ref={canvasRef} className="climbing-background" />
}
