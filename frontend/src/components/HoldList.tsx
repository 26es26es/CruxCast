import { useTranslation } from 'react-i18next'
import { shapeName, shapeOf } from '../holdShapes'
import { HOLD_TYPES, SIZES, type RouteHold } from '../setting'
import { HoldIcon } from './RouteWall'

/** Size codes as printed on hold boxes (XS … XXL). */
const sizeCode = (size: string) => size.toUpperCase()

/**
 * What a setter needs to put this route up: how many holds of each type, in which shapes and
 * sizes, e.g. "2× Crimp: 1× Scalloped S, 1× Rail M".
 */
export function HoldList({ holds }: { holds: RouteHold[] }) {
  const { t } = useTranslation()
  if (!holds.length) return null
  const groups = HOLD_TYPES.map((type) => {
    const ofType = holds.filter((hold) => hold.type === type)
    // Listed by shape and size, e.g. "2× Scalloped S".
    const parts = new Map<string, number>()
    for (const hold of [...ofType].sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))) {
      const shape = shapeName(type, shapeOf(hold))
      const label = `${t(type === 'volume' ? `setting.volumes.${shape}` : `setting.shapes.${shape}`)} ${sizeCode(hold.size)}`
      parts.set(label, (parts.get(label) ?? 0) + 1)
    }
    return { type, count: ofType.length, parts: [...parts] }
  }).filter((group) => group.count > 0)

  return (
    <section className="hold-list" aria-label={t('setting.holdList')}>
      <h2 className="hold-list-title">{t('setting.holdList')}</h2>
      <ul>
        {groups.map((group) => (
          <li key={group.type}>
            <HoldIcon type={group.type} />
            <strong>{group.count}×</strong>
            <span>{t(`setting.holds.${group.type}`)}</span>
            <span className="hold-list-sizes">{group.parts.map(([label, count]) => `${count}× ${label}`).join(', ')}</span>
          </li>
        ))}
      </ul>
      <p className="hold-list-total">{t('setting.holdListTotal', { count: holds.length })}</p>
    </section>
  )
}
