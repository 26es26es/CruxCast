import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { GymMap, MapClimb, Wall } from '../types'
import { useZoomPan } from './useZoomPan'

type Props = {
  map: GymMap
  /** Climbs drawn as dots. Clickable when onSelect is given. */
  climbs?: MapClimb[]
  selectedId?: string | null
  onSelect?: (climb: MapClimb) => void
  /** A highlighted marker, e.g. where a logged crux is. */
  pin?: { x: number; y: number; colour: string; label: string } | null
  /** Caps the plan's height so the whole map fits on screen. */
  maxHeight?: string
  /** Allows zooming and panning, with zoom buttons and clickable wall names. */
  zoomable?: boolean
  /** A point (as plan fractions) to start zoomed in on. */
  initialFocus?: { x: number; y: number } | null
}

// Positions follow the zoom through CSS variables, so dots keep their size while the
// plan itself scales and they spread apart.
const at = (x: number, y: number): CSSProperties => ({
  left: `calc(var(--pan-x, 0px) + ${x * 100}% * var(--zoom, 1))`,
  top: `calc(var(--pan-y, 0px) + ${y * 100}% * var(--zoom, 1))`,
})

export function GymMapView({ map, climbs = [], selectedId, onSelect, pin, maxHeight, zoomable = false, initialFocus }: Props) {
  const { t } = useTranslation()
  const frameRef = useRef<HTMLDivElement>(null)
  const { view, animating, zoomBy, reset, focusOn, minScale, maxScale } = useZoomPan(frameRef, zoomable)

  useEffect(() => {
    if (zoomable && initialFocus) {
      const pad = 0.06
      focusOn({ left: initialFocus.x - pad, top: initialFocus.y - pad, right: initialFocus.x + pad, bottom: initialFocus.y + pad }, 3, false)
    }
    // Only when the map first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const climbLabel = (climb: MapClimb) =>
    t('map.climbLabel', {
      colour: t(`colours.${climb.colour}`),
      grade: climb.grade ?? '',
      wall: climb.wall_name ?? '',
    })

  /** Zooms to the area covered by a wall's climbs (all of them, not just filtered). */
  const focusWall = (wall: Wall) => {
    const onWall = map.climbs.filter((climb) => climb.wall_id === wall.id)
    if (!onWall.length) {
      focusOn({ left: wall.label_x! - 0.1, top: wall.label_y! - 0.1, right: wall.label_x! + 0.1, bottom: wall.label_y! + 0.1 })
      return
    }
    const xs = onWall.map((climb) => climb.x)
    const ys = onWall.map((climb) => climb.y)
    focusOn({ left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) })
  }

  const frameStyle = {
    '--map-ratio': map.floorplan_width / map.floorplan_height,
    '--map-max-height': maxHeight,
    '--zoom': view.scale,
    '--pan-x': `${view.x}px`,
    '--pan-y': `${view.y}px`,
  } as CSSProperties

  const classes = ['gym-map', zoomable && 'is-zoomable', view.scale > 1 && 'is-zoomed', animating && 'is-animating']

  return (
    <div ref={frameRef} className={classes.filter(Boolean).join(' ')} style={frameStyle}>
      <img
        className="gym-map-plan"
        src={map.floorplan_url}
        alt={t('map.planAlt', { gym: map.name })}
        draggable={false}
      />
      <div className="gym-map-layer">
        {/* Only on the large, zoomable maps; the small previews are too narrow. */}
        {zoomable &&
          map.areas.map((area) => (
            <span
              key={area.key}
              className="gym-map-area"
              style={{ ...at(area.x, area.y), width: `calc(${area.width * 100}% * var(--zoom, 1))` }}
            >
              <span>{t(`map.areas.${area.key}`)}</span>
            </span>
          ))}
        {map.walls.map((wall) => {
          if (wall.label_x == null || wall.label_y == null) return null
          // Anchor labels near an edge to that edge so they never get clipped.
          const style = { ...at(wall.label_x, wall.label_y), translate: `${-wall.label_x * 100}% -50%` }
          return zoomable ? (
            <button
              key={wall.id}
              type="button"
              className="gym-map-wall"
              style={style}
              title={t('map.zoomToWall', { wall: wall.name })}
              onClick={() => focusWall(wall)}
            >
              {wall.name}
            </button>
          ) : (
            <span key={wall.id} className="gym-map-wall" style={style}>
              {wall.name}
            </span>
          )
        })}
        {climbs.map((climb) => {
          const style = { ...at(climb.x, climb.y), '--dot': climb.colour_hex } as CSSProperties
          return onSelect ? (
            <button
              key={climb.id}
              type="button"
              className="gym-map-dot"
              style={style}
              aria-pressed={climb.id === selectedId}
              aria-label={climbLabel(climb)}
              title={climbLabel(climb)}
              onClick={() => onSelect(climb)}
            />
          ) : (
            <span key={climb.id} className="gym-map-dot" style={style} />
          )
        })}
        {pin && (
          <span
            className="gym-map-pin"
            style={{ ...at(pin.x, pin.y), '--dot': pin.colour } as CSSProperties}
            role="img"
            aria-label={pin.label}
            title={pin.label}
          />
        )}
      </div>
      {zoomable && (
        <div className="gym-map-controls">
          <button type="button" onClick={() => zoomBy(1.6)} disabled={view.scale >= maxScale} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={view.scale <= minScale} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>
            −
          </button>
          <button type="button" onClick={reset} disabled={view.scale <= minScale} aria-label={t('map.zoomReset')} title={t('map.zoomReset')}>
            ⤢
          </button>
        </div>
      )}
    </div>
  )
}
