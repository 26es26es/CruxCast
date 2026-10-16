import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { CruxMeta, GradeChips } from '../components/CruxBits'
import { CruxForm } from '../components/CruxForm'
import { FavoriteButton } from '../components/FavoriteButton'
import { FloatTitle } from '../components/FloatTitle'
import { GymMapView } from '../components/GymMapView'
import { VideoPanel } from '../components/VideoPanel'
import { COLOURS } from '../constants'
import { useCruxTitle } from '../cruxTitle'
import { useGymMap } from '../gymMap'
import i18n, { errorMessage } from '../i18n'
import type { Crux, CruxFields } from '../types'

/** The crux's pin on the gym floor plan, if it has a position. */
function CruxMapSection({ crux }: { crux: Crux }) {
  const { t } = useTranslation()
  const { map } = useGymMap()
  if (crux.map_x == null || crux.map_y == null || !map) return null
  return (
    <section className="video-section">
      <h2 className="section-kicker">{t('map.detailTitle')}</h2>
      <GymMapView
        map={map}
        maxHeight="420px"
        pin={{ x: crux.map_x, y: crux.map_y, colour: COLOURS[crux.colour], label: t('map.yourCrux') }}
      />
    </section>
  )
}

export function CruxDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [crux, setCrux] = useState<Crux | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const title = useCruxTitle()

  // Set by the new-crux page when the video upload failed after saving.
  const [initialVideoError] = useState(() => {
    const code = (location.state as { videoError?: string | null } | null)?.videoError
    return code ? errorMessage(code) : null
  })

  useEffect(() => {
    // Clear it from history so a reload doesn't show the error again.
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    api
      .getCrux(Number(id))
      .then(setCrux)
      .catch((caught) => setLoadError(errorMessage(caught)))
  }, [id])

  if (loadError || !crux) {
    return (
      <div className="page page-narrow">
        <Link to="/cruxes" className="back-link">
          {t('detail.back')}
        </Link>
        {loadError ? <p className="error-text">{loadError}</p> : <p className="status-text">{t('common.loading')}</p>}
      </div>
    )
  }

  const save = async (fields: CruxFields) => {
    setCrux(await api.updateCrux(crux.id, fields))
    setEditing(false)
  }

  const toggleFavorite = async () => {
    setActionError(null)
    try {
      setCrux(await api.updateCrux(crux.id, { is_favorite: !crux.is_favorite }))
    } catch (caught) {
      setActionError(errorMessage(caught))
    }
  }

  const remove = async () => {
    if (!confirm(t('detail.confirmDelete'))) return
    try {
      await api.deleteCrux(crux.id)
      navigate('/cruxes', { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught))
    }
  }

  if (editing) {
    return (
      <div className="page page-narrow">
        <button type="button" className="back-link link-button" style={{ border: 0 }} onClick={() => setEditing(false)}>
          ← {title(crux)}
        </button>
        <div className="page-head">
          <p className="section-kicker">{title(crux)}</p>
          <FloatTitle text={t('form.editTitle')} />
        </div>
        <CruxForm initial={crux} submitLabel={t('common.save')} onSubmit={save} onCancel={() => setEditing(false)} />
      </div>
    )
  }

  const logged = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(crux.created_at))
  const notes: [string, string][] = [
    [t('fields.description'), crux.description],
    [t('fields.experience'), crux.experience],
    [t('fields.tips'), crux.tips],
  ]

  return (
    <div className="page page-narrow">
      <Link to="/cruxes" className="back-link">
        {t('detail.back')}
      </Link>

      <div className="page-head">
        <CruxMeta crux={crux} className="section-kicker" />
        <div className="detail-head">
          <FloatTitle text={title(crux)} />
          <FavoriteButton active={crux.is_favorite} onToggle={toggleFavorite} />
        </div>
        <GradeChips crux={crux} />
        <div className="detail-actions">
          <button type="button" className="pill" onClick={() => setEditing(true)}>
            {t('detail.edit')}
          </button>
          <button type="button" className="pill pill-danger" onClick={remove}>
            {t('detail.delete')}
          </button>
        </div>
        {actionError && (
          <p className="error-text" role="alert" style={{ marginTop: '1rem' }}>
            {actionError}
          </p>
        )}
      </div>

      <dl className="detail-list">
        {notes.map(([label, text]) => (
          <div key={label} className="detail-row">
            <dt>{label}</dt>
            <dd className={text ? undefined : 'is-empty'}>{text || t('detail.empty')}</dd>
          </div>
        ))}
      </dl>

      <CruxMapSection crux={crux} />

      <VideoPanel crux={crux} onChange={setCrux} initialError={initialVideoError} />

      <p className="status-text" style={{ marginTop: '2.5rem', fontSize: '0.875rem' }}>
        {t('detail.logged', { date: logged })}
      </p>
    </div>
  )
}
