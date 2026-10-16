import type { SessionType } from './types'

export const SESSION_TYPES: SessionType[] = ['power_bouldering', 'calm_bouldering', 'board', 'gym_workout', 'rest']

export const TYPE_COLOURS: Record<SessionType, string> = {
  power_bouldering: '#ec4899',
  calm_bouldering: '#22c55e',
  board: '#3b82f6',
  gym_workout: '#f59e0b',
  rest: '#a1a1aa',
}

/** yyyy-mm-dd in local time (toISOString would shift to UTC). */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Monday of the week containing `date`. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`
}
