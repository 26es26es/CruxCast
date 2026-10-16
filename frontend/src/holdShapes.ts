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
]

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
