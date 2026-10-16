import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../api'
import { AdviceCard } from '../components/AdviceCard'
import { FloatTitle } from '../components/FloatTitle'
import { SessionTypePicker } from '../components/SessionTypePicker'
import { GRADES, type Grade } from '../constants'
import { useCruxTitle } from '../cruxTitle'
import { errorMessage } from '../i18n'
import { isoDate } from '../training'
import type { Advice, BoardCrux, Crux, SessionClimbInput, SessionType, TrainingSessionInput } from '../types'

const NEW_CLIMB: SessionClimbInput = { grade: null, sent: false, attempts: 1, crux_id: null, board_crux_id: null }

/**
 * Plan a session (/training/new?mode=plan), log one (?mode=log), edit one
 * (/training/:id/edit), or log a planned one as done (?complete=1).
 */
export function TrainingFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const cruxTitle = useCruxTitle()
  const editing = id !== undefined
  const completing = search.get('complete') === '1'

  const [input, setInput] = useState<TrainingSessionInput | null>(() =>
    editing
      ? null
      : {
          session_type: (search.get('type') as SessionType | null) ?? 'calm_bouldering',
          status: search.get('mode') === 'log' ? 'done' : 'planned',
          date: search.get('date') ?? isoDate(new Date()),
          start_time: null,
          duration_min: null,
          effort: search.get('mode') === 'log' ? 6 : null,
          notes: '',
          climbs: [],
        },
  )
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [cruxes, setCruxes] = useState<Crux[]>([])
  const [boardCruxes, setBoardCruxes] = useState<BoardCrux[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) return
    api
      .getSession(Number(id))
      .then((session) => {
        const done = completing || session.status === 'done'
        setInput({
          session_type: session.session_type,
          status: done ? 'done' : 'planned',
          date: session.date,
          start_time: session.start_time,
          duration_min: session.duration_min,
          effort: session.effort ?? (done ? 6 : null),
          notes: session.notes,
          climbs: session.climbs.map((climb) => ({
            grade: climb.grade,
            sent: climb.sent,
            attempts: climb.attempts,
            crux_id: climb.crux?.id ?? null,
            board_crux_id: climb.board_crux?.id ?? null,
          })),
        })
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [editing, id, completing])

  const logging = input?.status === 'done'

  // Live advice while planning.
  useEffect(() => {
    if (!input || logging) return
    let active = true
    api
      .getAdvice(input.session_type, input.date, editing ? Number(id) : undefined)
      .then((result) => active && setAdvice(result))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [input?.session_type, input?.date, logging, editing, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cruxes the climbs can be linked to.
  useEffect(() => {
    if (!logging) return
    api.listCruxes().then(setCruxes).catch(() => undefined)
    Promise.all([api.listBoardCruxes({ scope: 'mine' }), api.listBoardCruxes({ scope: 'public' })])
      .then(([mine, shared]) => setBoardCruxes([...mine, ...shared.filter((c) => !c.is_mine)]))
      .catch(() => undefined)
  }, [logging])

  if (!input) {
    return (
      <div className="page page-narrow">{error ? <p className="error-text">{error}</p> : <p className="status-text">{t('common.loading')}</p>}</div>
    )
  }

  const set = <K extends keyof TrainingSessionInput>(key: K, value: TrainingSessionInput[K]) =>
    setInput((current) => (current ? { ...current, [key]: value } : current))
  const setClimb = (index: number, changes: Partial<SessionClimbInput>) =>
    set('climbs', input.climbs.map((climb, i) => (i === index ? { ...climb, ...changes } : climb)))

  const linkValue = (climb: SessionClimbInput) =>
    climb.crux_id !== null ? `c${climb.crux_id}` : climb.board_crux_id !== null ? `b${climb.board_crux_id}` : ''
  const onLink = (index: number, value: string) => {
    const crux = value.startsWith('c') ? cruxes.find((c) => c.id === Number(value.slice(1))) : undefined
    const boardCrux = value.startsWith('b') ? boardCruxes.find((c) => c.id === Number(value.slice(1))) : undefined
    const climb = input.climbs[index]
    setClimb(index, {
      crux_id: crux?.id ?? null,
      board_crux_id: boardCrux?.id ?? null,
      // Take the linked crux's grade if none was chosen yet.
      grade: climb.grade ?? crux?.personal_grade ?? crux?.gym_grade ?? (boardCrux?.grade as Grade | undefined) ?? null,
    })
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const payload: TrainingSessionInput = logging
      ? input
      : { ...input, effort: null, climbs: [] }
    try {
      const session = editing ? await api.replaceSession(Number(id), payload) : await api.createSession(payload)
      navigate(`/training/${session.id}`, { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  const title = completing
    ? t('training.completeTitle')
    : editing
      ? t('training.editTitle')
      : logging
        ? t('training.logTitle')
        : t('training.planTitle')

  return (
    <div className="page page-narrow training-page">
      <Link to={editing ? `/training/${id}` : '/training'} className="back-link">
        {t('training.back')}
      </Link>
      <div className="page-head">
        <p className="section-kicker">{t('training.kicker')}</p>
        <FloatTitle text={title} />
      </div>

      <form className="form form-panel" onSubmit={save}>
        <div className="field">
          <span className="field-label">{t('training.type')}</span>
          <SessionTypePicker value={input.session_type} onChange={(type) => set('session_type', type)} />
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field-label">{t('training.date')}</span>
            <input className="input" type="date" required value={input.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          {logging ? (
            <label className="field">
              <span className="field-label">{t('training.duration')}</span>
              <input
                className="input"
                type="number"
                required
                min={5}
                max={600}
                step={5}
                value={input.duration_min ?? ''}
                onChange={(e) => set('duration_min', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
          ) : (
            <label className="field">
              <span className="field-label">{t('training.startTime')}</span>
              <input
                className="input"
                type="time"
                value={input.start_time ?? ''}
                onChange={(e) => set('start_time', e.target.value || null)}
              />
            </label>
          )}
        </div>

        {logging && (
          <label className="field">
            <span className="field-label">
              {t('training.effort')} <strong className="effort-value">{input.effort}/10</strong>
            </span>
            <input
              className="effort-slider"
              type="range"
              min={1}
              max={10}
              value={input.effort ?? 6}
              onChange={(e) => set('effort', Number(e.target.value))}
            />
            <span className="field-hint">{t('training.effortHint')}</span>
          </label>
        )}

        {logging && (
          <div className="field">
            <span className="field-label">{t('training.climbs')}</span>
            {input.climbs.length > 0 && (
              <ol className="climb-rows">
                {input.climbs.map((climb, index) => (
                  <li key={index} className="climb-row">
                    <select
                      aria-label={t('training.grade')}
                      value={climb.grade ?? ''}
                      onChange={(e) => setClimb(index, { grade: (e.target.value || null) as Grade | null })}
                    >
                      <option value="">{t('training.grade')}</option>
                      {GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                    <label className="climb-sent">
                      <input type="checkbox" checked={climb.sent} onChange={(e) => setClimb(index, { sent: e.target.checked })} />
                      {t('training.sent')}
                    </label>
                    <label className="climb-attempts">
                      <span>{t('training.attempts')}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={99}
                        value={climb.attempts}
                        onChange={(e) => setClimb(index, { attempts: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </label>
                    <select aria-label={t('training.link')} value={linkValue(climb)} onChange={(e) => onLink(index, e.target.value)}>
                      <option value="">{t('training.noLink')}</option>
                      {cruxes.length > 0 && (
                        <optgroup label={t('training.gymCruxes')}>
                          {cruxes.map((crux) => (
                            <option key={crux.id} value={`c${crux.id}`}>
                              {cruxTitle(crux)}
                              {crux.area ? ` · ${crux.area}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {boardCruxes.length > 0 && (
                        <optgroup label={t('training.boardCruxes')}>
                          {boardCruxes.map((crux) => (
                            <option key={crux.id} value={`b${crux.id}`}>
                              {crux.name} · {crux.grade} · {crux.angle}°
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      className="pill pill-icon pill-danger"
                      aria-label={t('training.removeClimb')}
                      onClick={() => set('climbs', input.climbs.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div>
              <button type="button" className="pill" onClick={() => set('climbs', [...input.climbs, { ...NEW_CLIMB }])}>
                {t('training.addClimb')}
              </button>
            </div>
          </div>
        )}

        <label className="field">
          <span className="field-label">{t('training.notes')}</span>
          <textarea maxLength={2000} placeholder={t('training.notesPlaceholder')} value={input.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="pill" onClick={() => navigate(editing ? `/training/${id}` : '/training')} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="pill pill-primary" disabled={saving}>
            {saving ? t('common.saving') : logging ? t('training.saveLog') : t('training.savePlan')}
          </button>
        </div>
      </form>

      {!logging && advice && (
        <section className="training-block">
          <h2 className="section-kicker">{t('training.adviceFor')}</h2>
          <AdviceCard advice={advice} onSwitchType={(type) => set('session_type', type)} />
        </section>
      )}
    </div>
  )
}
