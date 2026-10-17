import type { HoldType } from './setting'

// Hold outlines on a unit scale (about -1..1). Several variants per type, so a wall
// full of jugs doesn't look stamped out; which one a hold gets depends on its position.

export const HOLD_SHAPES: Record<Exclude<HoldType, 'volume'>, string[]> = {
  jug: [
    'M-1 0.2C-1.05-0.5-0.55-0.95 0-0.95S1.05-0.5 1 0.2C0.95 0.75 0.45 0.8 0.3 0.45C0.15 0.15-0.15 0.15-0.3 0.45C-0.45 0.8-0.95 0.75-1 0.2Z',
    'M-0.95 0.1C-0.9-0.7-0.3-1 0.15-0.95C0.75-0.9 1.05-0.4 0.95 0.25C0.85 0.8 0.35 0.7 0.2 0.35C0.05 0.1-0.35 0.2-0.45 0.5C-0.6 0.85-1 0.6-0.95 0.1Z',
    'M-1 0C-0.95-0.6-0.4-0.9 0.1-0.85S1-0.45 0.95 0.15S0.4 0.85 0 0.6S-1.05 0.55-1 0Z',
  ],
  undercling: [
    'M-1 0.2C-1.05-0.5-0.55-0.95 0-0.95S1.05-0.5 1 0.2C0.95 0.75 0.45 0.8 0.3 0.45C0.15 0.15-0.15 0.15-0.3 0.45C-0.45 0.8-0.95 0.75-1 0.2Z',
    'M-0.95 0.1C-0.9-0.7-0.3-1 0.15-0.95C0.75-0.9 1.05-0.4 0.95 0.25C0.85 0.8 0.35 0.7 0.2 0.35C0.05 0.1-0.35 0.2-0.45 0.5C-0.6 0.85-1 0.6-0.95 0.1Z',
  ],
  crimp: [
    'M-1-0.15C-0.6-0.32 0.6-0.32 1-0.15C1.08 0.05 0.95 0.25 0.7 0.25H-0.7C-0.95 0.25-1.08 0.05-1-0.15Z',
    'M-0.95-0.2L0.9-0.28C1.05-0.2 1.05 0.15 0.9 0.22L-0.9 0.25C-1.05 0.15-1.05-0.12-0.95-0.2Z',
  ],
  edge: [
    'M-1-0.3C-0.6-0.5 0.6-0.5 1-0.3C1.1 0.05 0.95 0.4 0.65 0.4H-0.65C-0.95 0.4-1.1 0.05-1-0.3Z',
    'M-0.95-0.35L0.85-0.42C1.05-0.3 1.08 0.25 0.85 0.38L-0.85 0.42C-1.08 0.25-1.08-0.25-0.95-0.35Z',
  ],
  sloper: [
    'M-1 0.45C-1-0.35-0.5-0.8 0.05-0.8S1-0.3 1 0.45C0.6 0.65-0.6 0.65-1 0.45Z',
    'M-0.95 0.5C-1.05-0.1-0.6-0.75 0-0.78C0.65-0.8 1.05-0.2 0.95 0.5C0.5 0.7-0.5 0.7-0.95 0.5Z',
  ],
  pinch: [
    'M0.05-1C0.6-0.95 0.55 0.95 0 1C-0.55 0.95-0.55-0.95 0.05-1Z',
    'M-0.1-1C0.45-1 0.7-0.2 0.5 0.6C0.4 0.95-0.1 1.05-0.35 0.8C-0.65 0.4-0.6-0.95-0.1-1Z',
  ],
  pocket: [
    'M-1 0C-1-0.65-0.55-1 0-1S1-0.6 1 0S0.55 1 0 1S-1 0.6-1 0ZM-0.42-0.05C-0.42-0.32 0.42-0.32 0.42-0.05S-0.42 0.25-0.42-0.05Z',
    'M-0.9-0.2C-0.7-0.9 0.6-1 0.95-0.3C1.1 0.4 0.4 0.95-0.2 0.9S-1.05 0.4-0.9-0.2ZM-0.3 0C-0.3-0.28 0.35-0.3 0.38 0S-0.3 0.25-0.3 0Z',
  ],
  sidepull: [
    'M-0.35-1C0.75-0.8 0.75 0.8-0.35 1C0.05 0.5 0.05-0.5-0.35-1Z',
    'M-0.3-1C0.6-0.9 0.85 0.3 0.1 0.95C-0.15 1.05-0.35 0.95-0.2 0.7C0.2 0.2 0.15-0.5-0.3-1Z',
  ],
  foot_chip: [
    'M-1 0.1C-1-0.55 1-0.6 1 0.05S-1 0.7-1 0.1Z',
    'M-0.9-0.25C-0.3-0.6 0.6-0.6 0.95-0.2C1.05 0.3 0.4 0.6-0.2 0.55S-1.05 0.2-0.9-0.25Z',
  ],
  macro: [
    'M-1 0.1C-1-0.7-0.2-1 0.3-0.9S1-0.2 0.9 0.3C0.8 0.9 0.1 1-0.4 0.85S-1 0.45-1 0.1Z',
    'M-0.9-0.3C-0.6-0.95 0.5-1 0.9-0.5C1.1-0.1 0.8 0.75 0.2 0.9C-0.5 1.05-1.05 0.4-0.9-0.3Z',
  ],
}

/**
 * How each hold stands off the wall, in units of its radius: how deep it is, how big its top
 * is compared to its base, and whether its sides round over like a dome or rise straight.
 */
export const HOLD_RELIEF: Record<Exclude<HoldType, 'volume'>, { depth: number; top: number; dome: boolean }> = {
  jug: { depth: 0.75, top: 0.82, dome: false },
  undercling: { depth: 0.75, top: 0.82, dome: false },
  crimp: { depth: 0.4, top: 0.95, dome: false },
  edge: { depth: 0.5, top: 0.92, dome: false },
  sloper: { depth: 0.55, top: 0.4, dome: true },
  pinch: { depth: 0.85, top: 0.78, dome: false },
  pocket: { depth: 0.6, top: 0.86, dome: false },
  sidepull: { depth: 0.65, top: 0.8, dome: false },
  foot_chip: { depth: 0.45, top: 0.7, dome: true },
  macro: { depth: 0.5, top: 0.5, dome: true },
}

/** How much of a hold's base is left at height t (0 at the wall, 1 at the top). */
export function reliefScale(relief: { top: number; dome: boolean }, t: number): number {
  return relief.dome ? relief.top + (1 - relief.top) * Math.sqrt(1 - t * t) : 1 - (1 - relief.top) * t
}

/** The incut on a jug's top, where the fingers go: a dark groove along its upper edge. */
export const JUG_INCUT = 'M-0.7-0.3C-0.35-0.62 0.35-0.62 0.7-0.3C0.3-0.42-0.3-0.42-0.7-0.3Z'

/** A shape's outline without any holes, and the holes on their own (a pocket's opening). */
export function outerPath(d: string): string {
  return d.slice(0, d.indexOf('Z') + 1)
}
export function holesPath(d: string): string {
  return d.slice(d.indexOf('Z') + 1)
}

/**
 * Volumes as solids: points (x, y across and down the wall, h out of it, in units of the
 * radius) and the faces between them. The face against the wall is left out.
 */
export type Solid = { points: [number, number, number][]; faces: number[][] }

type Flat = [number, number]

/**
 * A flat-topped volume: a footprint on the wall and the same shape, smaller and `height` out,
 * as its top, joined by sloping sides. The top can be shifted to make one side steeper.
 */
function slab(footprint: Flat[], options: { top: number; height: number; shift?: Flat }): Solid {
  const n = footprint.length
  const [cx, cy] = footprint.reduce(([x, y], [px, py]) => [x + px / n, y + py / n], [0, 0])
  const [sx, sy] = options.shift ?? [0, 0]
  const top = footprint.map(([x, y]): [number, number, number] => [cx + (x - cx) * options.top + sx, cy + (y - cy) * options.top + sy, options.height])
  return {
    points: [...footprint.map(([x, y]): [number, number, number] => [x, y, 0]), ...top],
    faces: [Array.from({ length: n }, (_, i) => n + i), ...footprint.map((_, i) => [i, (i + 1) % n, n + ((i + 1) % n), n + i])],
  }
}

/** A faceted dome, like a quarter of a football: rings of flat panels up to a point. */
function facetedDome(segments: number, rings: [number, number][], apex: number): Solid {
  const points: [number, number, number][] = []
  for (const [ring, [radius, height]] of rings.entries()) {
    for (let k = 0; k < segments; k++) {
      // Each ring is turned half a panel, so the panels interlock like a ball's.
      const angle = ((k + (ring % 2) / 2) / segments) * Math.PI * 2
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius * 0.9, height])
    }
  }
  points.push([0, 0, apex])
  const faces: number[][] = []
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let k = 0; k < segments; k++) {
      const [a, b] = [ring * segments + k, ring * segments + ((k + 1) % segments)]
      const [c, d] = [(ring + 1) * segments + k, (ring + 1) * segments + ((k + 1) % segments)]
      faces.push([a, b, c], [b, d, c])
    }
  }
  const last = (rings.length - 1) * segments
  for (let k = 0; k < segments; k++) faces.push([last + k, last + ((k + 1) % segments), points.length - 1])
  return { points, faces }
}

const regular = (corners: number, turn = 0): Flat[] =>
  Array.from({ length: corners }, (_, k) => [Math.cos((k / corners) * Math.PI * 2 + turn), Math.sin((k / corners) * Math.PI * 2 + turn)])

/** The volume shapes, in the order of VOLUME_NAMES. */
export const VOLUME_SOLIDS: Solid[] = [
  // A pyramid on a triangular base.
  {
    points: [[-1, 0.8, 0], [1, 0.8, 0], [0.05, -1, 0], [0.1, 0.25, 0.9]],
    faces: [[0, 1, 3], [1, 2, 3], [2, 0, 3]],
  },
  // A wedge with a ridge along the top.
  {
    points: [[-1, 0.6, 0], [1, 0.6, 0], [0.8, -0.8, 0], [-0.6, -0.8, 0], [-0.5, -0.15, 0.75], [0.7, -0.15, 0.75]],
    faces: [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]],
  },
  // A flat triangle with a steep bottom edge.
  slab([[-1, 0.75], [1, 0.75], [0, -1]], { top: 0.55, height: 0.32, shift: [0, 0.12] }),
  // A low rectangular box.
  slab([[-1, -0.6], [1, -0.6], [1, 0.6], [-1, 0.6]], { top: 0.72, height: 0.34, shift: [0, 0.08] }),
  // A hexagon.
  slab(regular(6), { top: 0.6, height: 0.4 }),
  // A diamond, standing on a point.
  slab([[0, -1], [0.72, 0], [0, 1], [-0.72, 0]], { top: 0.38, height: 0.42 }),
  // A chevron (boomerang): two arms meeting at the top.
  {
    points: [
      [-1, 0.25, 0], [0, -0.8, 0], [1, 0.25, 0], [0.72, 0.6, 0], [0, -0.22, 0], [-0.72, 0.6, 0],
      [-0.82, 0.3, 0.3], [0, -0.58, 0.3], [0.82, 0.3, 0.3], [0.66, 0.46, 0.3], [0, -0.3, 0.3], [-0.66, 0.46, 0.3],
    ],
    // The top is concave, so it is two flat quads, one per arm.
    faces: [[6, 7, 10, 11], [7, 8, 9, 10], [0, 1, 7, 6], [1, 2, 8, 7], [2, 3, 9, 8], [3, 4, 10, 9], [4, 5, 11, 10], [5, 0, 6, 11]],
  },
  // A quarter-ball made of flat panels.
  facetedDome(8, [[1, 0], [0.82, 0.42], [0.46, 0.72]], 0.82),
  // A flake: a lopsided wedge, steep on one side.
  {
    points: [[-1, 0.7, 0], [0.9, 0.5, 0], [0.6, -0.9, 0], [-0.8, -0.6, 0], [-0.65, -0.35, 0.72], [0.45, -0.62, 0.66]],
    faces: [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]],
  },
]

/** Names for the volume shapes (translation keys under setting.volumes). */
export const VOLUME_NAMES = ['pyramid', 'wedge', 'triangle', 'rectangle', 'hexagon', 'diamond', 'chevron', 'quarterBall', 'flake'] as const

/**
 * The shapes each hold type comes in, by name (translation keys under setting.shapes). Underclings
 * are jugs turned upside down, so they share the jugs' shapes.
 */
const JUG_SHAPES = ['bucket', 'ear', 'horn', 'rail', 'ladder', 'thumbCatch', 'deep'] as const
export const HOLD_VARIANTS: Record<Exclude<HoldType, 'volume'>, readonly string[]> = {
  jug: JUG_SHAPES,
  undercling: JUG_SHAPES,
  crimp: ['crimpRail', 'scallop', 'halfMoon', 'micro', 'ripple'],
  edge: ['shelf', 'incutEdge', 'ramp', 'ledge', 'cutlass', 'wire'],
  sloper: ['dome', 'dish', 'roll', 'lip', 'vintage', 'blob'],
  pinch: ['fin', 'block', 'tufa', 'ridge', 'wedgePinch'],
  pocket: ['mono', 'two', 'three', 'slot', 'incutPocket', 'slopingPocket', 'eye', 'twin'],
  sidepull: ['flake', 'blade', 'sideJug', 'sideHorn'],
  foot_chip: ['nub', 'miniLedge', 'disc', 'dimple'],
  macro: ['scooped', 'wave', 'bowl', 'jugMacro', 'dualtex'],
}

/** How many shapes a hold type has to choose from. */
export function shapeCount(type: HoldType): number {
  return type === 'volume' ? VOLUME_SOLIDS.length : HOLD_VARIANTS[type].length
}

/** A shape's name (a key under setting.shapes, or setting.volumes for volumes). */
export function shapeName(type: HoldType, variant: number): string {
  return type === 'volume' ? VOLUME_NAMES[variant % VOLUME_NAMES.length] : HOLD_VARIANTS[type][variant % HOLD_VARIANTS[type].length]
}

/**
 * Fixes each hold's shape to the one it shows now. Without a fixed shape a hold picks one from its
 * position, so it would change shape while being dragged in the editor.
 */
export function withFixedShapes<T extends { type: HoldType; x: number; y: number; variant?: number | null }>(holds: T[]): T[] {
  return holds.map((hold) => (hold.variant != null ? hold : { ...hold, variant: shapeOf(hold) }))
}

/** Big features other holds can be bolted onto (volumes and macros). */
export const SUPPORTS: ReadonlySet<HoldType> = new Set<HoldType>(['volume', 'macro'])

/** The shape a hold uses: the setter's choice, or one picked from its position. */
export function shapeOf(hold: { type: HoldType; x: number; y: number; variant?: number | null }): number {
  const count = shapeCount(hold.type)
  return hold.variant != null ? hold.variant % count : variantIndex(hold.x, hold.y, count)
}

/** The outline used for small icons (the first variant). */
export function iconPath(type: HoldType): string {
  return type === 'volume' ? 'M-1 0.8L0-1L1 0.8Z' : HOLD_SHAPES[type][0]
}

/** Picks a variant from the hold's position, so it stays the same between renders. */
export function variantIndex(x: number, y: number, count: number): number {
  return Math.abs(Math.floor(x * 9973 + y * 7919)) % count
}

/** Mixes a hex colour with white (amount > 0) or black (amount < 0). */
export function shadeColour(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1, 7), 16)
  const target = amount > 0 ? 255 : 0
  const mix = (channel: number) => Math.round(channel + (target - channel) * Math.abs(amount))
  const r = mix((value >> 16) & 255)
  const g = mix((value >> 8) & 255)
  const b = mix(value & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Mixes two hex colours: 0 gives `a`, 1 gives `b`. */
export function mixColour(a: string, b: string, amount: number): string {
  const channels = (hex: string) => [16, 8, 0].map((shift) => (parseInt(hex.slice(1, 7), 16) >> shift) & 255)
  const [from, to] = [channels(a), channels(b)]
  const mixed = from.map((channel, i) => Math.round(channel + (to[i] - channel) * amount))
  return `#${((mixed[0] << 16) | (mixed[1] << 8) | mixed[2]).toString(16).padStart(6, '0')}`
}
