import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COLOURS, type Colour, type Grade } from '../constants'
import { useGymMap } from '../gymMap'
import type { MapClimb } from '../types'
import { ClimbName } from './ClimbName'
import { GymMapView } from './GymMapView'
import { MapPickerDialog } from './MapPickerDialog'

/** The parts of a crux draft that say which climb it is. */
export type CruxLocation = {
  map_x: number | null
  map_y: number | null
  toplogger_climb_id: string | null
  colour: Colour | ''
  gym_grade: Grade | ''
  area: string
}

/** Shows which climb the crux is, on the gym map, and opens the picker. */
export function LocationSection({ location, onPick }: { location: CruxLocation; onPick: (climb: MapClimb) => void }) {
  const { t } = useTranslation()
  const { map, error } = useGymMap()
  const [picking, setPicking] = useState(false)
  const placed = location.map_x != null && location.map_y != null

  return (
    <div className="field">
      <span className="field-label">{t('map.section')}</span>
      {map && placed && (
        <GymMapView
          map={map}
          maxHeight="280px"
          pin={{
            x: location.map_x!,
            y: location.map_y!,
            colour: location.colour ? COLOURS[location.colour] : '#9ca3af',
            label: t('map.yourCrux'),
          }}
        />
      )}
      {placed && location.colour ? (
        <ClimbName colour={location.colour} colourHex={COLOURS[location.colour]} grade={location.gym_grade} wall={location.area} />
      ) : (
        <span className="field-hint">{t('map.hint')}</span>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="map-actions">
        <button type="button" className="pill" disabled={!map} onClick={() => setPicking(true)}>
          {map ? (placed ? t('map.change') : t('map.pick')) : t('map.loading')}
        </button>
      </div>
      {picking && map && (
        <MapPickerDialog
          map={map}
          initialClimbId={location.toplogger_climb_id}
          onPick={onPick}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
