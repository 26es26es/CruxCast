import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GRADES, type Colour, type Grade } from '../constants'
import { errorMessage } from '../i18n'
import type { CruxFields, MapClimb } from '../types'
import { LocationSection } from './LocationSection'
import { checkVideoFile } from '../video'
import { VideoDropZone } from './VideoDropZone'

type Props = {
  initial?: CruxFields
  submitLabel: string
  /** Shows the video picker; used when logging a new crux. */
  withVideo?: boolean
  /** Upload progress from 0 to 1 while the parent uploads the video. */
  uploadProgress?: number | null
  onSubmit: (fields: CruxFields, video: File | null) => Promise<void>
  onCancel: () => void
  /** A climb from the gym map to start from (e.g. "Log this climb" on My Gym). */
  initialClimb?: MapClimb | null
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
  map_x: null,
  map_y: null,
  toplogger_climb_id: null,
}

/** Fills in what TopLogger knows about a climb picked on the map. */
function withClimb(draft: Draft, climb: MapClimb): Draft {
  return {
    ...draft,
    map_x: climb.x,
    map_y: climb.y,
    toplogger_climb_id: climb.id,
    colour: climb.colour,
    area: climb.wall_name ?? '',
    gym_grade: climb.grade ?? '',
  }
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

export function CruxForm({ initial, submitLabel, withVideo, uploadProgress, onSubmit, onCancel, initialClimb }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft>(() => {
    const start: Draft = initial
      ? { ...initial, gym_grade: initial.gym_grade ?? '', personal_grade: initial.personal_grade ?? '' }
      : EMPTY
    return initialClimb ? withClimb(start, initialClimb) : start
  })
  const [video, setVideo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const pickClimb = (climb: MapClimb) => {
    setError(null)
    setDraft((current) => withClimb(current, climb))
  }

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
    // The map pick identifies the climb; older cruxes may have a climb ID instead.
    if (!draft.colour || (draft.map_x == null && !draft.climb_id)) {
      setError(t('map.required'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(
        {
          ...draft,
          colour: draft.colour,
          gym_grade: draft.gym_grade || null,
          personal_grade: draft.personal_grade || null,
        },
        video,
      )
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <form className="form form-panel" onSubmit={handleSubmit}>
      <LocationSection location={draft} onPick={pickClimb} />

      <div className="form-grid">
        <Field label={t('fields.personalGrade')} hint={t('fields.personalGradeHint')}>
          <select
            value={draft.personal_grade}
            onChange={(event) => set('personal_grade', event.target.value as Grade | '')}
          >
            <option value="">{t('common.notSet')}</option>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
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
