import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { SessionClimb } from '../types'

/** Links a logged climb to the gym crux or board crux it was linked to, if any. */
export function ClimbLink({ climb }: { climb: SessionClimb }) {
  const { t } = useTranslation()
  if (climb.crux) {
    const title = climb.crux.climb_id || `${t(`colours.${climb.crux.colour}`)} ${climb.crux.gym_grade ?? ''}`.trim()
    return <Link to={`/cruxes/${climb.crux.id}`}>{title}</Link>
  }
  if (climb.board_crux) return <Link to={`/board/${climb.board_crux.id}`}>{climb.board_crux.name}</Link>
  return null
}
