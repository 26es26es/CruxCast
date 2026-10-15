import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { timeAgo } from '../gymMap'
import type { GymMap, MapClimb } from '../types'
import { GymExplorer } from './GymExplorer'

type Props = {
  map: GymMap
  initialClimbId: string | null
  onPick: (climb: MapClimb) => void
  onClose: () => void
}

/** Full-size gym map in a modal, for choosing which climb a crux is. */
export function MapPickerDialog({ map, initialClimbId, onPick, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [loggedIds, setLoggedIds] = useState<ReadonlySet<string>>(new Set())
  const [selected, setSelected] = useState<MapClimb | null>(
    () => map.climbs.find((climb) => climb.id === initialClimbId) ?? null,
  )

  useEffect(() => {
    dialogRef.current?.showModal()
    // For the "In my logbook" filter.
    api
      .listCruxes()
      .then((cruxes) => setLoggedIds(new Set(cruxes.flatMap((crux) => crux.toplogger_climb_id ?? []))))
      .catch(() => undefined)
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="map-dialog"
      aria-labelledby="map-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialogRef.current) dialogRef.current.close()
      }}
    >
      <div className="map-dialog-head">
        <div>
          <p className="section-kicker">{t('map.kicker')}</p>
          <h2 id="map-dialog-title" className="map-dialog-title">
            {map.name}
          </h2>
          <p className={map.stale ? 'map-freshness is-stale' : 'map-freshness'} role={map.stale ? 'status' : undefined}>
            {t(map.stale ? 'map.stale' : 'map.updated', { ago: timeAgo(map.updated_at, i18n.language) })}
          </p>
        </div>
        <button type="button" className="pill" onClick={() => dialogRef.current?.close()}>
          {t('map.close')}
        </button>
      </div>

      <GymExplorer
        map={map}
        loggedIds={loggedIds}
        selected={selected}
        onSelect={setSelected}
        height="calc(100dvh - 19rem)"
        initialFocus={selected}
      />

      <div className="map-dialog-foot">
        {selected ? (
          <span className="map-selection">
            <span className="colour-dot" style={{ background: selected.colour_hex }} />
            {t('map.climbLabel', {
              colour: t(`colours.${selected.colour}`),
              grade: selected.grade ?? '',
              wall: selected.wall_name ?? '',
            })}
          </span>
        ) : (
          <span className="status-text">{t('map.prompt')}</span>
        )}
        <button
          type="button"
          className="pill pill-primary"
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            onPick(selected)
            dialogRef.current?.close()
          }}
        >
          {t('map.use')}
        </button>
      </div>
    </dialog>
  )
}
