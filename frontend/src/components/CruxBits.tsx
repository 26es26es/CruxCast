import { useTranslation } from 'react-i18next'
import { COLOURS } from '../constants'
import type { Crux } from '../types'

/** A crux's heading: its climb ID, or colour and grade when it was picked on the map. */
export function useCruxTitle(): (crux: Crux) => string {
  const { t } = useTranslation()
  return (crux) => crux.climb_id || `${t(`colours.${crux.colour}`)} ${crux.gym_grade ?? ''}`.trim()
}

/** "● Red · Atlas" line shown above a crux's title; the wall comes from the gym map. */
export function CruxMeta({ crux, className }: { crux: Crux; className: string }) {
  const { t } = useTranslation()
  return (
    <span className={className}>
      <span className="colour-dot" style={{ background: COLOURS[crux.colour] }} />
      {t(`colours.${crux.colour}`)}
      {crux.area && ` · ${crux.area}`}
    </span>
  )
}

export function GradeChips({ crux }: { crux: Crux }) {
  const { t } = useTranslation()
  return (
    <div className="grade-row">
      {crux.gym_grade && (
        <span className="grade-chip grade-chip-gym">
          <small>{t('detail.gym')}</small>
          {crux.gym_grade}
        </span>
      )}
      {crux.personal_grade && (
        <span className="grade-chip grade-chip-felt">
          <small>{t('detail.felt')}</small>
          {crux.personal_grade}
        </span>
      )}
    </div>
  )
}
