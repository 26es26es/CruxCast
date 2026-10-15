import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { COLOUR_KEYS, COLOURS, GRADES, type Colour, type Grade } from '../constants'
import { errorMessage } from '../i18n'
import type { CruxFields } from '../types'
import { checkVideoFile, VideoDropZone } from './VideoDropZone'

type Props = {
  initial?: CruxFields
  submitLabel: string
  /** Shows the video picker; used when logging a new crux. */
  withVideo?: boolean
  /** Upload progress from 0 to 1 while the parent uploads the video. */
  uploadProgress?: number | null
  onSubmit: (fields: CruxFields, video: File | null) => Promise<void>
  onCancel: () => void
}

type Draft = Omit<CruxFields, 'colour' | 'gym_grade' | 'personal_grade'> & {
  colour: Colour | ''
  gym_grade: Grade | ''
  personal_grade: Grade | ''
}

const EMPTY: Draft = {
  climb_id: '',
  colour: '',
  area: '',
  gym_grade: '',
  personal_grade: '',
  description: '',
  experience: '',
  tips: '',
}

function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function CruxForm({ initial, submitLabel, withVideo, uploadProgress, onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft>(() =>
    initial ? { ...initial, personal_grade: initial.personal_grade ?? '' } : EMPTY,
  )
  const [video, setVideo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const pickVideo = (file: File) => {
    const problem = checkVideoFile(file)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setVideo(file)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // The required attributes on the selects guarantee these are filled in.
    if (!draft.colour || !draft.gym_grade) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(
        {
          ...draft,
          colour: draft.colour,
          gym_grade: draft.gym_grade,
          personal_grade: draft.personal_grade || null,
        },
        video,
      )
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  const gradeOptions = GRADES.map((grade) => (
    <option key={grade} value={grade}>
      {grade}
    </option>
  ))

  return (
    <form className="form form-panel" onSubmit={handleSubmit}>
      <div className="form-grid">
        <Field label={t('fields.climbId')} hint={t('fields.climbIdHint')}>
          <input
            className="input"
            required
            maxLength={50}
            value={draft.climb_id}
            onChange={(event) => set('climb_id', event.target.value)}
          />
        </Field>
        <Field
          label={
            <>
              {t('fields.colour')}
              {draft.colour && (
                <span
                  className="colour-dot"
                  style={{ display: 'inline-block', marginLeft: '0.5rem', background: COLOURS[draft.colour] }}
                />
              )}
            </>
          }
        >
          <select required value={draft.colour} onChange={(event) => set('colour', event.target.value as Colour)}>
            <option value="" disabled>
              {t('common.choose')}
            </option>
            {COLOUR_KEYS.map((colour) => (
              <option key={colour} value={colour}>
                {t(`colours.${colour}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('fields.area')}>
          <input
            className="input"
            required
            maxLength={100}
            placeholder={t('fields.areaPlaceholder')}
            value={draft.area}
            onChange={(event) => set('area', event.target.value)}
          />
        </Field>
        <Field label={t('fields.gymGrade')}>
          <select required value={draft.gym_grade} onChange={(event) => set('gym_grade', event.target.value as Grade)}>
            <option value="" disabled>
              {t('common.choose')}
            </option>
            {gradeOptions}
          </select>
        </Field>
        <Field label={t('fields.personalGrade')} hint={t('fields.personalGradeHint')}>
          <select
            value={draft.personal_grade}
            onChange={(event) => set('personal_grade', event.target.value as Grade | '')}
          >
            <option value="">{t('common.notSet')}</option>
            {gradeOptions}
          </select>
        </Field>
      </div>

      <Field label={t('fields.description')}>
        <textarea
          maxLength={5000}
          placeholder={t('fields.descriptionPlaceholder')}
          value={draft.description}
          onChange={(event) => set('description', event.target.value)}
        />
      </Field>
      <Field label={t('fields.experience')}>
        <textarea
          maxLength={5000}
          placeholder={t('fields.experiencePlaceholder')}
          value={draft.experience}
          onChange={(event) => set('experience', event.target.value)}
        />
      </Field>
      <Field label={t('fields.tips')}>
        <textarea
          maxLength={5000}
          placeholder={t('fields.tipsPlaceholder')}
          value={draft.tips}
          onChange={(event) => set('tips', event.target.value)}
        />
      </Field>

      {withVideo && (
        <div className="field">
          <span className="field-label">{t('fields.video')}</span>
          {video ? (
            <div className="file-chip">
              <span>{video.name}</span>
              <button type="button" className="pill" onClick={() => setVideo(null)} disabled={submitting}>
                {t('video.clear')}
              </button>
            </div>
          ) : (
            <VideoDropZone onFile={pickVideo} />
          )}
        </div>
      )}

      {uploadProgress != null && (
        <div className="field">
          <span className="field-hint">
            {t('video.uploading', { percent: Math.round(uploadProgress * 100) })}
          </span>
          <div className="progress">
            <span style={{ width: `${uploadProgress * 100}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="pill" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="pill pill-primary" disabled={submitting}>
          {submitting ? t('common.saving') : submitLabel}
        </button>
      </div>
    </form>
  )
}
