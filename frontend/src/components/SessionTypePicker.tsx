import { useTranslation } from 'react-i18next'
import { cssVars } from '../style'
import { SESSION_TYPES, TYPE_COLOURS } from '../training'
import type { SessionType } from '../types'

/** A row of coloured pills, one per training session type. */
export function SessionTypePicker({ value, onChange }: { value: SessionType; onChange: (type: SessionType) => void }) {
  const { t } = useTranslation()
  return (
    <div className="type-picker" role="group" aria-label={t('training.type')}>
      {SESSION_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="pill"
          aria-pressed={value === type}
          style={cssVars({ '--type-colour': TYPE_COLOURS[type] })}
          onClick={() => onChange(type)}
        >
          <span className="type-dot" />
          {t(`training.types.${type}`)}
        </button>
      ))}
    </div>
  )
}
