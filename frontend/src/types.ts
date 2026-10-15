import type { Colour, Grade } from './constants'

export type User = {
  id: number
  username: string
}

/** The fields a person fills in when logging or editing a crux. */
export type CruxFields = {
  climb_id: string
  colour: Colour
  area: string
  gym_grade: Grade
  personal_grade: Grade | null
  description: string
  experience: string
  tips: string
}

export type Crux = CruxFields & {
  id: number
  is_favorite: boolean
  has_video: boolean
  created_at: string
  updated_at: string
}
