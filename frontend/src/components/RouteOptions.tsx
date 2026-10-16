import { useTranslation } from 'react-i18next'
import { COLOUR_KEYS, COLOURS, GRADES, type Colour, type Grade } from '../constants'
import { gradeLabel } from '../board'
import { ANGLES, HOLD_TYPES, WALL_TYPES, type HoldType, type WallType } from '../setting'
import { HoldIcon } from './RouteWall'

/** Wall type, angle and grade selects, shared by the generator and the editor. */
export function WallFields({
  wallType,
  angle,
  grade,
  onChange,
}: {
  wallType: WallType
  angle: number
  grade: Grade
  onChange: (changes: { wall_type?: WallType; angle?: number; grade?: Grade }) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="form-grid form-grid-3">
      <label className="field">
        <span className="field-label">{t('setting.wallType')}</span>
        <select value={wallType} onChange={(e) => onChange({ wall_type: e.target.value as WallType })}>
          {WALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`setting.walls.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t('board.angle')}</span>
        <select value={angle} onChange={(e) => onChange({ angle: Number(e.target.value) })}>
          {ANGLES.map((value) => (
            <option key={value} value={value}>
              {value}°
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t('board.grade')}</span>
        <select value={grade} onChange={(e) => onChange({ grade: e.target.value as Grade })}>
          {GRADES.map((value) => (
            <option key={value} value={value}>
              {gradeLabel(value)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** The route's hold colour as a row of circles. */
export function ColourPicker({ value, onChange }: { value: Colour; onChange: (colour: Colour) => void }) {
  const { t } = useTranslation()
  return (
    <div className="colour-circles" role="group" aria-label={t('setting.colour')}>
      {COLOUR_KEYS.map((colour) => (
        <button
          key={colour}
          type="button"
          className="colour-circle"
          aria-pressed={value === colour}
          aria-label={t(`colours.${colour}`)}
          title={t(`colours.${colour}`)}
          style={{ background: COLOURS[colour] }}
          onClick={() => onChange(colour)}
        />
      ))}
    </div>
  )
}

/** Toggle buttons for hold types, each with its outline. */
export function HoldTypeToggles({
  selected,
  onToggle,
}: {
  selected: HoldType[]
  onToggle: (type: HoldType) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="hold-type-grid" role="group" aria-label={t('setting.holdTypes')}>
      {HOLD_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="hold-type-button"
          aria-pressed={selected.includes(type)}
          title={t(`setting.holds.${type}`)}
          onClick={() => onToggle(type)}
        >
          <HoldIcon type={type} />
          <span>{t(`setting.holds.${type}`)}</span>
        </button>
      ))}
    </div>
  )
}
