import { api } from './api'
import { CachedResource, useCachedResource } from './cachedResource'
import type { Grade } from './constants'
import type { BoardHold, BoardLayout, HoldRole } from './types'

/** Ring colours, as in the Kilter app. */
export const ROLE_COLOURS: Record<HoldRole, string> = {
  start: '#22c55e',
  hand: '#22d3ee',
  finish: '#e879f9',
  foot: '#facc15',
}

export const ROLES: HoldRole[] = ['start', 'hand', 'finish', 'foot']

export const MAX_START_HOLDS = 2
export const MAX_FINISH_HOLDS = 2

const FONT_TO_V: Record<Grade, string> = {
  '3A': 'VB', '3B': 'VB', '3C': 'VB', '4A': 'V0', '4B': 'V0', '4C': 'V0',
  '5A': 'V1', '5A+': 'V1', '5B': 'V1', '5B+': 'V2', '5C': 'V2', '5C+': 'V2',
  '6A': 'V3', '6A+': 'V3', '6B': 'V4', '6B+': 'V4', '6C': 'V5', '6C+': 'V5',
  '7A': 'V6', '7A+': 'V7', '7B': 'V8', '7B+': 'V8', '7C': 'V9', '7C+': 'V10',
  '8A': 'V11', '8A+': 'V12', '8B': 'V13', '8B+': 'V14', '8C': 'V15', '8C+': 'V16',
  '9A': 'V17',
}

/** "6C+/V5", like the board apps show it. */
export function gradeLabel(grade: Grade): string {
  return `${grade}/${FONT_TO_V[grade]}`
}

/** Problems that stop a crux from being saved, as translation keys. */
export function holdIssues(holds: BoardHold[]): string[] {
  const count = (role: HoldRole) => holds.filter((hold) => hold.role === role).length
  const issues: string[] = []
  if (count('start') < 1 || count('start') > MAX_START_HOLDS) issues.push('board.issues.start')
  if (count('finish') < 1 || count('finish') > MAX_FINISH_HOLDS) issues.push('board.issues.finish')
  return issues
}

// The layout never changes while the app runs, so fetch it once.
const boardLayout = new CachedResource(() => api.getBoardLayout())

export function useBoardLayout(): { layout: BoardLayout | null; error: string | null } {
  const { data, error } = useCachedResource(boardLayout)
  return { layout: data, error }
}
