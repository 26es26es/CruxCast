import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  GRADE_STOPS,
  ratingToStars,
  STAR_STOPS,
  starsToRating,
  type MapFilters,
} from '../mapFilters'
import type { ClimbTag, GymMap } from '../types'
import { InfoTip, MultiSelect, RangeSlider, Switch, TriStateCheckbox } from './FilterControls'

type Props = {
  map: GymMap
  filters: MapFilters
  onChange: (filters: MapFilters) => void
}

function TagGrid({
  tags,
  selected,
  onToggle,
}: {
  tags: ClimbTag[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="tag-grid">
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className="tag-button"
          aria-pressed={selected.includes(tag.id)}
          aria-label={tag.name}
          title={tag.name}
          onClick={() => onToggle(tag.id)}
        >
          {tag.icon ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={tag.icon} fill="currentColor" />
            </svg>
          ) : (
            <span className="tag-text">{tag.name}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function DateRange({
  from,
  to,
  onChange,
}: {
  from: string | null
  to: string | null
  onChange: (from: string | null, to: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="date-range">
      <label>
        <span>{t('filters.from')}</span>
        <input type="date" className="input" value={from ?? ''} onChange={(e) => onChange(e.target.value || null, to)} />
      </label>
      <label>
        <span>{t('filters.to')}</span>
        <input type="date" className="input" value={to ?? ''} onChange={(e) => onChange(from, e.target.value || null)} />
      </label>
    </div>
  )
}

export function MapFilterPanel({ map, filters, onChange }: Props) {
  const { t } = useTranslation()
  const [openDates, setOpenDates] = useState<'new' | 'out' | null>(null)
  const set = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => onChange({ ...filters, [key]: value })
  const toggleIn = (key: 'holdColourIds' | 'styleIds' | 'holdIds', id: string) =>
    set(key, filters[key].includes(id) ? filters[key].filter((item) => item !== id) : [...filters[key], id])
  const count = activeFilterCount(filters)

  return (
    <div className="filter-panel">
      <div className="filter-head">
        <h3>
          {t('filters.title')}
          {count > 0 && <span className="filter-count">{count}</span>}
        </h3>
        <button type="button" className="pill" disabled={count === 0} onClick={() => onChange(DEFAULT_FILTERS)}>
          {t('filters.reset')}
        </button>
      </div>

      <section className="filter-section">
        <h4>{t('filters.grade')}</h4>
        <RangeSlider label={t('filters.grade')} stops={GRADE_STOPS} value={filters.grade} onChange={(v) => set('grade', v)} />
        <div className="filter-row">
          {(['soft', 'hard'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="pill"
              aria-pressed={filters.softHard === value}
              onClick={() => set('softHard', filters.softHard === value ? null : value)}
            >
              {t(`filters.${value}`)}
            </button>
          ))}
          <InfoTip text={t('filters.softHardInfo')} />
        </div>
      </section>

      <section className="filter-section">
        <h4>{t('filters.rating')}</h4>
        <RangeSlider
          label={t('filters.rating')}
          stops={STAR_STOPS}
          value={[ratingToStars(filters.rating[0]) - 1, ratingToStars(filters.rating[1]) - 1]}
          onChange={([low, high]) => set('rating', [starsToRating(low + 1), starsToRating(high + 1)])}
        />
      </section>

      <section className="filter-section">
        <h4>{t('filters.colours')}</h4>
        <div className="colour-circles">
          {map.hold_colours.map((colour) => (
            <button
              key={colour.id}
              type="button"
              className="colour-circle"
              style={{ background: colour.colour_hex ?? undefined }}
              aria-pressed={filters.holdColourIds.includes(colour.id)}
              aria-label={colour.name}
              title={colour.name}
              onClick={() => toggleIn('holdColourIds', colour.id)}
            />
          ))}
        </div>
      </section>

      {[
        { key: 'styleIds', notKey: 'stylesNot', tags: map.styles, title: t('filters.styles'), info: t('filters.stylesInfo') },
        { key: 'holdIds', notKey: 'holdsNot', tags: map.holds, title: t('filters.holds'), info: t('filters.holdsInfo') },
      ].map(({ key, notKey, tags, title, info }) =>
        tags.length ? (
          <section key={key} className="filter-section">
            <div className="filter-section-head">
              <h4>
                {title} <InfoTip text={info} />
              </h4>
              <Switch
                label={t('filters.not')}
                checked={filters[notKey as 'stylesNot']}
                onChange={(checked) => set(notKey as 'stylesNot', checked)}
              />
            </div>
            <TagGrid
              tags={tags}
              selected={filters[key as 'styleIds']}
              onToggle={(id) => toggleIn(key as 'styleIds', id)}
            />
          </section>
        ) : null,
      )}

      <section className="filter-section filter-selects">
        <MultiSelect label={t('filters.circuit')} options={map.circuits} value={filters.circuitIds} onChange={(v) => set('circuitIds', v)} />
        <MultiSelect label={t('filters.walls')} options={map.walls} value={filters.wallIds} onChange={(v) => set('wallIds', v)} />
        <MultiSelect label={t('filters.setters')} options={map.setters} value={filters.setterIds} onChange={(v) => set('setterIds', v)} />
      </section>

      <section className="filter-section filter-checks">
        <TriStateCheckbox label={t('filters.logged')} value={filters.logged} onChange={(v) => set('logged', v)} />
        <div className="filter-expandable">
          <TriStateCheckbox label={t('filters.new')} value={filters.isNew} onChange={(v) => set('isNew', v)} />
          <button
            type="button"
            className="expand-button"
            aria-expanded={openDates === 'new'}
            aria-label={t('filters.setDates')}
            onClick={() => setOpenDates(openDates === 'new' ? null : 'new')}
          >
            ⌄
          </button>
        </div>
        {openDates === 'new' && (
          <DateRange
            from={filters.inAtMin}
            to={filters.inAtMax}
            onChange={(from, to) => onChange({ ...filters, inAtMin: from, inAtMax: to })}
          />
        )}
        <div className="filter-expandable">
          <TriStateCheckbox label={t('filters.outSoon')} value={filters.outSoon} onChange={(v) => set('outSoon', v)} />
          <button
            type="button"
            className="expand-button"
            aria-expanded={openDates === 'out'}
            aria-label={t('filters.setDates')}
            onClick={() => setOpenDates(openDates === 'out' ? null : 'out')}
          >
            ⌄
          </button>
        </div>
        {openDates === 'out' && (
          <DateRange
            from={filters.outPlannedAtMin}
            to={filters.outPlannedAtMax}
            onChange={(from, to) => onChange({ ...filters, outPlannedAtMin: from, outPlannedAtMax: to })}
          />
        )}
        <TriStateCheckbox label={t('filters.shortFriendly')} value={filters.shortFriendly} onChange={(v) => set('shortFriendly', v)}>
          <span className="short-icon" aria-hidden="true">
            ⬍
          </span>
        </TriStateCheckbox>
      </section>
    </div>
  )
}
