import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../api'
import { ClimbName } from '../components/ClimbName'
import { FloatTitle } from '../components/FloatTitle'
import { GymExplorer } from '../components/GymExplorer'
import { MapFreshness } from '../components/MapFreshness'
import { useGymMap } from '../gymMap'
import { isNewClimb, isOutSoon } from '../mapFilters'
import type { Crux, GymMap, MapClimb } from '../types'

/** Details for the climb tapped on the map, with a way to log it. */
function ClimbCard({
  map,
  climb,
  crux,
  onClose,
}: {
  map: GymMap
  climb: MapClimb
  crux: Crux | undefined
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const names = (ids: string[], options: { id: string; name: string }[]) =>
    options.filter((option) => ids.includes(option.id)).map((option) => option.name)
  const setters = names(climb.setter_ids, map.setters)
  const tags = names(climb.tag_ids, [...map.styles, ...map.holds])
  const circuits = names(climb.circuit_ids, map.circuits)
  const date = (iso: string) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(iso))

  return (
    <aside className="climb-card" aria-live="polite">
      <div className="climb-card-main">
        <ClimbName colour={climb.colour} colourHex={climb.colour_hex} grade={climb.grade} wall={climb.wall_name} />
        <div className="climb-card-meta">
          {isNewClimb(climb, map) && <span className="badge badge-new">{t('filters.new')}</span>}
          {isOutSoon(climb, map) && climb.out_planned_at && (
            <span className="badge badge-out">{t('gym.outOn', { date: date(climb.out_planned_at) })}</span>
          )}
          {climb.soft_hard && <span className="badge">{t(`filters.${climb.soft_hard}`)}</span>}
          <span>{climb.rating != null ? `★ ${(climb.rating / 25 + 1).toFixed(1)}` : t('gym.noRating')}</span>
          {circuits.length > 0 && <span>{circuits.join(', ')}</span>}
          {setters.length > 0 && <span>{t('gym.setBy', { names: setters.join(', ') })}</span>}
          {tags.length > 0 && <span>{tags.join(' · ')}</span>}
        </div>
      </div>
      <div className="climb-card-actions">
        {crux ? (
          <Link to={`/cruxes/${crux.id}`} className="pill">
            {t('gym.viewCrux')}
          </Link>
        ) : (
          <Link to="/cruxes/new" state={{ climbId: climb.id }} className="pill pill-primary">
            {t('gym.logClimb')}
          </Link>
        )}
        <button type="button" className="pill pill-icon" onClick={onClose} aria-label={t('map.close')} title={t('map.close')}>
          ×
        </button>
      </div>
    </aside>
  )
}

export function GymPage() {
  const { t } = useTranslation()
  const { map, error } = useGymMap()
  const [cruxes, setCruxes] = useState<Crux[]>([])
  const [selected, setSelected] = useState<MapClimb | null>(null)

  useEffect(() => {
    api.listCruxes().then(setCruxes).catch(() => undefined)
  }, [])

  const cruxByClimb = useMemo(() => {
    const byClimb = new Map<string, Crux>()
    for (const crux of cruxes) if (crux.toplogger_climb_id) byClimb.set(crux.toplogger_climb_id, crux)
    return byClimb
  }, [cruxes])
  const loggedIds = useMemo(() => new Set(cruxByClimb.keys()), [cruxByClimb])

  return (
    <div className="page gym-page">
      <div className="page-head">
        <p className="section-kicker">{map?.name ?? t('nav.myGym')}</p>
        <FloatTitle text={t('gym.title')} />
        {map && (
          <MapFreshness map={map} />
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {!map && !error && <p className="status-text">{t('map.loading')}</p>}
      {map && (
        <GymExplorer
          map={map}
          loggedIds={loggedIds}
          selected={selected}
          onSelect={setSelected}
          // Nearly the full window: scroll down once and the map fills the screen.
          height="calc(100dvh - 6.5rem)"
        />
      )}

      {map && selected && (
        <ClimbCard map={map} climb={selected} crux={cruxByClimb.get(selected.id)} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
