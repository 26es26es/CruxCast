import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../api'
import { gradeLabel, useBoardLayout } from '../board'
import { FloatTitle } from '../components/FloatTitle'
import { errorMessage } from '../i18n'
import type { BoardCrux } from '../types'

type Scope = 'mine' | 'public'

// Remembered while the app is open, so going back to the list keeps your view.
let lastView: { scope: Scope; angle: number | null; query: string } = { scope: 'mine', angle: null, query: '' }

export function BoardListPage() {
  const { t } = useTranslation()
  const { layout } = useBoardLayout()
  const [scope, setScope] = useState<Scope>(lastView.scope)
  const [angle, setAngle] = useState<number | null>(lastView.angle)
  const [query, setQuery] = useState(lastView.query)
  const [cruxes, setCruxes] = useState<BoardCrux[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    lastView = { scope, angle, query }
    let active = true
    // Wait a moment while typing before searching.
    const timer = window.setTimeout(() => {
      api
        .listBoardCruxes({ scope, angle, q: query })
        .then((result) => {
          if (!active) return
          setCruxes(result)
          setError(null)
        })
        .catch((caught) => active && setError(errorMessage(caught)))
    }, query ? 250 : 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [scope, angle, query])

  const filtering = Boolean(query.trim()) || angle !== null

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <p className="section-kicker">{layout?.name ?? t('board.kicker')}</p>
          <FloatTitle text={t('board.title')} />
          <p className="page-lede">{t('board.lede')}</p>
        </div>
        <Link to="/board/new" className="pill pill-primary">
          + {t('board.new')}
        </Link>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder={t('board.search')}
          aria-label={t('board.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="toolbar-end">
          <select
            className="input select-pill"
            aria-label={t('board.angle')}
            value={angle ?? ''}
            onChange={(event) => setAngle(event.target.value === '' ? null : Number(event.target.value))}
          >
            <option value="">{t('board.allAngles')}</option>
            {(layout?.angles ?? []).map((value) => (
              <option key={value} value={value}>
                {value}°
              </option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label={t('board.scope')}>
            {(['mine', 'public'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>
                {t(`board.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {cruxes === null && !error && <p className="status-text">{t('common.loading')}</p>}
      {cruxes && cruxes.length === 0 && (
        <div className="empty-state">
          <h2>{filtering ? t('board.noMatches') : scope === 'mine' ? t('board.emptyMineTitle') : t('board.emptyPublicTitle')}</h2>
          {!filtering && <p>{scope === 'mine' ? t('board.emptyMineBody') : t('board.emptyPublicBody')}</p>}
          {!filtering && scope === 'mine' && (
            <Link to="/board/new" className="pill pill-primary">
              + {t('board.new')}
            </Link>
          )}
        </div>
      )}
      {cruxes && cruxes.length > 0 && (
        <ul className="board-list">
          {cruxes.map((crux) => (
            <li key={crux.id}>
              <Link to={`/board/${crux.id}`} className="board-row">
                <span className="board-row-main">
                  <span className="board-row-name">{crux.name}</span>
                  <span className="board-row-meta">
                    {t('board.setBy', { name: crux.setter })}
                    {!crux.is_public && <span className="badge">{t('board.private')}</span>}
                  </span>
                </span>
                <span className="board-row-side">
                  <span className="board-row-grade">{gradeLabel(crux.grade)}</span>
                  <span className="board-row-angle">{crux.angle}°</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
