import { useTranslation } from 'react-i18next'
import { ROLE_COLOURS, ROLES } from '../board'

/** What each ring colour on the board means. */
export function RoleLegend() {
  const { t } = useTranslation()
  return (
    <ul className="role-legend">
      {ROLES.map((role) => (
        <li key={role}>
          <span className="role-ring" style={{ borderColor: ROLE_COLOURS[role] }} />
          {t(`board.roles.${role}`)}
        </li>
      ))}
    </ul>
  )
}
