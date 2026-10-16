import { useTranslation } from 'react-i18next'
import { api } from './api'
import { CachedResource, useCachedResource } from './cachedResource'
import type { Colour, Grade } from './constants'
import type { GymMap } from './types'

// The backend refreshes from TopLogger every 10 minutes; ask again after that.
const gymMap = new CachedResource(() => api.getGymMap(), 10 * 60 * 1000)

export function useGymMap(): { map: GymMap | null; error: string | null } {
  const { data, error } = useCachedResource(gymMap)
  return { map: data, error }
}

/** "Purple 5B on Atlas" for a climb on the gym map. */
export function useClimbLabel(): (climb: { colour: Colour; grade: Grade | null | ''; wall: string | null }) => string {
  const { t } = useTranslation()
  return ({ colour, grade, wall }) =>
    t('map.climbLabel', { colour: t(`colours.${colour}`), grade: grade || '?', wall: wall ?? '' })
}

/** "5 minutes ago", in the current language. */
export function timeAgo(iso: string, language: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}
