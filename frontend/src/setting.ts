// Route setting catalogue. Keep in sync with backend/app/setting.py.

import type { Colour, Grade } from './constants'
import type { HoldRole } from './types'

export const WALL_TYPES = ['slab', 'vertical', 'overhang', 'steep', 'roof', 'arete', 'dihedral'] as const
export type WallType = (typeof WALL_TYPES)[number]

export const DEFAULT_ANGLES: Record<WallType, number> = {
  slab: -10, vertical: 0, overhang: 20, steep: 40, roof: 90, arete: 15, dihedral: 0,
}
export const ANGLES = Array.from({ length: 23 }, (_, i) => -20 + i * 5)

export const HOLD_TYPES = [
  'jug', 'crimp', 'edge', 'sloper', 'pinch', 'pocket', 'sidepull', 'undercling', 'foot_chip', 'volume', 'macro',
] as const
export type HoldType = (typeof HOLD_TYPES)[number]

export const SIZES = ['xs', 's', 'm', 'l', 'xl'] as const
export type HoldSize = (typeof SIZES)[number]
/** Hold radius as a fraction of the 6 m wall's width (same as the backend's RADIUS). */
export const RADIUS: Record<HoldSize, number> = { xs: 0.0058, s: 0.0092, m: 0.0142, l: 0.02, xl: 0.0367 }
/** Usual size per type, for holds placed by hand. */
export const DEFAULT_SIZE: Record<HoldType, HoldSize> = {
  jug: 'm', crimp: 's', edge: 's', sloper: 'l', pinch: 'm', pocket: 'm', sidepull: 'm', undercling: 'm',
  foot_chip: 'xs', volume: 'xl', macro: 'xl',
}

export const STYLES = [
  'crimpy', 'slopey', 'compression', 'dyno', 'balance', 'power', 'technical', 'coordination', 'juggy',
] as const
export type Style = (typeof STYLES)[number]

/** The wall section is 6 m wide and 4.5 m high. */
export const FACE_ASPECT = 0.75

/** Where a generated route goes; "auto" picks one that suits the style and wall. */
export const PATHS = ['auto', 'up', 'diagonal', 'traverse', 'zigzag'] as const
export type RoutePath = (typeof PATHS)[number]

export type RouteHold = {
  /** 0–1 from the left. */
  x: number
  /** 0–1 from the top. */
  y: number
  type: HoldType
  size: HoldSize
  /** Degrees clockwise. */
  rotation: number
  role: HoldRole
}

export type RouteTemplateInput = {
  name: string
  wall_type: WallType
  angle: number
  gym_wall: string | null
  grade: Grade
  styles: Style[]
  colour: Colour
  description: string
  /** Credit for a route modelled on a real one, with a link to it. */
  inspired_by: string | null
  inspired_by_url: string | null
  is_public: boolean
  holds: RouteHold[]
}

export type RouteTemplate = RouteTemplateInput & {
  id: number
  setter: string | null
  is_library: boolean
  is_mine: boolean
  created_at: string
}

export type GenerateSpec = {
  wall_type: WallType
  angle: number
  grade: Grade
  style: Style
  path: RoutePath
  moves: number
  hold_types: HoldType[]
  seed: number
}

/** Makes `index` the route's only top hold: any other top becomes a hand hold. */
export function withSingleTop(holds: RouteHold[], index: number): RouteHold[] {
  return holds.map((hold, i) => (i !== index && hold.role === 'finish' ? { ...hold, role: 'hand' } : hold))
}

/** Problems that stop a route from being saved, as translation keys. */
export function routeIssues(holds: RouteHold[]): string[] {
  const count = (role: HoldRole) => holds.filter((hold) => hold.role === role).length
  const issues: string[] = []
  if (count('start') < 1 || count('start') > 2) issues.push('setting.issues.start')
  // A boulder finishes with both hands matched on one top hold.
  if (count('finish') !== 1) issues.push('setting.issues.finish')
  return issues
}
