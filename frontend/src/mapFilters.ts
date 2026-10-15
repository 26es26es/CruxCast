// Filters for the gym map, matching how TopLogger's climb filters behave:
// - a filter only applies once it differs from its default;
// - list filters match a climb that has any of the chosen values;
// - "Not" inverts the style and hold filters;
// - three-state checkboxes are off (null), "must be" (true) or "must not be" (false).

import { GRADES } from './constants'
import type { GymMap, MapClimb } from './types'

export type TriState = boolean | null

export type MapFilters = {
  /** Indexes into GRADE_STOPS, inclusive. */
  grade: [number, number]
  softHard: 'soft' | 'hard' | null
  /** Community rating range, 0–100 (1–5 stars). */
  rating: [number, number]
  holdColourIds: string[]
  circuitIds: string[]
  styleIds: string[]
  stylesNot: boolean
  holdIds: string[]
  holdsNot: boolean
  setterIds: string[]
  wallIds: string[]
  /** CruxCast's stand-in for TopLogger's per-account Project/Todo/Tried. */
  logged: TriState
  isNew: TriState
  inAtMin: string | null
  inAtMax: string | null
  outSoon: TriState
  outPlannedAtMin: string | null
  outPlannedAtMax: string | null
  shortFriendly: TriState
}

/** "?" for climbs without a grade, then the Font scale. */
export const GRADE_STOPS = ['?', ...GRADES] as const

export const STAR_STOPS = [1, 2, 3, 4, 5] as const
export const starsToRating = (stars: number) => (stars - 1) * 25
export const ratingToStars = (rating: number) => rating / 25 + 1

export const DEFAULT_FILTERS: MapFilters = {
  grade: [0, GRADE_STOPS.length - 1],
  softHard: null,
  rating: [0, 100],
  holdColourIds: [],
  circuitIds: [],
  styleIds: [],
  stylesNot: false,
  holdIds: [],
  holdsNot: false,
  setterIds: [],
  wallIds: [],
  logged: null,
  isNew: null,
  inAtMin: null,
  inAtMax: null,
  outSoon: null,
  outPlannedAtMin: null,
  outPlannedAtMax: null,
  shortFriendly: null,
}

type Key = keyof MapFilters

function isDefault(filters: MapFilters, key: Key): boolean {
  return JSON.stringify(filters[key]) === JSON.stringify(DEFAULT_FILTERS[key])
}

/** How many filters are switched on (the "Not" switches only count with icons chosen). */
export function activeFilterCount(filters: MapFilters): number {
  const ignored: Key[] = ['stylesNot', 'holdsNot']
  return (Object.keys(DEFAULT_FILTERS) as Key[]).filter(
    (key) => !ignored.includes(key) && !isDefault(filters, key),
  ).length
}

/** Rotates a three-state checkbox: off → must be → must not be → off. */
export function nextTriState(value: TriState): TriState {
  return value === null ? true : value === true ? false : null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days between two moments, rounded toward zero like dayjs's diff. */
function wholeDays(from: number, to: number): number {
  return Math.trunc((to - from) / DAY_MS)
}

/** TopLogger's "new" label: set no more than `new_days` days ago. */
export function isNewClimb(climb: MapClimb, map: GymMap, now = Date.now()): boolean {
  if (!climb.in_at) return false
  return wholeDays(new Date(climb.in_at).getTime(), now) / map.new_days <= 1
}

/** TopLogger's "almost removed" label: planned out within `out_soon_days` days. */
export function isOutSoon(climb: MapClimb, map: GymMap, now = Date.now()): boolean {
  if (!climb.out_planned_at) return false
  const days = wholeDays(now, new Date(climb.out_planned_at).getTime())
  if (days < 0) return false
  return days / map.out_soon_days <= 1
}

function gradeStop(climb: MapClimb): number {
  return climb.grade ? GRADES.indexOf(climb.grade) + 1 : 0
}

const startOfDay = (date: string) => new Date(`${date}T00:00:00`).getTime()
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`).getTime()
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN)

/** Returns the climbs that pass every active filter. */
export function filterClimbs(
  map: GymMap,
  filters: MapFilters,
  loggedClimbIds: ReadonlySet<string>,
  now = Date.now(),
): MapClimb[] {
  const active = (Object.keys(DEFAULT_FILTERS) as Key[]).filter((key) => !isDefault(filters, key))
  const on = (key: Key) => active.includes(key)
  const f = filters

  return map.climbs.filter((climb) => {
    if (on('grade')) {
      const stop = gradeStop(climb)
      if (stop < f.grade[0] || stop > f.grade[1]) return false
    }
    if (on('softHard') && climb.soft_hard !== f.softHard) return false
    if (on('rating') && (climb.rating == null || climb.rating < f.rating[0] || climb.rating > f.rating[1])) {
      return false
    }
    if (on('holdColourIds') && !f.holdColourIds.includes(climb.hold_colour_id ?? '')) return false
    if (on('circuitIds') && !climb.circuit_ids.some((id) => f.circuitIds.includes(id))) return false
    if (on('styleIds')) {
      const has = climb.tag_ids.some((id) => f.styleIds.includes(id))
      if (has === f.stylesNot) return false
    }
    if (on('holdIds')) {
      const has = climb.tag_ids.some((id) => f.holdIds.includes(id))
      if (has === f.holdsNot) return false
    }
    if (on('setterIds') && !climb.setter_ids.some((id) => f.setterIds.includes(id))) return false
    if (on('wallIds') && !(climb.wall_id && f.wallIds.includes(climb.wall_id))) return false
    if (on('logged') && f.logged !== loggedClimbIds.has(climb.id)) return false
    if (on('isNew') && f.isNew !== isNewClimb(climb, map, now)) return false
    if (on('outSoon') && f.outSoon !== isOutSoon(climb, map, now)) return false
    if (on('shortFriendly') && f.shortFriendly !== climb.short_friendly) return false
    // Date bounds: climbs without the date never match, as on TopLogger.
    if (on('inAtMin') && !(time(climb.in_at) > startOfDay(f.inAtMin!))) return false
    if (on('inAtMax') && !(time(climb.in_at) < endOfDay(f.inAtMax!))) return false
    if (on('outPlannedAtMin') && !(time(climb.out_planned_at) > startOfDay(f.outPlannedAtMin!))) return false
    if (on('outPlannedAtMax') && !(time(climb.out_planned_at) < endOfDay(f.outPlannedAtMax!))) return false
    return true
  })
}
