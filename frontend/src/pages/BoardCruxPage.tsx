import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { gradeLabel, useBoardLayout } from '../board'
import { KilterBoard } from '../components/KilterBoard'
import { RoleLegend } from '../components/RoleLegend'
import { errorMessage } from '../i18n'
import type { BoardCrux } from '../types'

export function BoardCruxPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { layout, error: layoutError } = useBoardLayout()
  const [crux, setCrux] = useState<BoardCrux | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getBoardCrux(Number(id))
      .then(setCrux)
      .catch((caught) => setError(errorMessage(caught)))
  }, [id])

  const remove = async () => {
    if (!crux || !confirm(t('board.confirmDelete'))) return
    try {
      await api.deleteBoardCrux(crux.id)
      navigate('/board', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="page board-page">
      <Link to="/board" className="back-link">
        {t('board.back')}
      </Link>
      {(error || layoutError) && <p className="error-text">{error ?? layoutError}</p>}
      {!crux && !error && <p className="status-text">{t('common.loading')}</p>}

      {crux && (
        <div className="board-layout">
          <div className="board-stage">
            <header className="board-head">
              <div>
                <p className="board-head-grade">{gradeLabel(crux.grade)}</p>
                <p className="board-head-sub">
                  <span className="board-angle-chip">{crux.angle}°</span>
                  <span className="badge">{crux.is_public ? t('board.publicBadge') : t('board.private')}</span>
                </p>
              </div>
              <div className="board-head-title">
                <h1>{crux.name}</h1>
                <p>{crux.setter}</p>
              </div>
            </header>
            {layout && <KilterBoard layout={layout} holds={crux.holds} />}
          </div>

          <aside className="board-side form-panel">
            <RoleLegend />
            {crux.description && <p className="board-description">{crux.description}</p>}
            {crux.is_mine && (
              <div className="detail-actions">
                <Link to={`/board/${crux.id}/edit`} className="pill">
                  {t('detail.edit')}
                </Link>
                <button type="button" className="pill pill-danger" onClick={remove}>
                  {t('detail.delete')}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
