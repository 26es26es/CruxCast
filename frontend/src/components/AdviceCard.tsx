import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMinutes, TYPE_COLOURS } from '../training'
import type { Advice, AdviceStep, SessionType } from '../types'

type Props = {
  advice: Advice
  /** Called when the climber picks one of the suggested lighter session types. */
  onSwitchType?: (type: SessionType) => void
}

function StepList({ title, steps }: { title: string; steps: AdviceStep[] }) {
  const { t } = useTranslation()
  if (!steps.length) return null
  const total = steps.reduce((sum, step) => sum + step.minutes, 0)
  return (
    <section className="advice-part">
      <h3>
        {title} <span>{formatMinutes(total)}</span>
      </h3>
      <ol>
        {steps.map((step, index) => (
          <li key={`${step.key}-${index}`}>
            <span className="advice-minutes">{step.minutes}′</span>
            <span>
              <strong>{t(`training.steps.${step.key}.title`)}</strong>
              <span className="advice-detail">
                {t(`training.steps.${step.key}.detail`, { rest: step.params.rest ?? 3 })}
                {step.params.grades && ` ${t('training.steps.gradesNote', { grades: step.params.grades })}`}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** "yesterday", "3 days ago", ... */
function useWhen() {
  const { t } = useTranslation()
  return (days: number) =>
    days <= 0 ? t('training.daysAgo.today') : days === 1 ? t('training.daysAgo.yesterday') : t('training.daysAgo.days', { count: days })
}

export function AdviceCard({ advice, onSwitchType }: Props) {
  const { t } = useTranslation()
  const when = useWhen()

  return (
    <div className="advice-card" style={{ '--type-colour': TYPE_COLOURS[advice.session_type] } as CSSProperties}>
      <div className="advice-head">
        <div>
          <p className="advice-total">{formatMinutes(advice.total_minutes)}</p>
          <p className="advice-type">{t(`training.types.${advice.session_type}`)}</p>
        </div>
        <span className={`badge intensity-${advice.intensity}`}>{t(`training.intensity.${advice.intensity}`)}</span>
      </div>

      {advice.suggest_instead.length > 0 && (
        <div className="advice-suggest" role="note">
          <span>{t('training.suggestTitle')}</span>
          <div className="advice-suggest-options">
            {advice.suggest_instead.map((type) =>
              onSwitchType ? (
                <button key={type} type="button" className="pill" onClick={() => onSwitchType(type)}>
                  {t(`training.types.${type}`)}
                </button>
              ) : (
                <span key={type} className="badge">
                  {t(`training.types.${type}`)}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      <div className="advice-parts">
        <StepList title={t('training.warmUp')} steps={advice.warm_up} />
        <StepList title={t('training.main')} steps={advice.main} />
        <StepList title={t('training.coolDown')} steps={advice.cool_down} />
      </div>

      {advice.reasons.length > 0 && (
        <div className="advice-reasons">
          <h3>{t('training.why')}</h3>
          <ul>
            {advice.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>
                {t(`training.reasons.${reason.code}`, {
                  ...reason.params,
                  type: reason.params.type ? t(`training.types.${reason.params.type}`) : '',
                  when: typeof reason.params.days === 'number' ? when(reason.params.days) : '',
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
