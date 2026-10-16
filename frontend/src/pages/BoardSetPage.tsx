import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { gradeLabel, holdIssues, useBoardLayout } from '../board'
import { Switch } from '../components/FilterControls'
import { KilterBoard } from '../components/KilterBoard'
import { RoleLegend } from '../components/RoleLegend'
import { GRADES, type Grade } from '../constants'
import { errorMessage } from '../i18n'
import type { BoardCruxFields } from '../types'

const NEW_CRUX: BoardCruxFields = {
  name: '',
  angle: 40,
  grade: '6A',
  description: '',
  is_public: false,
  holds: [],
}

/** Setting a new board crux, or editing one of yours (/board/:id/edit). */
export function BoardSetPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined
  const { layout, error: layoutError } = useBoardLayout()
  const [fields, setFields] = useState<BoardCruxFields | null>(editing ? null : NEW_CRUX)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [triedSaving, setTriedSaving] = useState(false)

  useEffect(() => {
    if (!editing) return
    api
      .getBoardCrux(Number(id))
      .then((crux) => {
        if (!crux.is_mine) {
          navigate(`/board/${crux.id}`, { replace: true })
          return
        }
        const { name, angle, grade, description, is_public, holds } = crux
        setFields({ name, angle, grade: grade as Grade, description, is_public, holds })
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [editing, id, navigate])

  if (!fields) {
    return (
      <div className="page board-page">
        {error ? <p className="error-text">{error}</p> : <p className="status-text">{t('common.loading')}</p>}
      </div>
    )
  }

  const set = <K extends keyof BoardCruxFields>(key: K, value: BoardCruxFields[K]) =>
    setFields((current) => (current ? { ...current, [key]: value } : current))
  const issues = holdIssues(fields.holds)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setTriedSaving(true)
    if (issues.length) return
    setSaving(true)
    setError(null)
    try {
      const crux = editing ? await api.updateBoardCrux(Number(id), fields) : await api.createBoardCrux(fields)
      navigate(`/board/${crux.id}`, { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <div className="page board-page">
      <Link to={editing ? `/board/${id}` : '/board'} className="back-link">
        {t('board.back')}
      </Link>
      <div className="board-layout">
        <div className="board-stage">
          <header className="board-head">
            <div>
              <p className="board-head-grade">{gradeLabel(fields.grade)}</p>
              <p className="board-head-sub">
                <span className="board-angle-chip">{fields.angle}°</span>
              </p>
            </div>
            <div className="board-head-title">
              <h1>{editing ? t('board.editTitle') : t('board.setTitle')}</h1>
              <p>{t('board.tapHint')}</p>
            </div>
          </header>
          {layoutError && <p className="error-text">{layoutError}</p>}
          {layout && <KilterBoard layout={layout} holds={fields.holds} onChange={(holds) => set('holds', holds)} />}
        </div>

        <form className="board-side form form-panel" onSubmit={save}>
          <label className="field">
            <span className="field-label">{t('board.name')}</span>
            <input
              className="input"
              required
              maxLength={60}
              placeholder={t('board.namePlaceholder')}
              value={fields.name}
              onChange={(event) => set('name', event.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">{t('board.angle')}</span>
              <select value={fields.angle} onChange={(event) => set('angle', Number(event.target.value))}>
                {(layout?.angles ?? [fields.angle]).map((value) => (
                  <option key={value} value={value}>
                    {value}°
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('board.grade')}</span>
              <select value={fields.grade} onChange={(event) => set('grade', event.target.value as Grade)}>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {gradeLabel(grade)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field">
            <span className="field-label">{t('board.visibility')}</span>
            <Switch
              label={fields.is_public ? t('board.publicHint') : t('board.privateHint')}
              checked={fields.is_public}
              onChange={(checked) => set('is_public', checked)}
            />
          </div>
          <label className="field">
            <span className="field-label">{t('fields.description')}</span>
            <textarea
              maxLength={2000}
              placeholder={t('board.descriptionPlaceholder')}
              value={fields.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </label>

          <div className="field">
            <span className="field-label">{t('board.holds')}</span>
            <RoleLegend holds={fields.holds} />
          </div>

          {triedSaving &&
            issues.map((issue) => (
              <p key={issue} className="error-text" role="alert">
                {t(issue)}
              </p>
            ))}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            {fields.holds.length > 0 && (
              <button type="button" className="pill" onClick={() => set('holds', [])} disabled={saving}>
                {t('board.clear')}
              </button>
            )}
            <button type="submit" className="pill pill-primary" disabled={saving}>
              {saving ? t('common.saving') : t('board.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
