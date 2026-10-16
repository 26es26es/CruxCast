import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { errorMessage } from '../i18n'
import type { Crux } from '../types'
import { checkVideoFile } from '../video'
import { VideoDropZone } from './VideoDropZone'

type Props = {
  crux: Crux
  onChange: (crux: Crux) => void
  initialError?: string | null
}

export function VideoPanel({ crux, onChange, initialError = null }: Props) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(initialError)
  // Bumped after an upload so the <video> element reloads the new file.
  const [version, setVersion] = useState(0)
  const replaceInput = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    const problem = checkVideoFile(file)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setProgress(0)
    try {
      onChange(await api.uploadVideo(crux.id, file, setProgress))
      setVersion((current) => current + 1)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setProgress(null)
    }
  }

  const remove = async () => {
    if (!confirm(t('video.confirmRemove'))) return
    setError(null)
    try {
      onChange(await api.deleteVideo(crux.id))
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <section className="video-section">
      <h2 className="section-kicker">{t('fields.video')}</h2>

      {progress != null ? (
        <div className="field">
          <span className="field-hint">{t('video.uploading', { percent: Math.round(progress * 100) })}</span>
          <div className="progress">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      ) : crux.has_video ? (
        <>
          <video key={version} className="video-frame" src={api.videoUrl(crux.id)} controls preload="metadata" />
          <div className="video-toolbar">
            <button type="button" className="pill" onClick={() => replaceInput.current?.click()}>
              {t('video.replace')}
            </button>
            <button type="button" className="pill pill-danger" onClick={remove}>
              {t('video.remove')}
            </button>
            <input
              ref={replaceInput}
              type="file"
              accept="video/*"
              className="visually-hidden"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload(file)
                event.target.value = ''
              }}
            />
          </div>
        </>
      ) : (
        <VideoDropZone onFile={upload} />
      )}

      {error && (
        <p className="error-text" role="alert" style={{ marginTop: '0.9rem' }}>
          {error}
        </p>
      )}
    </section>
  )
}
