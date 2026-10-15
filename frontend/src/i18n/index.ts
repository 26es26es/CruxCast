import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ApiError } from '../api'
import { MAX_VIDEO_MB } from '../constants'
import en from './en'
import nl from './nl'

export const LANGUAGES = ['en', 'nl'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'cruxcast.lang'

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'nl') return saved
  } catch {
    // Storage can be unavailable (private mode); fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, nl: { translation: nl } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not persisting the choice is fine.
  }
})

/** Translates a thrown error, or a backend error code, into a message for the person using the app. */
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : typeof error === 'string' ? error : 'unknown'
  return i18n.t(`errors.${code}`, {
    max: MAX_VIDEO_MB,
    defaultValue: i18n.t('errors.unknown'),
  })
}

export default i18n
