import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth'
import { FloatTitle } from '../components/FloatTitle'
import { errorMessage } from '../i18n'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login, register } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/cruxes'} replace />
  }

  const isLogin = mode === 'login'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await (isLogin ? login : register)(username.trim(), password)
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode(isLogin ? 'register' : 'login')
    setError(null)
  }

  return (
    <div className="page page-narrow auth-page">
      <div className="page-head">
        <p className="section-kicker">{t('auth.kicker')}</p>
        <FloatTitle text={isLogin ? t('auth.loginTitle') : t('auth.registerTitle')} />
        <p className="page-lede">{isLogin ? t('auth.loginLede') : t('auth.registerLede')}</p>
      </div>

      <form className="form form-panel" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">{t('auth.username')}</span>
          <input
            className="input"
            required
            autoComplete="username"
            {...(isLogin ? {} : { minLength: 3, maxLength: 30, pattern: '[A-Za-z0-9_]+' })}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          {!isLogin && <span className="field-hint">{t('auth.usernameHint')}</span>}
        </label>
        <label className="field">
          <span className="field-label">{t('auth.password')}</span>
          <input
            className="input"
            type="password"
            required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            {...(isLogin ? {} : { minLength: 8, maxLength: 128 })}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {!isLogin && <span className="field-hint">{t('auth.passwordHint')}</span>}
        </label>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="pill pill-primary" disabled={submitting}>
          {isLogin ? t('auth.login') : t('auth.register')}
        </button>
      </form>

      <p className="auth-switch">
        {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
        <button type="button" className="link-button" onClick={switchMode}>
          {isLogin ? t('auth.toRegister') : t('auth.toLogin')}
        </button>
      </p>
    </div>
  )
}
