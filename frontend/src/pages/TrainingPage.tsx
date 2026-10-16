import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { AdviceCard } from '../components/AdviceCard'
import { FloatTitle } from '../components/FloatTitle'
import { SessionTypePicker } from '../components/SessionTypePicker'
import { errorMessage } from '../i18n'
import { cssVars } from '../style'
import { addDays, formatMinutes, isoDate, TYPE_COLOURS, weekStart } from '../training'
import type { Advice, SessionType, TrainingSession } from '../types'

// Remembered while the app is open.
let lastType: SessionType = 'calm_bouldering'

function SessionChip({ session }: { session: TrainingSession }) {
  const { t } = useTranslation()
  return (
    <Link
      to={`/training/${session.id}`}
      className={`session-chip is-${session.status}`}
      style={cssVars({ '--type-colour': TYPE_COLOURS[session.session_type] })}
    >
      <span className="session-chip-type">{t(`training.types.${session.session_type}`)}</span>
      <span className="session-chip-meta">
        {session.status === 'planned'
          ? `${t('training.planned')}${session.start_time ? ` · ${session.start_time}` : ''}`
          : `${session.duration_min ? formatMinutes(session.duration_min) : ''}${session.effort ? ` · ${session.effort}/10` : ''}`}
      </span>
    </Link>
  )
}

export function TrainingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [today] = useState(() => isoDate(new Date()))
  const [type, setType] = useState<SessionType>(lastType)
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [monday, setMonday] = useState(() => weekStart(new Date()))
  const [week, setWeek] = useState<TrainingSession[] | null>(null)
  const [recent, setRecent] = useState<TrainingSession[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    lastType = type
    let active = true
    api
      .getAdvice(type, today)
      .then((result) => active && setAdvice(result))
      .catch((caught) => active && setError(errorMessage(caught)))
    return () => {
      active = false
    }
  }, [type, today])

  useEffect(() => {
    let active = true
    api
      .listSessions({ start: isoDate(monday), end: isoDate(addDays(monday, 6)) })
      .then((result) => active && setWeek(result))
      .catch((caught) => active && setError(errorMessage(caught)))
    return () => {
      active = false
    }
  }, [monday])

  useEffect(() => {
    api.listSessions({ status: 'done', limit: 5 }).then(setRecent).catch(() => undefined)
  }, [])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
  const dayMonth = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })
  const longDate = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page training-page">
      <div className="page-head page-head-row">
        <div>
          <p className="section-kicker">{t('training.kicker')}</p>
          <FloatTitle text={t('training.title')} />
          <p className="page-lede">{t('training.lede')}</p>
        </div>
        <Link to="/training/new?mode=log" className="pill pill-primary">
          + {t('training.logSession')}
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      <section className="training-block">
        <h2 className="section-kicker">{t('training.advisorTitle')}</h2>
        <p className="status-text">{t('training.advisorHint')}</p>
        <SessionTypePicker value={type} onChange={setType} />
        {advice && <AdviceCard advice={advice} onSwitchType={setType} />}
        <div className="detail-actions">
          <button type="button" className="pill pill-primary" onClick={() => navigate(`/training/new?mode=plan&type=${type}&date=${today}`)}>
            {t('training.planToday')}
          </button>
        </div>
      </section>

      <section className="training-block">
        <div className="week-head">
          <h2 className="section-kicker">{t('training.weekOf', { date: dayMonth.format(monday) })}</h2>
          <div className="week-nav">
            <button type="button" className="pill pill-icon" aria-label={t('training.prevWeek')} onClick={() => setMonday(addDays(monday, -7))}>
              ‹
            </button>
            <button type="button" className="pill" onClick={() => setMonday(weekStart(new Date()))}>
              {t('training.thisWeek')}
            </button>
            <button type="button" className="pill pill-icon" aria-label={t('training.nextWeek')} onClick={() => setMonday(addDays(monday, 7))}>
              ›
            </button>
          </div>
        </div>
        <ol className="week-grid">
          {days.map((day) => {
            const iso = isoDate(day)
            const sessions = (week ?? []).filter((session) => session.date === iso)
            return (
              <li key={iso} className={iso === today ? 'week-day is-today' : 'week-day'} aria-label={longDate.format(day)}>
                <div className="week-day-head">
                  <span>{weekday.format(day)}</span>
                  <strong>{day.getDate()}</strong>
                </div>
                <div className="week-day-sessions">
                  {sessions.map((session) => (
                    <SessionChip key={session.id} session={session} />
                  ))}
                </div>
                <Link to={`/training/new?mode=plan&date=${iso}`} className="week-day-add" aria-label={t('training.planOn', { date: longDate.format(day) })}>
                  + {t('training.plan')}
                </Link>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="training-block">
        <h2 className="section-kicker">{t('training.recentTitle')}</h2>
        {recent.length === 0 ? (
          <p className="status-text">{t('training.noRecent')}</p>
        ) : (
          <ul className="recent-sessions">
            {recent.map((session) => (
              <li key={session.id}>
                <SessionChip session={session} />
                <span className="status-text">{longDate.format(new Date(`${session.date}T00:00`))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
