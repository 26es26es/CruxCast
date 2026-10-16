import { useTranslation } from 'react-i18next'
import { timeAgo } from '../gymMap'
import type { GymMap } from '../types'

/** "Climbs from TopLogger, updated 5 minutes ago", or a warning when the copy is stale. */
export function MapFreshness({ map }: { map: GymMap }) {
  const { t, i18n } = useTranslation()
  return (
    <p className={map.stale ? 'map-freshness is-stale' : 'map-freshness'} role={map.stale ? 'status' : undefined}>
      {t(map.stale ? 'map.stale' : 'map.updated', { ago: timeAgo(map.updated_at, i18n.language) })}
    </p>
  )
}
