import { useTranslation } from 'react-i18next'
import { FloatTitle } from '../components/FloatTitle'

// Placeholder for the move-prediction feature, which isn't built yet.
export function CoachPage() {
  const { t } = useTranslation()
  const steps = [1, 2, 3] as const

  return (
    <div className="page">
      <div className="page-head">
        <p className="section-kicker">{t('coach.kicker')}</p>
        <FloatTitle text={t('coach.title')} />
        <p className="page-lede">{t('coach.lede')}</p>
      </div>
      <ol className="coming-soon" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {steps.map((step) => (
          <li key={step} className="card">
            <span className="card-meta">0{step}</span>
            <h2 className="card-title">{t(`coach.step${step}Title`)}</h2>
            <p className="card-summary">{t(`coach.step${step}Body`)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
