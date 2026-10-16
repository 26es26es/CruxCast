import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Crux } from '../types'
import { useCruxTitle } from '../cruxTitle'
import { CruxMeta, GradeChips } from './CruxBits'
import { FavoriteButton } from './FavoriteButton'

type Props = {
  crux: Crux
  onToggleFavorite: (crux: Crux) => void
}

export function CruxCard({ crux, onToggleFavorite }: Props) {
  const { t } = useTranslation()
  const title = useCruxTitle()
  return (
    <li>
      <Link to={`/cruxes/${crux.id}`} className="card card-link">
        <CruxMeta crux={crux} className="card-meta" />
        <h2 className="card-title">{title(crux)}</h2>
        <GradeChips crux={crux} />
        {crux.description && <p className="card-summary">{crux.description}</p>}
        <span className="card-cue">
          <span>{t('cruxes.view')} →</span>
          {crux.has_video && <span>▶ {t('cruxes.hasVideo')}</span>}
        </span>
      </Link>
      {/* Kept outside the link so it isn't a button nested in a link. */}
      <div className="card-favorite">
        <FavoriteButton active={crux.is_favorite} onToggle={() => onToggleFavorite(crux)} />
      </div>
    </li>
  )
}
