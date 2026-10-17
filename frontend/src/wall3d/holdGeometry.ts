import * as THREE from 'three'
import { shapeCount, shapeName, VOLUME_SOLIDS } from '../holdShapes'
import type { HoldType } from '../setting'

// Climbing holds as 3D meshes, built from a few shapes real holds share. All are one unit
// in radius, with x across the wall, y up it and z out of it, and the gripping side facing
// up (+y) at rotation 0, so an undercling is a jug turned upside down.
//
// - Directional holds (jugs, crimps, edges, sidepulls) are a cross-section swept sideways
//   and tapered at the ends: a jug's section curls into a lip over a scoop.
// - Rounded holds (slopers, foot chips, macros, pockets) are domes over a wobbly outline.
// - Pinches are a fin; volumes are flat-faced solids.
//
// Each type comes in several named shapes (see HOLD_VARIANTS), with a little surface noise so
// no two look machine-made. Some have a smooth zone (dual-texture), drawn glossier.

export type HoldModel = {
  geometry: THREE.BufferGeometry
  /** Where the bolt sits on the surface, or null if the hold has none showing. */
  bolt: THREE.Vector3 | null
}

// ---------- noise ----------

function hash(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441) ^ Math.imul(seed, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const fade = (t: number) => t * t * (3 - 2 * t)

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const [ix, iy, iz] = [Math.floor(x), Math.floor(y), Math.floor(z)]
  const [fx, fy, fz] = [fade(x - ix), fade(y - iy), fade(z - iz)]
  const corner = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz, seed)
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  return mix(
    mix(mix(corner(0, 0, 0), corner(1, 0, 0), fx), mix(corner(0, 1, 0), corner(1, 1, 0), fx), fy),
    mix(mix(corner(0, 0, 1), corner(1, 0, 1), fx), mix(corner(0, 1, 1), corner(1, 1, 1), fx), fy),
    fz,
  )
}

/** Smooth noise in about -0.5..0.5. */
function noise(x: number, y: number, z: number, seed: number): number {
  return valueNoise(x, y, z, seed) * 0.65 + valueNoise(x * 2.3, y * 2.3, z * 2.3, seed + 7) * 0.35 - 0.5
}

const smoothstep = (low: number, high: number, value: number) => fade(Math.min(Math.max((value - low) / (high - low), 0), 1))

/** A random number generator that gives the same numbers for the same seed. */
function seeded(seed: number) {
  let state = seed * 9301 + 49297
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

// ---------- shapes ----------

type Section = [number, number][] // (y, z) points from the wall at the bottom, round the front, back to the wall

type SweepOptions = {
  /** How blunt the ends are: high is square, low is round. */
  ends: number
  /** How much of the section's height is kept at the very ends (1 keeps it all). */
  flatten: number
  slices?: number
  /** Shade the hollow behind the lip (a jug's bucket, an incut). */
  incut?: boolean
  /** Curves the hold along its length (a crescent). */
  bow?: number
  /** Per-slice changes along the length (s from -1 to 1): a scale, and a shift up or down. */
  along?: (s: number) => { scale?: number; lift?: number }
  /** Final say on each point: s along the length, t round the section (0 at the bottom, 1 at the top). */
  deform?: (s: number, t: number, y: number, z: number) => [number, number]
  /** Where the surface is smooth (dual-texture), 0..1. */
  smooth?: (s: number, t: number, y: number, z: number) => number
}

/** Sweeps a cross-section sideways from x = -1 to 1, shaped along its length. */
function sweep(section: Section, options: SweepOptions): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(section.map(([y, z]) => new THREE.Vector2(y, z)))
  // The front is smooth; the back lies flat on the wall.
  const outline = curve.getPoints(80).map((p) => new THREE.Vector2(p.x, Math.max(p.y, 0)))
  outline.push(outline[0].clone())
  // Behind the lip (an incut, a jug's bucket) little light gets in: from the lip's crest (its
  // highest point clear of the wall) back round to the wall is shaded dark.
  const deepest = Math.max(...outline.map((point) => point.y))
  let crest = -1
  if (options.incut) {
    for (const [j, point] of outline.entries()) if (point.y > 0.3 * deepest && (crest < 0 || point.x > outline[crest].x)) crest = j
  }
  const shadeAt = (j: number) => (crest < 0 || j <= crest ? 1 : 1 - 0.7 * smoothstep(crest + 1, crest + 11, j))
  const slices = options.slices ?? 40
  const positions: number[] = []
  const uvs: number[] = []
  const shades: number[] = []
  const smooth: number[] = []
  for (let i = 0; i <= slices; i++) {
    const s = -1 + (2 * i) / slices
    // A superellipse: blunt ends for high `ends`, rounded for low.
    const width = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), options.ends)), 1 / options.ends)
    const bend = (options.bow ?? 0) * (1 - s * s)
    const { scale = 1, lift = 0 } = options.along?.(s) ?? {}
    for (const [j, point] of outline.entries()) {
      const t = j / (outline.length - 1)
      let y = point.x * (options.flatten + (1 - options.flatten) * width) * scale + bend + lift
      let z = point.y * width * scale
      if (options.deform) [y, z] = options.deform(s, t, y, z)
      positions.push(s, y, Math.max(z, 0))
      uvs.push(i / slices, t)
      // Where the ends close up there is no hollow left, so the shading fades out there.
      shades.push(1 - (1 - shadeAt(j)) * Math.sqrt(width))
      smooth.push(options.smooth?.(s, t, y, z) ?? 0)
    }
  }
  const indices: number[] = []
  const ring = outline.length
  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j
      const b = (i + 1) * ring + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('shade', new THREE.Float32BufferAttribute(shades, 1))
  if (options.smooth) geometry.setAttribute('smooth', new THREE.Float32BufferAttribute(smooth, 1))
  geometry.setIndex(indices)
  return geometry
}

type Field = (r: number, angle: number, x: number, y: number) => number

type DomeOptions = {
  across: number
  up: number
  wobble: number
  seed: number
  /** The footprint's outline as a radius per angle (1 is the plain ellipse), before wobble. */
  outline?: (angle: number) => number
  shade?: Field
  smooth?: Field
  /** Finer meshes for shapes with small features (pocket holes). */
  rings?: number
  segments?: number
}

/** A raised shape over a footprint: `height` gives its height at each point (r is 0 in the middle, 1 at the edge). */
function dome(height: Field, options: DomeOptions): THREE.BufferGeometry {
  const rings = options.rings ?? 32
  const segments = options.segments ?? 96
  const random = seeded(options.seed)
  const waves = [2, 3, 5].map((k) => ({ k, phase: random() * Math.PI * 2, size: options.wobble / k }))
  const edge = (angle: number) => (options.outline?.(angle) ?? 1) * (1 + waves.reduce((sum, wave) => sum + wave.size * Math.sin(wave.k * angle + wave.phase), 0))
  const positions: number[] = []
  const uvs: number[] = []
  const shades: number[] = []
  const smooth: number[] = []
  const add = (r: number, angle: number) => {
    const x = Math.cos(angle) * r * edge(angle) * options.across
    const y = Math.sin(angle) * r * edge(angle) * options.up
    positions.push(x, y, Math.max(height(r, angle, x, y), 0))
    uvs.push(0.5 + x / 2, 0.5 + y / 2)
    shades.push(options.shade?.(r, angle, x, y) ?? 1)
    smooth.push(options.smooth?.(r, angle, x, y) ?? 0)
  }
  add(0, 0)
  for (let ring = 1; ring <= rings; ring++) {
    for (let segment = 0; segment < segments; segment++) add(ring / rings, (segment / segments) * Math.PI * 2)
  }
  const indices: number[] = []
  for (let segment = 0; segment < segments; segment++) indices.push(0, 1 + segment, 1 + ((segment + 1) % segments))
  for (let ring = 1; ring < rings; ring++) {
    const inner = 1 + (ring - 1) * segments
    const outer = 1 + ring * segments
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments
      indices.push(inner + segment, outer + segment, outer + next, inner + segment, outer + next, inner + next)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('shade', new THREE.Float32BufferAttribute(shades, 1))
  if (options.smooth) geometry.setAttribute('smooth', new THREE.Float32BufferAttribute(smooth, 1))
  geometry.setIndex(indices)
  return geometry
}

/** Moves the surface in and out a little, then works out the shading normals again. */
function roughen(geometry: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)]
    // Keep the back flat against the wall.
    if (z < 0.01) continue
    if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) continue
    const push = noise(x * 2.2, y * 2.2, z * 2.2, seed) * amount
    position.setXYZ(i, x + normal.getX(i) * push, y + normal.getY(i) * push, Math.max(z + normal.getZ(i) * push, 0))
  }
  geometry.computeVertexNormals()
  return geometry
}

/** Nudges a cross-section's points a little, the same way for the same seed. */
function vary(section: Section, seed: number, amount: number): Section {
  const random = seeded(seed)
  return section.map(([y, z], index) => (index === 0 || index === section.length - 1 ? [y, z] : [y + (random() - 0.5) * amount, z * (1 + (random() - 0.5) * amount)]))
}

const scaled = (section: Section, y: number, z: number): Section => section.map(([py, pz]) => [py * y, pz * z])

// A jug: up off the wall, round a fat front, over a thick lip and down into a deep bucket for the
// fingers, then back up the wall behind it. The lip sits lower than the back of the bucket, so the
// opening faces up and out, as on real jugs, and you can see into it from in front.
const JUG: Section = [
  [-0.7, 0], [-0.6, 0.24], [-0.4, 0.48], [-0.12, 0.62], [0.15, 0.66], [0.35, 0.63], [0.45, 0.56], [0.47, 0.47],
  [0.42, 0.4], [0.3, 0.35], [0.12, 0.3], [-0.02, 0.22], [-0.05, 0.12], [0.05, 0.05], [0.28, 0.02], [0.5, 0.01], [0.66, 0],
]
// A deep jug: a taller lip over a bucket you can sink your whole hand into.
const DEEP_JUG: Section = [
  [-0.75, 0], [-0.66, 0.3], [-0.45, 0.6], [-0.15, 0.78], [0.18, 0.82], [0.38, 0.78], [0.48, 0.68], [0.48, 0.57],
  [0.4, 0.5], [0.24, 0.46], [0.04, 0.4], [-0.14, 0.28], [-0.18, 0.13], [-0.06, 0.04], [0.22, 0.015], [0.5, 0.005], [0.68, 0],
]
// A crimp: a thin squared rail, flat in front, with a crisp lip and a small incut behind it.
// Points close together keep corners sharp after smoothing.
const CRIMP: Section = [
  [-0.32, 0], [-0.31, 0.08], [-0.27, 0.15], [-0.15, 0.19], [0.05, 0.205], [0.17, 0.21], [0.21, 0.2], [0.225, 0.18],
  [0.2, 0.15], [0.15, 0.13], [0.13, 0.1], [0.17, 0.06], [0.24, 0.02], [0.33, 0],
]
// An edge: a deeper shelf with a square front; its top slopes slightly down into the wall.
const EDGE: Section = [
  [-0.45, 0], [-0.43, 0.12], [-0.37, 0.25], [-0.22, 0.33], [0.08, 0.36], [0.28, 0.36], [0.35, 0.34], [0.38, 0.3],
  [0.35, 0.23], [0.31, 0.15], [0.3, 0.09], [0.36, 0.035], [0.45, 0],
]
// An incut edge: the same shelf with a deep, hooked incut behind its lip.
const INCUT_EDGE: Section = [
  [-0.45, 0], [-0.43, 0.13], [-0.36, 0.27], [-0.2, 0.36], [0.1, 0.4], [0.3, 0.4], [0.38, 0.36], [0.4, 0.3],
  [0.34, 0.25], [0.24, 0.22], [0.18, 0.15], [0.22, 0.07], [0.32, 0.02], [0.45, 0],
]
// A rounded edge with no lip: positive at the top, smooth and round in front.
const ROUND_EDGE: Section = [[-0.45, 0], [-0.42, 0.16], [-0.3, 0.3], [-0.08, 0.38], [0.16, 0.38], [0.32, 0.3], [0.4, 0.16], [0.44, 0]]
// A pinch: a symmetric fin, swept sideways and then stood upright.
const FIN: Section = [[-0.36, 0], [-0.3, 0.3], [-0.14, 0.62], [0, 0.7], [0.14, 0.62], [0.3, 0.3], [0.36, 0]]
// A block pinch: square sides and a flat top.
const BLOCK: Section = [[-0.42, 0], [-0.41, 0.25], [-0.38, 0.48], [-0.28, 0.56], [0, 0.58], [0.28, 0.56], [0.38, 0.48], [0.41, 0.25], [0.42, 0]]
// A wedge pinch: steep on one side, gently sloping on the other.
const WEDGE: Section = [[-0.5, 0], [-0.38, 0.2], [-0.15, 0.48], [0.05, 0.66], [0.16, 0.62], [0.24, 0.4], [0.3, 0.15], [0.32, 0]]
// A round rail, for rolled slopers and tufas.
const ROUND: Section = [[-0.6, 0], [-0.52, 0.28], [-0.28, 0.48], [0, 0.53], [0.28, 0.48], [0.52, 0.28], [0.6, 0]]

/** Holes for pockets: each an ellipse (centre, half-widths), its depth, and how far its bottom is pushed up (an incut). */
type Hole = { x: number; y: number; rx: number; ry: number; depth: number; hook?: number }

/** How far into the holes a point is (0 outside, up to 1 at the bottom of a hole). */
function inHoles(holes: Hole[], x: number, y: number): number {
  let deepest = 0
  for (const hole of holes) {
    // The hole's bottom sits higher than its middle when it is hooked, so the fingers catch an incut.
    const dy = (y - hole.y) / hole.ry
    const d = Math.hypot((x - hole.x) / hole.rx, dy - (hole.hook ?? 0) * (1 - Math.min(1, Math.abs(dy))) * 0.3)
    const inside = 1 - smoothstep(0.62, 1, d)
    deepest = Math.max(deepest, inside * hole.depth)
  }
  return deepest
}

/** A pocket hold: a rounded pad with finger holes sunk into it. */
function pocket(holes: Hole[], options: { height: number; across: number; up: number; wobble: number; seed: number; slope?: number; outline?: (angle: number) => number; smooth?: Field }) {
  const pad = (r: number, y: number) => options.height * Math.pow(Math.max(0, 1 - Math.pow(r, 5)), 0.45) * (1 + (options.slope ?? 0) * y)
  const depthAt = (x: number, y: number) => inHoles(holes, x, y)
  return dome(
    (r, _angle, x, y) => Math.max(pad(r, y) * (1 - depthAt(x, y)), 0.03),
    {
      across: options.across, up: options.up, wobble: options.wobble, seed: options.seed, outline: options.outline, smooth: options.smooth,
      rings: 48, segments: 132,
      // Deeper in a hole is darker.
      shade: (_r, _angle, x, y) => 1 - 0.8 * Math.pow(depthAt(x, y) / Math.max(...holes.map((hole) => hole.depth)), 0.7),
    },
  )
}

/** An almond (eye) outline: pointed at both ends across. */
const almond = (angle: number) => 1 - 0.32 * Math.pow(Math.abs(Math.cos(angle)), 3) + 0.06 * Math.sin(angle) ** 2
/** A trapezoid outline: wider at the bottom than at the top. */
const trapezoid = (angle: number) => {
  const [c, sn] = [Math.cos(angle), Math.sin(angle)]
  // Distance to a rounded trapezoid with corners at (±1, -0.8) and (±0.62, 0.8).
  const halfWidth = 0.81 - 0.24 * sn
  const box = 1 / Math.max(Math.abs(c) / halfWidth, Math.abs(sn) / 0.85)
  return Math.min(box, 1.08)
}

/** A gentle Gaussian bump (or dip, with a negative size) centred at (cx, cy). */
const bump = (x: number, y: number, cx: number, cy: number, width: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (width * width))

function build(type: Exclude<HoldType, 'volume'>, variant: number): THREE.BufferGeometry {
  const name = shapeName(type, variant)
  const seed = (name.length * 31 + variant * 101 + type.length * 7) | 0
  const random = seeded(seed)
  switch (name) {
    // ---- jugs (and underclings, which are jugs turned over) ----
    case 'bucket':
      return roughen(sweep(vary(JUG, seed, 0.05), { ends: 2.4 + random() * 0.8, flatten: 0.5, incut: true }), 0.02, seed)
    case 'ear':
      // Two rounded lobes, one at each end, like ears: wider and taller at the ends.
      return roughen(sweep(vary(JUG, seed, 0.04), { ends: 1.6, flatten: 0.55, incut: true, along: (s) => ({ scale: 0.78 + 0.32 * s * s }) }), 0.02, seed)
    case 'horn':
      // A horn: the lip sweeps up into a point at one end.
      return roughen(
        sweep(vary(JUG, seed, 0.04), {
          ends: 1.5, flatten: 0.45, incut: true,
          along: (s) => ({ scale: 0.75 + 0.3 * Math.max(0, s), lift: 0.4 * Math.max(0, s) ** 2 }),
        }),
        0.02, seed,
      )
    case 'rail':
      // A long, slim jug rail with square ends.
      return roughen(sweep(scaled(JUG, 0.62, 0.62), { ends: 7, flatten: 0.85, incut: true }), 0.015, seed)
    case 'ladder':
      // A ladder rung: narrow from top to bottom but deep.
      return roughen(sweep(scaled(JUG, 0.55, 0.95), { ends: 3.2, flatten: 0.7, incut: true }), 0.015, seed)
    case 'thumbCatch':
      // A jug with a bump underneath one end for the thumb.
      return roughen(
        sweep(vary(JUG, seed, 0.04), {
          ends: 2.2, flatten: 0.5, incut: true,
          deform: (s, t, y, z) => (t < 0.35 ? [y - 0.16 * bump(s, t, -0.55, 0.12, 0.25), z + 0.12 * bump(s, t, -0.55, 0.12, 0.28)] : [y, z]),
        }),
        0.02, seed,
      )
    case 'deep':
      return roughen(sweep(vary(DEEP_JUG, seed, 0.04), { ends: 2.2, flatten: 0.5, incut: true }), 0.02, seed)

    // ---- crimps ----
    case 'crimpRail':
      return roughen(sweep(vary(CRIMP, seed, 0.05), { ends: 2.8 + random() * 1.5, flatten: 0.7, incut: true, bow: (random() - 0.5) * 0.16 }), 0.012, seed)
    case 'scallop':
      // Finger dimples pressed into the top of the crimp, one per finger.
      return roughen(
        sweep(CRIMP, {
          ends: 4, flatten: 0.75, incut: true,
          deform: (s, t, y, z) => (t > 0.25 && t < 0.75 ? [y - 0.045 * Math.max(0, Math.cos(s * Math.PI * 2)) * (1 - Math.abs(s)), z] : [y, z]),
        }),
        0.01, seed,
      )
    case 'halfMoon':
      return roughen(sweep(scaled(CRIMP, 1.1, 1.1), { ends: 1.8, flatten: 0.6, incut: true, bow: 0.34 }), 0.012, seed)
    case 'micro':
      return roughen(sweep(scaled(CRIMP, 0.85, 0.6), { ends: 6, flatten: 0.8, incut: true }), 0.008, seed)
    case 'ripple':
      // A crimp whose top undulates along its length.
      return roughen(sweep(CRIMP, { ends: 3.5, flatten: 0.75, incut: true, deform: (s, _t, y, z) => [y, z * (1 + 0.16 * Math.sin(s * Math.PI * 2.5))] }), 0.01, seed)

    // ---- edges ----
    case 'shelf':
      return roughen(sweep(vary(EDGE, seed, 0.05), { ends: 2.8 + random() * 1.5, flatten: 0.65, incut: true, bow: (random() - 0.5) * 0.12 }), 0.015, seed)
    case 'incutEdge':
      return roughen(sweep(INCUT_EDGE, { ends: 3.2, flatten: 0.7, incut: true }), 0.012, seed)
    case 'ramp':
      // Thick at one end, tapering to nothing at the other.
      return roughen(sweep(EDGE, { ends: 3, flatten: 0.6, incut: true, along: (s) => ({ scale: 0.35 + 0.65 * (s + 1) / 2 }) }), 0.012, seed)
    case 'ledge':
      return roughen(sweep(scaled(EDGE, 1.3, 0.75), { ends: 8, flatten: 0.9, incut: true }), 0.01, seed)
    case 'cutlass':
      // A curved, rounded edge: textured and positive on one end, smooth and slippery on the other.
      return roughen(sweep(ROUND_EDGE, { ends: 2.2, flatten: 0.6, bow: 0.26, smooth: (s) => smoothstep(-0.1, 0.25, -s) }), 0.01, seed)
    case 'wire':
      // A rounded edge with a smooth front face and a textured grip along the top.
      return roughen(sweep(ROUND_EDGE, { ends: 4, flatten: 0.75, smooth: (_s, t) => 1 - smoothstep(0.45, 0.6, t) }), 0.01, seed)

    // ---- slopers ----
    case 'dome': {
      // A full bulge at the bottom; the top half rolls away towards the wall, which is what you hold.
      const roll = 0.45 + random() * 0.15
      return roughen(
        dome((r, angle) => 0.58 * Math.pow(1 - r * r, 0.55) * (1 - roll * r * Math.max(0, Math.sin(angle))), {
          across: 1, up: 0.82, wobble: 0.1, seed,
          // The underside, tucked in towards the wall, gets less light.
          shade: (r, angle) => 1 - 0.25 * r * Math.max(0, -Math.sin(angle)),
        }),
        0.03, seed,
      )
    }
    case 'dish':
      // A sloper with a shallow dish on top for the palm.
      return roughen(
        dome((r, _angle, x, y) => 0.55 * Math.pow(1 - r * r, 0.5) - 0.13 * bump(x, y, 0, 0.18, 0.42) * (1 - r * r), {
          across: 1, up: 0.85, wobble: 0.08, seed,
          shade: (_r, _angle, x, y) => 1 - 0.18 * bump(x, y, 0, 0.18, 0.4),
        }),
        0.025, seed,
      )
    case 'roll':
      return roughen(sweep(ROUND, { ends: 2.2, flatten: 0.6 }), 0.02, seed)
    case 'lip':
      // A sloper with a slight ridge along its top: just enough to feel through the fingertips.
      return roughen(
        dome((r, _angle, x, y) => 0.5 * Math.pow(1 - r * r, 0.6) + 0.07 * Math.exp(-((y - 0.42) ** 2) / 0.012) * (1 - x * x), { across: 1, up: 0.8, wobble: 0.08, seed }),
        0.02, seed,
      )
    case 'vintage':
      // A trapezoid: a rounded grip zone along the top, and a smooth, slippery lower face.
      return roughen(
        dome((r, _angle, _x, y) => 0.52 * Math.pow(Math.max(0, 1 - Math.pow(r, 3)), 0.5) * (0.85 + 0.15 * y), {
          across: 1, up: 0.9, wobble: 0.02, seed, outline: trapezoid,
          smooth: (_r, _angle, _x, y) => 1 - smoothstep(-0.05, 0.15, y),
        }),
        0.012, seed,
      )
    case 'blob':
      // The lumps fade out towards the middle, so the top stays smooth.
      return roughen(dome((r, angle) => 0.55 * Math.pow(1 - r * r, 0.6) * (1 + 0.1 * r * Math.sin(angle * 3 + seed)), { across: 1, up: 0.85, wobble: 0.28, seed }), 0.05, seed)

    // ---- pinches (swept sideways, then stood upright) ----
    case 'fin':
    case 'block':
    case 'tufa':
    case 'ridge':
    case 'wedgePinch': {
      const section = { fin: FIN, block: BLOCK, tufa: ROUND, ridge: FIN, wedgePinch: WEDGE }[name]
      const options: SweepOptions =
        name === 'block' ? { ends: 5, flatten: 0.8 }
        : name === 'tufa' ? { ends: 1.4, flatten: 0.5, along: (s) => ({ scale: 0.85 + 0.15 * Math.cos(s * 3) }) }
        : name === 'ridge' ? { ends: 2, flatten: 0.4, bow: 0.28, smooth: (_s, t) => smoothstep(0.55, 0.7, t) }
        : { ends: 1.8 + random() * 0.6, flatten: 0.4 }
      const geometry = sweep(name === 'fin' ? vary(section, seed, 0.1) : section, options)
      geometry.rotateZ(Math.PI / 2)
      return roughen(geometry, name === 'tufa' ? 0.06 : 0.04, seed)
    }

    // ---- pockets ----
    case 'mono':
      return roughen(pocket([{ x: 0, y: 0.05, rx: 0.15, ry: 0.15, depth: 0.85, hook: 0.6 }], { height: 0.5, across: 0.8, up: 0.8, wobble: 0.1, seed }), 0.02, seed)
    case 'two':
      return roughen(pocket([{ x: 0, y: 0.05, rx: 0.32, ry: 0.16, depth: 0.85, hook: 0.6 }], { height: 0.52, across: 1, up: 0.82, wobble: 0.1, seed }), 0.02, seed)
    case 'three':
      return roughen(pocket([{ x: 0, y: 0.05, rx: 0.46, ry: 0.16, depth: 0.85, hook: 0.6 }], { height: 0.5, across: 1, up: 0.7, wobble: 0.08, seed }), 0.02, seed)
    case 'slot':
      return roughen(pocket([{ x: 0, y: 0.04, rx: 0.6, ry: 0.075, depth: 0.8, hook: 0.4 }], { height: 0.45, across: 1, up: 0.5, wobble: 0.05, seed }), 0.015, seed)
    case 'incutPocket':
      // A two-finger pocket near the top of a rounded hold, hooked deep inside.
      return roughen(pocket([{ x: 0, y: 0.32, rx: 0.3, ry: 0.15, depth: 0.9, hook: 1 }], { height: 0.55, across: 1, up: 0.9, wobble: 0.12, seed, slope: -0.35 }), 0.02, seed)
    case 'slopingPocket':
      // A wide, shallow dish rather than a hole: the fingers press into it.
      return roughen(pocket([{ x: 0, y: 0.08, rx: 0.48, ry: 0.32, depth: 0.45 }], { height: 0.5, across: 1, up: 0.85, wobble: 0.1, seed }), 0.02, seed)
    case 'eye':
      // An eye-shaped hold with an eye-shaped pocket: positive inside, smooth outside.
      return roughen(
        pocket([{ x: 0, y: 0.03, rx: 0.44, ry: 0.13, depth: 0.85, hook: 0.7 }], {
          height: 0.48, across: 1, up: 0.62, wobble: 0.03, seed, outline: almond,
          smooth: (r) => smoothstep(0.62, 0.78, r),
        }),
        0.01, seed,
      )
    case 'twin':
      // Two separate mono pockets side by side.
      return roughen(
        pocket(
          [
            { x: -0.3, y: 0.04, rx: 0.14, ry: 0.14, depth: 0.85, hook: 0.6 },
            { x: 0.3, y: 0.06, rx: 0.14, ry: 0.14, depth: 0.85, hook: 0.6 },
          ],
          { height: 0.5, across: 1, up: 0.7, wobble: 0.08, seed },
        ),
        0.02, seed,
      )

    // ---- sidepulls (the grip faces up here; they're turned on the wall) ----
    case 'flake':
      return roughen(sweep(scaled(JUG, 0.75, 0.75), { ends: 1.8, flatten: 0.35, incut: true, bow: 0.3 }), 0.02, seed)
    case 'blade':
      return roughen(sweep(scaled(INCUT_EDGE, 0.8, 1.25), { ends: 3, flatten: 0.6, incut: true }), 0.012, seed)
    case 'sideJug':
      return roughen(sweep(vary(scaled(JUG, 0.75, 0.75), seed, 0.06), { ends: 1.8 + random() * 0.6, flatten: 0.35, incut: true }), 0.02, seed)
    case 'sideHorn':
      return roughen(sweep(scaled(JUG, 0.75, 0.75), { ends: 1.5, flatten: 0.4, incut: true, along: (s) => ({ scale: 0.75 + 0.3 * Math.max(0, s), lift: 0.35 * Math.max(0, s) ** 2 }) }), 0.02, seed)

    // ---- foot chips ----
    case 'nub':
      return roughen(dome((r) => 0.38 * Math.pow(1 - r * r, 0.55), { across: 1, up: 0.65, wobble: 0.15, seed }), 0.04, seed)
    case 'miniLedge':
      return roughen(sweep(scaled(EDGE, 1.2, 0.9), { ends: 2.5, flatten: 0.6, incut: true }), 0.02, seed)
    case 'disc':
      return roughen(dome((r) => 0.22 * Math.pow(Math.max(0, 1 - Math.pow(r, 4)), 0.5), { across: 1, up: 0.85, wobble: 0.05, seed }), 0.015, seed)
    case 'dimple':
      return roughen(pocket([{ x: 0, y: 0.1, rx: 0.3, ry: 0.22, depth: 0.35 }], { height: 0.4, across: 1, up: 0.7, wobble: 0.12, seed }), 0.02, seed)

    // ---- macros ----
    case 'scooped': {
      // Two or three shallow scoops on the surface, each darker inside.
      const dips = Array.from({ length: 2 + (variant % 2) }, () => ({ r: 0.25 + random() * 0.4, angle: random() * Math.PI * 2, size: 0.12 + random() * 0.08 }))
      const dip = (r: number, angle: number) =>
        dips.reduce((sum, d) => {
          const [dx, dy] = [r * Math.cos(angle) - d.r * Math.cos(d.angle), r * Math.sin(angle) - d.r * Math.sin(d.angle)]
          return sum + Math.exp(-(dx * dx + dy * dy) / (d.size * d.size))
        }, 0)
      return roughen(
        dome((r, angle) => 0.55 * Math.pow(1 - Math.pow(r, 2.4), 0.65) * (1 + 0.12 * r * Math.sin(angle * 2 + seed)) - 0.14 * dip(r, angle) * (1 - r * r), {
          across: 1, up: 0.85, wobble: 0.22, seed,
          shade: (r, angle) => 1 - 0.35 * Math.min(dip(r, angle), 1),
        }),
        0.06, seed,
      )
    }
    case 'wave':
      // A long rolling wave: a rounded crest you can slap or pinch.
      return roughen(sweep(scaled(ROUND, 1.2, 1.1), { ends: 1.6, flatten: 0.5, bow: 0.3, along: (s) => ({ scale: 0.85 + 0.15 * Math.sin(s * 2.4) }) }), 0.04, seed)
    case 'bowl':
      // A big dish: grip it on its rim or palm the inside.
      return roughen(
        dome((r, _angle, x, y) => 0.42 * Math.pow(Math.max(0, 1 - Math.pow(r, 3)), 0.5) - 0.24 * bump(x, y, 0, 0.05, 0.5), {
          across: 1, up: 0.9, wobble: 0.08, seed,
          shade: (_r, _angle, x, y) => 1 - 0.25 * bump(x, y, 0, 0.05, 0.45),
        }),
        0.03, seed,
      )
    case 'jugMacro':
      return roughen(sweep(scaled(DEEP_JUG, 1.15, 0.85), { ends: 1.7, flatten: 0.55, incut: true }), 0.035, seed)
    case 'dualtex':
      // A big rounded macro: textured where it's held, smooth everywhere else.
      return roughen(
        dome((r, angle) => 0.55 * Math.pow(1 - Math.pow(r, 2.2), 0.6) * (1 + 0.1 * r * Math.sin(angle * 2)), {
          across: 1, up: 0.85, wobble: 0.15, seed,
          smooth: (_r, _angle, _x, y) => 1 - smoothstep(0.05, 0.25, y),
        }),
        0.03, seed,
      )
  }
  throw new Error(`no shape ${name}`)
}

function buildVolume(variant: number): THREE.BufferGeometry {
  const solid = VOLUME_SOLIDS[variant % VOLUME_SOLIDS.length]
  // The solids are written with y down the wall; here y goes up.
  const points = solid.points.map(([x, y, h]) => new THREE.Vector3(x, -y, h))
  const positions: number[] = []
  for (const face of solid.faces) {
    for (let i = 1; i < face.length - 1; i++) {
      for (const index of [face[0], face[i], face[i + 1]]) positions.push(points[index].x, points[index].y, points[index].z)
    }
  }
  const shades = positions.filter((_, i) => i % 3 === 0).map(() => 1)
  // T-nut holes: small dark discs just above each face, at its middle and towards one corner.
  for (const face of solid.faces) {
    const corners = face.map((index) => points[index])
    const middle = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(corners.length)
    const normal = new THREE.Vector3().subVectors(corners[1], corners[0]).cross(new THREE.Vector3().subVectors(corners[2], corners[0])).normalize()
    if (normal.dot(new THREE.Vector3().subVectors(middle, new THREE.Vector3(0, 0, 0.3))) < 0) normal.negate()
    const across = new THREE.Vector3().subVectors(corners[0], middle).normalize()
    const side = new THREE.Vector3().crossVectors(normal, across)
    // Only faces big enough to bolt a hold to get holes: two on the biggest, none on small facets.
    let area = 0
    for (let i = 1; i < corners.length - 1; i++) {
      area += new THREE.Vector3().subVectors(corners[i], corners[0]).cross(new THREE.Vector3().subVectors(corners[i + 1], corners[0])).length() / 2
    }
    const spots = area < 0.3 ? [] : area < 0.6 ? [middle] : [middle, middle.clone().lerp(corners[0], 0.45)]
    for (const spot of spots) {
      const centre = spot.clone().addScaledVector(normal, 0.004)
      const ring = Array.from({ length: 10 }, (_, k) => {
        const angle = (k / 10) * Math.PI * 2
        return centre.clone().addScaledVector(across, Math.cos(angle) * 0.045).addScaledVector(side, Math.sin(angle) * 0.045)
      })
      for (let k = 0; k < ring.length; k++) {
        for (const point of [centre, ring[k], ring[(k + 1) % ring.length]]) positions.push(point.x, point.y, point.z)
        shades.push(0.12, 0.12, 0.12)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('shade', new THREE.Float32BufferAttribute(shades, 1))
  // Flat faces: each triangle keeps its own normal.
  geometry.computeVertexNormals()
  const uvs = positions.filter((_, i) => i % 3 !== 2).map((value) => value / 2 + 0.5)
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}

/**
 * Bakes shading into a hold's mesh as a vertex `color`: crevices (a jug's bucket, an incut, a pocket's
 * hole) are dark, and every hold darkens a little where it meets the wall, so it looks seated on it.
 */
export function finishHold(geometry: THREE.BufferGeometry, options: { normals?: boolean } = {}) {
  if (options.normals !== false) geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const shade = geometry.getAttribute('shade')
  const colours: number[] = []
  for (let i = 0; i < position.count; i++) {
    const value = (shade ? shade.getX(i) : 1) * (0.7 + 0.3 * smoothstep(0, 0.12, position.getZ(i)))
    colours.push(value, value, value)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
  splitSmooth(geometry)
  return geometry
}

/**
 * Dual-texture holds: the triangles in their smooth zone go in a second group, so they can be
 * drawn with a glossier material (group 0 is textured, group 1 smooth).
 */
function splitSmooth(geometry: THREE.BufferGeometry) {
  const smooth = geometry.getAttribute('smooth')
  const index = geometry.getIndex()
  if (!smooth || !index) return
  const textured: number[] = []
  const glossy: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const [a, b, c] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    ;(smooth.getX(a) + smooth.getX(b) + smooth.getX(c) > 1.5 ? glossy : textured).push(a, b, c)
  }
  geometry.setIndex([...textured, ...glossy])
  geometry.clearGroups()
  geometry.addGroup(0, textured.length, 0)
  geometry.addGroup(textured.length, glossy.length, 1)
}

/** Where the bolt is on a hold's face, found by looking straight down onto it. */
function boltOn(geometry: THREE.BufferGeometry, y: number): THREE.Vector3 | null {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  const hits = new THREE.Raycaster(new THREE.Vector3(0, y, 5), new THREE.Vector3(0, 0, -1)).intersectObject(mesh)
  return hits.length ? hits[0].point : null
}

const BOLT_HEIGHT: Partial<Record<HoldType, number>> = {
  jug: -0.2, undercling: -0.2, sidepull: -0.15, crimp: -0.05, edge: -0.05, sloper: -0.1, foot_chip: 0, macro: 0, pinch: 0,
}
// Shapes where the bolt hides in a hole or under a lip, so no dot is drawn.
const NO_BOLT = new Set(['dimple', 'bowl', 'scooped'])

const cache = new Map<string, HoldModel>()
// Models added by hand (public/holds) replace the built-in shapes for their type.
let custom = new Map<HoldType, THREE.BufferGeometry[]>()

export function setCustomHolds(models: Map<HoldType, THREE.BufferGeometry[]>) {
  custom = models
}

/** The mesh for a hold type and variant (built once, then shared). */
export function holdModel(type: HoldType, variant: number): HoldModel {
  const own = custom.get(type)
  if (own?.length) return { geometry: own[variant % own.length], bolt: null }
  const shape = variant % shapeCount(type)
  const key = `${type}:${shape}`
  let model = cache.get(key)
  if (!model) {
    // Volumes keep their flat faces' normals.
    const geometry = finishHold(type === 'volume' ? buildVolume(shape) : build(type, shape), { normals: type !== 'volume' })
    const boltHeight = NO_BOLT.has(shapeName(type, shape)) ? undefined : BOLT_HEIGHT[type]
    model = { geometry, bolt: boltHeight === undefined ? null : boltOn(geometry, boltHeight) }
    cache.set(key, model)
  }
  return model
}
