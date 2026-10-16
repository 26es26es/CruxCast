import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { AdviceCard } from '../components/AdviceCard'
import { ClimbLink } from '../components/ClimbLink'
import { errorMessage } from '../i18n'
import { cssVars } from '../style'
import { formatMinutes, parseDate, TYPE_COLOURS } from '../training'
import type { Advice, TrainingSession } from '../types'

export function TrainingSessionPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getSession(Number(id))
      .then((loaded) => {
        setSession(loaded)
        if (loaded.status === 'planned') {
          return api.getAdvice(loaded.session_type, loaded.date, loaded.id).then(setAdvice)
        }
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [id])

  const remove = async () => {
    if (!session || !confirm(t('training.confirmDelete'))) return
    try {
      await api.deleteSession(session.id)
      navigate('/training', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const longDate = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const sent = session?.climbs.filter((climb) => climb.sent).length ?? 0

  return (
    <div className="page page-narrow training-page">
      <Link to="/training" className="back-link">
        {t('training.back')}
      </Link>
      {error && <p className="error-text">{error}</p>}
      {!session && !error && <p className="status-text">{t('common.loading')}</p>}
      {session && (
        <>
          <div className="page-head" style={cssVars({ '--type-colour': TYPE_COLOURS[session.session_type] })}>
            <p className="section-kicker">
              <span className="type-dot" />
              {t(`training.${session.status}`)}
            </p>
            <h1 className="session-title">{t(`training.types.${session.session_type}`)}</h1>
            <p className="page-lede">
              {longDate.format(parseDate(session.date))}
              {session.start_time && ` · ${session.start_time}`}
            </p>
            <div className="detail-actions">
              {session.status === 'planned' && (
                <Link to={`/training/${session.id}/edit?complete=1`} className="pill pill-primary">
                  {t('training.logIt')}
                </Link>
              )}
              <Link to={`/training/${session.id}/edit`} className="pill">
                {t('detail.edit')}
              </Link>
              <button type="button" className="pill pill-danger" onClick={remove}>
                {t('detail.delete')}
              </button>
            </div>
          </div>

          {session.status === 'planned' && advice && (
            <section>
              <h2 className="section-kicker">{t('training.adviceFor')}</h2>
              <AdviceCard advice={advice} />
            </section>
          )}

          {session.status === 'done' && (
            <>
              <dl className="detail-list">
                <div className="detail-row">
                  <dt>{t('training.durationLabel')}</dt>
                  <dd>{session.duration_min ? formatMinutes(session.duration_min) : '–'}</dd>
                </div>
                <div className="detail-row">
                  <dt>{t('training.effort')}</dt>
                  <dd>{session.effort ? `${session.effort}/10` : '–'}</dd>
                </div>
                <div className="detail-row">
                  <dt>{t('training.climbs')}</dt>
                  <dd>
                    {session.climbs.length === 0 ? (
                      <span className="status-text">{t('training.noClimbs')}</span>
                    ) : (
                      <>
                        <p className="status-text" style={{ margin: '0 0 0.5rem' }}>
                          {t('training.climbsSummary', { sent, count: session.climbs.length })}
                        </p>
                        <ul className="session-climbs">
                          {session.climbs.map((climb, index) => (
                            <li key={index}>
                              <span className={climb.sent ? 'climb-result is-sent' : 'climb-result'}>{climb.sent ? '✓' : '✗'}</span>
                              <strong>{climb.grade ?? '–'}</strong>
                              <span className="status-text">{t('training.attemptsCount', { count: climb.attempts })}</span>
                              <ClimbLink climb={climb} />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </dd>
                </div>
                {session.notes && (
                  <div className="detail-row">
                    <dt>{t('training.notes')}</dt>
                    <dd>{session.notes}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </>
      )}
    </div>
  )
}
