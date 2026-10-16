import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cssVars } from '../style'
import { activeFilterCount, DEFAULT_FILTERS, filterClimbs, type MapFilters } from '../mapFilters'
import type { GymMap, MapClimb } from '../types'
import { GymMapView } from './GymMapView'
import { MapFilterPanel } from './MapFilterPanel'

type Props = {
  map: GymMap
  /** TopLogger ids of climbs already in the user's logbook. */
  loggedIds: ReadonlySet<string>
  selected: MapClimb | null
  onSelect: (climb: MapClimb) => void
  /** Tallest the map (and the filter column beside it) may be. */
  height: string
  initialFocus?: { x: number; y: number } | null
}

// Shared by the picker and the My Gym page so filters carry over between them.
let savedFilters: MapFilters = DEFAULT_FILTERS

/** The zoomable gym map with TopLogger-style filters beside it. */
export function GymExplorer({ map, loggedIds, selected, onSelect, height, initialFocus }: Props) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<MapFilters>(savedFilters)
  const [showFilters, setShowFilters] = useState(false)

  const updateFilters = (next: MapFilters) => {
    savedFilters = next
    setFilters(next)
  }

  const visible = useMemo(() => filterClimbs(map, filters, loggedIds), [map, filters, loggedIds])
  const count = activeFilterCount(filters)

  return (
    <div className="explorer" style={cssVars({ '--explorer-height': height })}>
      <div className="map-toolbar">
        <button
          type="button"
          className="pill filters-toggle"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          {t('filters.title')}
          {count > 0 && <span className="filter-count">{count}</span>}
        </button>
        <span className="status-text map-count">{t('map.shown', { count: visible.length })}</span>
        <span className="map-hint">{t('map.zoomHint')}</span>
      </div>

      <div className={`explorer-body${showFilters ? ' filters-open' : ''}`}>
        <div className="explorer-map">
          <GymMapView
            map={map}
            climbs={visible}
            selectedId={selected?.id}
            onSelect={onSelect}
            maxHeight={height}
            zoomable
            initialFocus={initialFocus}
          />
        </div>
        <MapFilterPanel map={map} filters={filters} onChange={updateFilters} />
      </div>
    </div>
  )
}
