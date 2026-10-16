import { useTranslation } from 'react-i18next'
import { gradeLabel } from '../board'
import type { Grade } from '../constants'
import type { RouteTemplate } from '../setting'
import { WallProfile } from './RouteWall'

/** "Overhang · 20°" with a small side view of the wall. */
export function WallBadge({ wallType, angle }: { wallType: RouteTemplate['wall_type']; angle: number }) {
  const { t } = useTranslation()
  return (
    <span className="wall-badge">
      <WallProfile angle={angle} />
      {t(`setting.walls.${wallType}`)} · {angle}°
    </span>
  )
}

export function TemplateSummary({ template }: { template: RouteTemplate }) {
  const { t } = useTranslation()
  return (
    <div className="template-summary">
      <span className="board-row-grade">{gradeLabel(template.grade as Grade)}</span>
      <WallBadge wallType={template.wall_type} angle={template.angle} />
      {template.styles.map((style) => (
        <span key={style} className="badge">
          {t(`setting.styles.${style}`)}
        </span>
      ))}
    </div>
  )
}
