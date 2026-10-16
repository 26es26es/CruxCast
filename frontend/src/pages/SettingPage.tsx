import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../api'
import { COLOURS } from '../constants'
import { FloatTitle } from '../components/FloatTitle'
import { RouteWall } from '../components/RouteWall'
import { TemplateSummary } from '../components/TemplateBits'
import { errorMessage } from '../i18n'
import { STYLES, WALL_TYPES, type RouteTemplate } from '../setting'

type Scope = 'library' | 'shared' | 'mine'

// Remembered while the app is open.
let lastView = { scope: 'library' as Scope, wallType: '', style: '', query: '' }

export function SettingPage() {
  const { t } = useTranslation()
  const [view, setView] = useState(lastView)
  const [templates, setTemplates] = useState<RouteTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const update = (changes: Partial<typeof view>) => setView((current) => ({ ...current, ...changes }))

  useEffect(() => {
    lastView = view
    let active = true
    const timer = window.setTimeout(() => {
      api
        .listTemplates({ scope: view.scope, wallType: view.wallType, style: view.style, q: view.query })
        .then((result) => {
          if (!active) return
          setTemplates(result)
          setError(null)
        })
        .catch((caught) => active && setError(errorMessage(caught)))
    }, view.query ? 250 : 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [view])

  return (
    <div className="page setting-page">
      <div className="page-head page-head-row">
        <div>
          <p className="section-kicker">{t('setting.kicker')}</p>
          <FloatTitle text={t('setting.title')} />
          <p className="page-lede">{t('setting.lede')}</p>
        </div>
        <div className="landing-actions">
          <Link to="/setting/generate" className="pill pill-primary">
            {t('setting.generate')}
          </Link>
          <Link to="/setting/new" className="pill">
            + {t('setting.new')}
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input search-input"
          placeholder={t('setting.search')}
          aria-label={t('setting.search')}
          value={view.query}
          onChange={(event) => update({ query: event.target.value })}
        />
        <div className="toolbar-end">
          <select className="input select-pill" aria-label={t('setting.wallType')} value={view.wallType} onChange={(e) => update({ wallType: e.target.value })}>
            <option value="">{t('setting.allWalls')}</option>
            {WALL_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`setting.walls.${type}`)}
              </option>
            ))}
          </select>
          <select className="input select-pill" aria-label={t('setting.style')} value={view.style} onChange={(e) => update({ style: e.target.value })}>
            <option value="">{t('setting.allStyles')}</option>
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {t(`setting.styles.${style}`)}
              </option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label={t('setting.scope')}>
            {(['library', 'shared', 'mine'] as const).map((scope) => (
              <button key={scope} type="button" aria-pressed={view.scope === scope} onClick={() => update({ scope })}>
                {t(`setting.scopes.${scope}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {templates === null && !error && <p className="status-text">{t('common.loading')}</p>}
      {templates?.length === 0 && (
        <div className="empty-state">
          <h2>{t(`setting.empty.${view.scope}`)}</h2>
          <Link to="/setting/generate" className="pill pill-primary">
            {t('setting.generate')}
          </Link>
        </div>
      )}
      {templates && templates.length > 0 && (
        <ul className="card-grid template-grid">
          {templates.map((template) => (
            <li key={template.id}>
              <Link to={`/setting/${template.id}`} className="card card-link template-card">
                <RouteWall
                  className="template-thumb"
                  wallType={template.wall_type}
                  angle={template.angle}
                  colour={COLOURS[template.colour]}
                  holds={template.holds}
                  showOtherHolds={false}
                  simple
                />
                <h2 className="card-title">{template.name}</h2>
                <TemplateSummary template={template} />
                <span className="card-cue">
                  <span>{template.setter ? t('board.setBy', { name: template.setter }) : t('setting.libraryBadge')}</span>
                  {!template.is_public && !template.is_library && <span className="badge">{t('board.private')}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
