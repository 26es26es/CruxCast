import { useTranslation } from 'react-i18next'
import type { Crux } from './types'

/** A crux's heading: its climb ID, or colour and grade when it was picked on the map. */
export function useCruxTitle(): (crux: Crux) => string {
  const { t } = useTranslation()
  return (crux) => crux.climb_id || `${t(`colours.${crux.colour}`)} ${crux.gym_grade ?? ''}`.trim()
}
