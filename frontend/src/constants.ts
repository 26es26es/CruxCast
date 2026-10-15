// Keep in sync with backend/app/constants.py.

export const COLOURS = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#facc15',
  green: '#22c55e',
  mint: '#9bf4ff',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  black: '#18181b',
  white: '#fafafa',
  grey: '#9ca3af',
  brown: '#92400e',
} as const

export type Colour = keyof typeof COLOURS

export const COLOUR_KEYS = Object.keys(COLOURS) as Colour[]

/** Fontainebleau bouldering scale, easiest to hardest, matching TopLogger's. */
export const GRADES = [
  '3A', '3B', '3C', '4A', '4B', '4C',
  '5A', '5A+', '5B', '5B+', '5C', '5C+',
  '6A', '6A+', '6B', '6B+', '6C', '6C+',
  '7A', '7A+', '7B', '7B+', '7C', '7C+',
  '8A', '8A+', '8B', '8B+', '8C', '8C+',
  '9A',
] as const

export type Grade = (typeof GRADES)[number]

export const MAX_VIDEO_MB = 500
