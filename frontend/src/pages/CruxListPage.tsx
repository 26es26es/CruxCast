import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../api'
import { CruxCard } from '../components/CruxCard'
import { FloatTitle } from '../components/FloatTitle'
import { errorMessage } from '../i18n'
import type { Crux } from '../types'

type Filter = 'all' | 'favorites'

export function CruxListPage() {
  const { t } = useTranslation()
  const [cruxes, setCruxes] = useState<Crux[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api
      .listCruxes()
      .then(setCruxes)
      .catch((caught) => setError(errorMessage(caught)))
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (cruxes ?? []).filter((crux) => {
      if (filter === 'favorites' && !crux.is_favorite) return false
      if (!needle) return true
      return [crux.climb_id, crux.area, crux.description, crux.experience, crux.tips, t(`colours.${crux.colour}`)]
        .some((text) => text.toLowerCase().includes(needle))
    })
  }, [cruxes, filter, query, t])

  const toggleFavorite = async (crux: Crux) => {
    const flip = (target: boolean) =>
      setCruxes((current) =>
        current?.map((item) => (item.id === crux.id ? { ...item, is_favorite: target } : item)) ?? null,
      )
    // Update the star right away and roll back if the save fails.
    flip(!crux.is_favorite)
    try {
      await api.updateCrux(crux.id, { is_favorite: !crux.is_favorite })
    } catch (caught) {
      flip(crux.is_favorite)
      setError(errorMessage(caught))
    }
  }

  const renderBody = () => {
    if (cruxes === null) {
      return !error && <p className="status-text">{t('common.loading')}</p>
    }
    if (visible.length > 0) {
      return (
        <ul className="card-grid">
          {visible.map((crux) => (
            <CruxCard key={crux.id} crux={crux} onToggleFavorite={toggleFavorite} />
          ))}
        </ul>
      )
    }
    if (query.trim()) {
      return <p className="status-text">{t('cruxes.noMatches')}</p>
    }
    const favoritesView = filter === 'favorites' && cruxes.length > 0
    return (
      <div className="empty-state">
        <h2>{favoritesView ? t('cruxes.emptyFavoritesTitle') : t('cruxes.emptyTitle')}</h2>
        <p>{favoritesView ? t('cruxes.emptyFavoritesBody') : t('cruxes.emptyBody')}</p>
        {!favoritesView && (
          <Link to="/cruxes/new" className="pill pill-primary">
            + {t('cruxes.new')}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <p className="section-kicker">{t('cruxes.kicker')}</p>
          <FloatTitle text={t('cruxes.title')} />
          <p className="page-lede">{t('cruxes.lede')}</p>
        </div>
        <Link to="/cruxes/new" className="pill pill-primary">
          + {t('cruxes.new')}
        </Link>
      </div>

      {cruxes && cruxes.length > 0 && (
        <div className="toolbar">
          <input
            type="search"
            className="input search-input"
            placeholder={t('cruxes.search')}
            aria-label={t('cruxes.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="status-text" style={{ fontSize: '0.875rem' }}>
              {t('cruxes.count', { count: visible.length })}
            </span>
            <div className="segmented" role="group" aria-label={t('cruxes.filter')}>
              {(['all', 'favorites'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {t(`cruxes.${value}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="error-text" role="alert" style={{ marginBottom: '1rem' }}>
          {error}
        </p>
      )}
      {renderBody()}
    </div>
  )
}
