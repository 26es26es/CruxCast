import type { HoldType } from '../setting'

// The list of hold models added by hand in public/holds (see the README there). Kept apart
// from the 3D code so the credits can be shown without loading three.js.

export type Axis = 'x' | 'y' | 'z' | '-x' | '-y' | '-z'

export type HoldModelEntry = {
  file: string
  type: HoldType
  name: string
  author: string
  licence: string
  url: string
  /** The model's axis pointing up the wall (default y) and away from it (default z). */
  up?: Axis
  out?: Axis
}

export const HOLDS_FOLDER = '/holds/'

let manifest: Promise<HoldModelEntry[]> | undefined

/** The hold models listed in holds.json, or none if there is no list. Fetched once. */
export function holdManifest(): Promise<HoldModelEntry[]> {
  manifest ??= fetch(`${HOLDS_FOLDER}holds.json`)
    .then((response) => (response.ok ? response.json() : []))
    .then((entries: unknown) => (Array.isArray(entries) ? (entries as HoldModelEntry[]) : []))
    .catch(() => [])
  return manifest
}
