import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { api, ApiError } from '../api'
import { CruxForm } from '../components/CruxForm'
import { FloatTitle } from '../components/FloatTitle'
import { useGymMap } from '../gymMap'
import type { CruxFields } from '../types'

export function CruxNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  // Set by "Log this climb" on the My Gym page.
  const climbId = (location.state as { climbId?: string } | null)?.climbId ?? null
  const { map, error: mapError } = useGymMap()
  const initialClimb = climbId ? map?.climbs.find((climb) => climb.id === climbId) : undefined
  // Wait for the map so the form can start from that climb.
  const waitingForMap = climbId !== null && !map && !mapError
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const create = async (fields: CruxFields, video: File | null) => {
    const crux = await api.createCrux(fields)
    let videoError: string | null = null
    if (video) {
      setUploadProgress(0)
      try {
        await api.uploadVideo(crux.id, video, setUploadProgress)
      } catch (caught) {
        // The crux is saved; the detail page shows the error and offers a retry.
        videoError = caught instanceof ApiError ? caught.code : 'unknown'
      }
    }
    navigate(`/cruxes/${crux.id}`, { replace: true, state: { videoError } })
  }

  return (
    <div className="page page-narrow">
      <Link to="/cruxes" className="back-link">
        {t('detail.back')}
      </Link>
      <div className="page-head">
        <p className="section-kicker">{t('form.newKicker')}</p>
        <FloatTitle text={t('form.newTitle')} />
      </div>
      {waitingForMap ? (
        <p className="status-text">{t('map.loading')}</p>
      ) : (
        <CruxForm
          submitLabel={t('form.create')}
          withVideo
          initialClimb={initialClimb}
          uploadProgress={uploadProgress}
          onSubmit={create}
          onCancel={() => navigate('/cruxes')}
        />
      )}
    </div>
  )
}
