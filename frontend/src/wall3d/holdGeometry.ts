import * as THREE from 'three'
import { VOLUME_SOLIDS } from '../holdShapes'
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
// Each type has a few variants, nudged by a seed, with a little surface noise so no two
// look machine-made.

export const VARIANTS = 3

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

/** Sweeps a cross-section sideways from x = -1 to 1, shrinking it towards both ends. */
function sweep(section: Section, options: { ends: number; flatten: number; slices?: number; incut?: boolean; bow?: number }): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(section.map(([y, z]) => new THREE.Vector2(y, z)))
  // The front is smooth; the back lies flat on the wall.
  const outline = curve.getPoints(56).map((p) => new THREE.Vector2(p.x, Math.max(p.y, 0)))
  outline.push(outline[0].clone())
  // Behind the lip (an incut, a jug's bucket) little light gets in: from the lip's crest (its
  // highest point clear of the wall) back round to the wall is shaded dark.
  const deepest = Math.max(...outline.map((point) => point.y))
  let crest = -1
  if (options.incut) {
    for (const [j, point] of outline.entries()) if (point.y > 0.3 * deepest && (crest < 0 || point.x > outline[crest].x)) crest = j
  }
  const shadeAt = (j: number) => (crest < 0 || j <= crest ? 1 : 1 - 0.7 * smoothstep(crest + 1, crest + 8, j))
  const slices = options.slices ?? 28
  const positions: number[] = []
  const uvs: number[] = []
  const shades: number[] = []
  for (let i = 0; i <= slices; i++) {
    const s = -1 + (2 * i) / slices
    // A superellipse: blunt ends for high `ends`, rounded for low.
    const width = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), options.ends)), 1 / options.ends)
    // A rail can curve gently along its length.
    const bend = (options.bow ?? 0) * (1 - s * s)
    for (const [j, point] of outline.entries()) {
      positions.push(s, point.x * (options.flatten + (1 - options.flatten) * width) + bend, point.y * width)
      uvs.push(i / slices, j / (outline.length - 1))
      // Where the ends close up there is no hollow left, so the shading fades out there.
      shades.push(1 - (1 - shadeAt(j)) * Math.sqrt(width))
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
  geometry.setIndex(indices)
  return geometry
}

/** A dome over a wobbly outline: `height(r, angle)` gives its height at a fraction r of the way out. */
function dome(
  height: (r: number, angle: number) => number,
  options: { across: number; up: number; wobble: number; seed: number; shade?: (r: number, angle: number) => number },
): THREE.BufferGeometry {
  const rings = 26
  const segments = 72
  const random = seeded(options.seed)
  const waves = [2, 3, 5].map((k) => ({ k, phase: random() * Math.PI * 2, size: options.wobble / k }))
  const edge = (angle: number) => 1 + waves.reduce((sum, wave) => sum + wave.size * Math.sin(wave.k * angle + wave.phase), 0)
  const positions: number[] = [0, 0, height(0, 0)]
  const uvs: number[] = [0.5, 0.5]
  const shades: number[] = [options.shade?.(0, 0) ?? 1]
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings
    for (let segment = 0; segment < segments; segment++) {
      shades.push(options.shade?.(r, (segment / segments) * Math.PI * 2) ?? 1)
      const angle = (segment / segments) * Math.PI * 2
      const x = Math.cos(angle) * r * edge(angle) * options.across
      const y = Math.sin(angle) * r * edge(angle) * options.up
      positions.push(x, y, Math.max(height(r, angle), 0))
      uvs.push(0.5 + x / 2, 0.5 + y / 2)
    }
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

// A jug: up off the wall, round a fat front, over a thick lip and down into a deep bucket for the
// fingers, then back up the wall behind it. The lip sits lower than the back of the bucket, so the
// opening faces up and out, as on real jugs, and you can see into it from in front.
const JUG: Section = [
  [-0.7, 0], [-0.6, 0.24], [-0.4, 0.48], [-0.12, 0.62], [0.15, 0.66], [0.35, 0.63], [0.45, 0.56], [0.47, 0.47],
  [0.42, 0.4], [0.3, 0.35], [0.12, 0.3], [-0.02, 0.22], [-0.05, 0.12], [0.05, 0.05], [0.28, 0.02], [0.5, 0.01], [0.66, 0],
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
// A pinch: a symmetric fin, swept sideways and then stood upright.
const FIN: Section = [[-0.36, 0], [-0.3, 0.3], [-0.14, 0.62], [0, 0.7], [0.14, 0.62], [0.3, 0.3], [0.36, 0]]

function build(type: Exclude<HoldType, 'volume'>, variant: number): THREE.BufferGeometry {
  const seed = (type.length * 31 + variant * 101) | 0
  const random = seeded(seed)
  switch (type) {
    case 'jug':
    case 'undercling':
      return roughen(sweep(vary(JUG, seed, 0.05), { ends: 2.4 + random() * 0.8, flatten: 0.5, incut: true }), 0.02, seed)
    case 'sidepull':
      return roughen(sweep(vary(JUG, seed, 0.06).map(([y, z]) => [y * 0.75, z * 0.75]), { ends: 1.8 + random() * 0.6, flatten: 0.35, incut: true }), 0.02, seed)
    case 'crimp':
      return roughen(sweep(vary(CRIMP, seed, 0.05), { ends: 2.8 + random() * 1.5, flatten: 0.7, incut: true, bow: (random() - 0.5) * 0.16 }), 0.012, seed)
    case 'edge':
      return roughen(sweep(vary(EDGE, seed, 0.05), { ends: 2.8 + random() * 1.5, flatten: 0.65, incut: true, bow: (random() - 0.5) * 0.12 }), 0.015, seed)
    case 'pinch': {
      const fin = sweep(vary(FIN, seed, 0.1), { ends: 1.8 + random() * 0.6, flatten: 0.4 })
      fin.rotateZ(Math.PI / 2)
      return roughen(fin, 0.05, seed)
    }
    case 'sloper': {
      // A full bulge at the bottom; the top half rolls away towards the wall, which is what you hold.
      const roll = 0.45 + random() * 0.15
      return roughen(
        dome((r, angle) => 0.58 * Math.pow(1 - r * r, 0.55) * (1 - roll * r * Math.max(0, Math.sin(angle))), {
          across: 1, up: 0.82, wobble: 0.1, seed,
          // The underside, tucked in towards the wall, gets less light.
          shade: (r, angle) => 1 - 0.25 * r * Math.max(0, -Math.sin(angle)),
        }),
        0.03,
        seed,
      )
    }
    case 'foot_chip':
      if (variant === 2) return roughen(sweep(EDGE.map(([y, z]) => [y * 1.2, z * 0.9]), { ends: 2.5, flatten: 0.6, incut: true }), 0.02, seed)
      return roughen(dome((r) => 0.38 * Math.pow(1 - r * r, 0.55), { across: 1, up: 0.65, wobble: 0.15, seed }), 0.04, seed)
    case 'macro': {
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
        0.06,
        seed,
      )
    }
    case 'pocket': {
      // A flat-topped block with a deep finger hole in the middle, wider across than up and down:
      // two fingers side by side.
      const hole = (angle: number) => 0.34 * (1 + 0.28 * Math.cos(2 * angle))
      return roughen(
        dome((r, angle) => {
          const block = 0.55 * Math.pow(1 - Math.pow(r, 4), 0.5)
          return 0.06 + (block - 0.06) * smoothstep(hole(angle) - 0.06, hole(angle) + 0.07, r)
        }, { across: 1, up: 0.85, wobble: 0.1, seed, shade: (r, angle) => 0.25 + 0.75 * smoothstep(hole(angle) - 0.08, hole(angle) + 0.06, r) }),
        0.025,
        seed,
      )
    }
  }
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
    for (const spot of [middle, middle.clone().lerp(corners[0], 0.45)]) {
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
  return geometry
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
  const key = `${type}:${variant % VARIANTS}`
  let model = cache.get(key)
  if (!model) {
    // Volumes keep their flat faces' normals.
    const geometry = finishHold(type === 'volume' ? buildVolume(variant) : build(type, variant % VARIANTS), { normals: type !== 'volume' })
    const boltHeight = BOLT_HEIGHT[type]
    model = { geometry, bolt: boltHeight === undefined ? null : boltOn(geometry, boltHeight) }
    cache.set(key, model)
  }
  return model
}
