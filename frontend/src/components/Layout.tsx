import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth'
import { LANGUAGES } from '../i18n'
import { useTheme } from '../theme'
import { ClimbingBackground } from './ClimbingBackground'
import { MoonIcon, SunIcon } from './icons'

const YEAR = new Date().getFullYear()

const BACKGROUND_LOOK = {
  dark: { color: '#f4f4f5', accent: '#feb3ff', opacity: 0.1 },
  light: { color: '#0a0a0b', accent: '#c026d3', opacity: 0.08 },
}

function LanguageToggle() {
  const { t, i18n } = useTranslation()
  return (
    <div className="segmented" role="group" aria-label={t('nav.language')}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          aria-pressed={i18n.resolvedLanguage === language}
          onClick={() => i18n.changeLanguage(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? t('nav.toLight') : t('nav.toDark')
  return (
    <button type="button" className="pill pill-icon" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <div className="site-background" aria-hidden="true">
        <ClimbingBackground {...BACKGROUND_LOOK[theme]} />
      </div>

      <header className="site-nav">
        <Link to="/" className="site-nav-brand">
          <span className="site-nav-brand-mark" />
          CruxCast
        </Link>
        {user && (
          <nav className="site-nav-links" aria-label={t('nav.main')}>
            <NavLink to="/cruxes">{t('nav.logCruxes')}</NavLink>
            <NavLink to="/gym">{t('nav.myGym')}</NavLink>
            <NavLink to="/coach">{t('nav.coach')}</NavLink>
          </nav>
        )}
        <div className="site-nav-tools">
          {user && <span className="site-nav-user">@{user.username}</span>}
          <LanguageToggle />
          <ThemeToggle />
          {user && (
            <button type="button" className="pill" onClick={logout}>
              {t('nav.logout')}
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>© {YEAR} CruxCast</span>
        <span>{t('footer.tagline')}</span>
      </footer>
    </div>
  )
}
