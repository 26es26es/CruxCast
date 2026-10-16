import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { COLOURS } from '../constants'
import { Switch } from '../components/FilterControls'
import { RoleLegend } from '../components/RoleLegend'
import { RouteWall } from '../components/RouteWall'
import { TemplateSummary } from '../components/TemplateBits'
import { errorMessage } from '../i18n'
import type { RouteTemplate } from '../setting'

export function SettingTemplatePage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<RouteTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const [showOthers, setShowOthers] = useState(true)

  useEffect(() => {
    api
      .getTemplate(Number(id))
      .then(setTemplate)
      .catch((caught) => setError(errorMessage(caught)))
  }, [id])

  const remove = async () => {
    if (!template || !confirm(t('setting.confirmDelete'))) return
    try {
      await api.deleteTemplate(template.id)
      navigate('/setting', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  // Opens the editor with a copy, for library templates and other setters' ideas.
  const startFrom = () => {
    if (!template) return
    const { name, wall_type, angle, gym_wall, grade, styles, colour, description, inspired_by, inspired_by_url, holds } = template
    navigate('/setting/new', {
      state: { draft: { name: t('setting.copyName', { name }), wall_type, angle, gym_wall, grade, styles, colour, description, inspired_by, inspired_by_url, is_public: false, holds } },
    })
  }

  return (
    <div className="page board-page">
      <Link to="/setting" className="back-link">
        {t('setting.back')}
      </Link>
      {error && <p className="error-text">{error}</p>}
      {!template && !error && <p className="status-text">{t('common.loading')}</p>}
      {template && (
        <div className="board-layout">
          <div className="route-stage">
            <RouteWall wallType={template.wall_type} angle={template.angle} colour={COLOURS[template.colour]} holds={template.holds} showRoles={showRoles} showOtherHolds={showOthers} />
            <div className="wall-options">
              <Switch label={t('setting.showRoles')} checked={showRoles} onChange={setShowRoles} />
              <Switch label={t('setting.showOtherHolds')} checked={showOthers} onChange={setShowOthers} />
            </div>
          </div>
          <aside className="board-side form-panel template-side">
            <p className="section-kicker">{template.setter ?? t('setting.libraryBadge')}</p>
            <h1 className="template-title">{template.name}</h1>
            <TemplateSummary template={template} />
            {template.gym_wall && <p className="status-text">{t('setting.forWall', { wall: template.gym_wall })}</p>}
            {template.description && <p className="board-description">{template.description}</p>}
            {template.inspired_by && (
              <p className="template-credit">
                {t('setting.inspiredBy')}{' '}
                {template.inspired_by_url ? (
                  <a href={template.inspired_by_url} target="_blank" rel="noopener noreferrer">
                    {template.inspired_by} ↗
                  </a>
                ) : (
                  template.inspired_by
                )}
              </p>
            )}
            <RoleLegend />
            <div className="detail-actions">
              <button type="button" className="pill pill-primary" onClick={startFrom}>
                {t('setting.startFrom')}
              </button>
              {template.is_mine && (
                <>
                  <Link to={`/setting/${template.id}/edit`} className="pill">
                    {t('detail.edit')}
                  </Link>
                  <button type="button" className="pill pill-danger" onClick={remove}>
                    {t('detail.delete')}
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
