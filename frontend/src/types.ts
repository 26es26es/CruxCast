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

// ---------- Board cruxes (Kilter Board) ----------

/** What a hold is used for, matching the Kilter app: start, hand, top, foot only. */
export type HoldRole = 'start' | 'hand' | 'finish' | 'foot'

export type BoardHold = { id: number; role: HoldRole }

export type BoardLayout = {
  id: string
  name: string
  /** Board width divided by height; hold positions are fractions of each. */
  aspect: number
  angles: number[]
  holds: { id: number; x: number; y: number; points: [number, number][] }[]
}

export type BoardCruxFields = {
  name: string
  angle: number
  grade: Grade
  description: string
  is_public: boolean
  holds: BoardHold[]
}

export type BoardCrux = BoardCruxFields & {
  id: number
  setter: string
  is_mine: boolean
  created_at: string
  updated_at: string
}

// ---------- Training ----------

export type SessionType = 'gym_workout' | 'power_bouldering' | 'calm_bouldering' | 'board' | 'rest'

export type SessionClimbInput = {
  grade: Grade | null
  sent: boolean
  attempts: number
  crux_id: number | null
  board_crux_id: number | null
}

export type SessionClimb = {
  grade: Grade | null
  sent: boolean
  attempts: number
  crux: { id: number; climb_id: string; colour: Colour; gym_grade: Grade | null } | null
  board_crux: { id: number; name: string; grade: Grade } | null
}

export type TrainingSessionInput = {
  session_type: SessionType
  status: 'planned' | 'done'
  /** yyyy-mm-dd */
  date: string
  start_time: string | null
  duration_min: number | null
  effort: number | null
  notes: string
  climbs: SessionClimbInput[]
}

export type TrainingSession = Omit<TrainingSessionInput, 'climbs'> & {
  id: number
  climbs: SessionClimb[]
  created_at: string
}

export type AdviceStep = { key: string; minutes: number; params: Record<string, string | number> }

export type Advice = {
  session_type: SessionType
  intensity: 'low' | 'medium' | 'high'
  total_minutes: number
  warm_up: AdviceStep[]
  main: AdviceStep[]
  cool_down: AdviceStep[]
  reasons: { code: string; params: Record<string, string | number> }[]
  suggest_instead: SessionType[]
}
