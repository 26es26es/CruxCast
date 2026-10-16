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
function sweep(section: Section, options: { ends: number; flatten: number; slices?: number }): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(section.map(([y, z]) => new THREE.Vector2(y, z)))
  // The front is smooth; the back lies flat on the wall.
  const outline = curve.getPoints(56).map((p) => new THREE.Vector2(p.x, Math.max(p.y, 0)))
  outline.push(outline[0].clone())
  const slices = options.slices ?? 28
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i <= slices; i++) {
    const s = -1 + (2 * i) / slices
    // A superellipse: blunt ends for high `ends`, rounded for low.
    const width = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), options.ends)), 1 / options.ends)
    for (const [j, point] of outline.entries()) {
      positions.push(s, point.x * (options.flatten + (1 - options.flatten) * width), point.y * width)
      uvs.push(i / slices, j / (outline.length - 1))
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
  geometry.setIndex(indices)
  return geometry
}

/** A dome over a wobbly outline: `height(r, angle)` gives its height at a fraction r of the way out. */
function dome(
  height: (r: number, angle: number) => number,
  options: { across: number; up: number; wobble: number; seed: number },
): THREE.BufferGeometry {
  const rings = 26
  const segments = 72
  const random = seeded(options.seed)
  const waves = [2, 3, 5].map((k) => ({ k, phase: random() * Math.PI * 2, size: options.wobble / k }))
  const edge = (angle: number) => 1 + waves.reduce((sum, wave) => sum + wave.size * Math.sin(wave.k * angle + wave.phase), 0)
  const positions: number[] = [0, 0, height(0, 0)]
  const uvs: number[] = [0.5, 0.5]
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings
    for (let segment = 0; segment < segments; segment++) {
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

const smoothstep = (low: number, high: number, value: number) => fade(Math.min(Math.max((value - low) / (high - low), 0), 1))

/** Nudges a cross-section's points a little, the same way for the same seed. */
function vary(section: Section, seed: number, amount: number): Section {
  const random = seeded(seed)
  return section.map(([y, z], index) => (index === 0 || index === section.length - 1 ? [y, z] : [y + (random() - 0.5) * amount, z * (1 + (random() - 0.5) * amount)]))
}

// A jug: up off the wall, round the front, over a lip and down into a scoop, then back to the wall above it.
const JUG: Section = [
  [-0.75, 0], [-0.62, 0.22], [-0.35, 0.46], [0, 0.57], [0.3, 0.56], [0.47, 0.47], [0.5, 0.37],
  [0.42, 0.29], [0.26, 0.23], [0.15, 0.15], [0.22, 0.06], [0.4, 0.015], [0.56, 0],
]
// A crimp: a low rail with a small incut lip on top.
const CRIMP: Section = [[-0.3, 0], [-0.25, 0.13], [-0.12, 0.21], [0.08, 0.24], [0.19, 0.21], [0.21, 0.14], [0.16, 0.1], [0.21, 0.035], [0.3, 0]]
// An edge: deeper and squarer than a crimp, with a flat top.
const EDGE: Section = [[-0.42, 0], [-0.36, 0.2], [-0.2, 0.32], [0.12, 0.35], [0.3, 0.33], [0.33, 0.22], [0.3, 0.14], [0.34, 0.05], [0.42, 0]]
// A pinch: a symmetric fin, swept sideways and then stood upright.
const FIN: Section = [[-0.36, 0], [-0.3, 0.3], [-0.14, 0.62], [0, 0.7], [0.14, 0.62], [0.3, 0.3], [0.36, 0]]

function build(type: Exclude<HoldType, 'volume'>, variant: number): THREE.BufferGeometry {
  const seed = (type.length * 31 + variant * 101) | 0
  const random = seeded(seed)
  switch (type) {
    case 'jug':
    case 'undercling':
      return roughen(sweep(vary(JUG, seed, 0.12), { ends: 1.7 + random() * 0.5, flatten: 0.3 }), 0.08, seed)
    case 'sidepull':
      return roughen(sweep(vary(JUG, seed, 0.1).map(([y, z]) => [y * 0.8, z * 0.8]), { ends: 1.7 + random() * 0.6, flatten: 0.3 }), 0.07, seed)
    case 'crimp':
      return roughen(sweep(vary(CRIMP, seed, 0.08), { ends: 4 + random() * 3, flatten: 0.75 }), 0.025, seed)
    case 'edge':
      return roughen(sweep(vary(EDGE, seed, 0.08), { ends: 3.5 + random() * 3, flatten: 0.7 }), 0.03, seed)
    case 'pinch': {
      const fin = sweep(vary(FIN, seed, 0.1), { ends: 1.8 + random() * 0.6, flatten: 0.4 })
      fin.rotateZ(Math.PI / 2)
      return roughen(fin, 0.05, seed)
    }
    case 'sloper': {
      // A broad hump, a little higher towards its top edge so the grip rolls away from you.
      const lean = 0.1 + random() * 0.1
      return roughen(dome((r, angle) => 0.5 * Math.pow(1 - r * r, 0.7) * (1 + lean * r * Math.sin(angle)), { across: 1, up: 0.8, wobble: 0.12, seed }), 0.05, seed)
    }
    case 'foot_chip':
      return roughen(dome((r) => 0.38 * Math.pow(1 - r * r, 0.55), { across: 1, up: 0.65, wobble: 0.15, seed }), 0.04, seed)
    case 'macro':
      return roughen(dome((r, angle) => 0.5 * Math.pow(1 - Math.pow(r, 2.4), 0.65) * (1 + 0.12 * r * Math.sin(angle * 2 + seed)), { across: 1, up: 0.85, wobble: 0.22, seed }), 0.09, seed)
    case 'pocket':
      // A flat-topped block with a deep finger hole in the middle.
      return roughen(
        dome((r) => {
          const block = 0.55 * Math.pow(1 - Math.pow(r, 4), 0.5)
          return 0.08 + (block - 0.08) * smoothstep(0.3, 0.42, r)
        }, { across: 1, up: 0.85, wobble: 0.1, seed }),
        0.03,
        seed,
      )
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
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  // Flat faces: each triangle keeps its own normal.
  geometry.computeVertexNormals()
  const uvs = positions.filter((_, i) => i % 3 !== 2).map((value) => value / 2 + 0.5)
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
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
    const geometry = type === 'volume' ? buildVolume(variant) : build(type, variant % VARIANTS)
    const boltHeight = BOLT_HEIGHT[type]
    model = { geometry, bolt: boltHeight === undefined ? null : boltOn(geometry, boltHeight) }
    cache.set(key, model)
  }
  return model
}
