import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../auth'
import { FloatTitle } from '../components/FloatTitle'

// The loop CruxCast is built around, in order, with the tab each step lives in.
const STEPS = [
  { key: 'log', to: '/cruxes' },
  { key: 'plan', to: '/training' },
  { key: 'board', to: '/board' },
  { key: 'coach', to: '/coach' },
] as const

export function LandingPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="page landing">
      <section className="landing-hero">
        <p className="section-kicker">{t('landing.kicker')}</p>
        <FloatTitle text={t('landing.title')} />
        <p className="page-lede">{t('landing.lede')}</p>
        <div className="landing-actions">
          {user ? (
            <Link to="/cruxes" className="pill pill-primary">
              {t('landing.openLogbook')}
            </Link>
          ) : (
            <>
              <Link to="/login?mode=register" className="pill pill-primary">
                {t('landing.signUp')}
              </Link>
              <Link to="/login" className="pill">
                {t('landing.logIn')}
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="landing-why">
        <h2 className="section-kicker">{t('landing.whyTitle')}</h2>
        <p>{t('landing.why')}</p>
      </section>

      <section>
        <h2 className="section-kicker">{t('landing.loopTitle')}</h2>
        <ol className="landing-loop">
          {STEPS.map((step, index) => (
            <li key={step.key}>
              <Link to={user ? step.to : '/login?mode=register'} className="card card-link landing-step">
                <span className="landing-step-number">0{index + 1}</span>
                <h3 className="card-title">{t(`landing.steps.${step.key}.title`)}</h3>
                <p className="card-summary">{t(`landing.steps.${step.key}.body`)}</p>
                {step.key === 'coach' && <span className="badge landing-soon">{t('landing.comingSoon')}</span>}
              </Link>
            </li>
          ))}
        </ol>
        <p className="landing-loop-note">{t('landing.loopNote')}</p>
      </section>
    </div>
  )
}
