import { useTranslation } from 'react-i18next'
import { ROLE_COLOURS, ROLES } from '../board'
import type { BoardHold } from '../types'

/** What each ring colour on the board means; with `holds`, also how many of each are used. */
export function RoleLegend({ holds }: { holds?: BoardHold[] }) {
  const { t } = useTranslation()
  return (
    <ul className="role-legend">
      {ROLES.map((role) => (
        <li key={role}>
          <span className="role-ring" style={{ borderColor: ROLE_COLOURS[role] }} />
          {t(`board.roles.${role}`)}
          {holds && <strong>{holds.filter((hold) => hold.role === role).length}</strong>}
        </li>
      ))}
    </ul>
  )
}
