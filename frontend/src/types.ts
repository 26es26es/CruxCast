import type { Colour, Grade } from './constants'

export type User = {
  id: number
  username: string
}

/** The fields a person fills in when logging or editing a crux. */
export type CruxFields = {
  /** May be empty when the climb was picked on the gym map. */
  climb_id: string
  colour: Colour
  area: string
  /** Empty when TopLogger lists the climb without a grade. */
  gym_grade: Grade | null
  personal_grade: Grade | null
  description: string
  experience: string
  tips: string
  /** Position on the gym floor plan, as fractions of its width and height. */
  map_x: number | null
  map_y: number | null
  toplogger_climb_id: string | null
}

export type Wall = {
  id: string
  name: string
  label_x: number | null
  label_y: number | null
}

/** A boulder currently set in the gym, from TopLogger. */
export type MapClimb = {
  id: string
  wall_id: string | null
  wall_name: string | null
  colour: Colour
  colour_hex: string
  grade: Grade | null
  x: number
  y: number
  hold_colour_id: string | null
  /** Climbers voted it soft or hard for its grade. */
  soft_hard: 'soft' | 'hard' | null
  /** Average community rating, 0–100. */
  rating: number | null
  short_friendly: boolean
  in_at: string | null
  out_planned_at: string | null
  circuit_ids: string[]
  tag_ids: string[]
  setter_ids: string[]
}

export type FilterOption = { id: string; name: string; colour_hex: string | null }

/** A style or hold type, with TopLogger's icon as a 24×24 SVG path. */
export type ClimbTag = { id: string; name: string; icon: string | null }

/** A labelled non-climbing part of the gym, e.g. the front desk. */
export type GymArea = { key: string; x: number; y: number; width: number }

export type GymMap = {
  name: string
  /** When the backend fetched this from TopLogger. */
  updated_at: string
  /** True when TopLogger couldn't be reached and this is the last good copy. */
  stale: boolean
  floorplan_url: string
  /** The plan's size; climb and label positions are fractions of it. */
  floorplan_width: number
  floorplan_height: number
  walls: Wall[]
  climbs: MapClimb[]
  areas: GymArea[]
  hold_colours: FilterOption[]
  circuits: FilterOption[]
  styles: ClimbTag[]
  holds: ClimbTag[]
  setters: FilterOption[]
  new_days: number
  out_soon_days: number
}

export type Crux = CruxFields & {
  id: number
  is_favorite: boolean
  has_video: boolean
  created_at: string
  updated_at: string
}
