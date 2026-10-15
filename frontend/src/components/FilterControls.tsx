import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { nextTriState, type TriState } from '../mapFilters'

/** Two-thumb slider over a list of labelled stops, with a value bubble per thumb. */
export function RangeSlider({
  label,
  stops,
  value,
  onChange,
}: {
  label: string
  stops: readonly (string | number)[]
  value: [number, number]
  onChange: (value: [number, number]) => void
}) {
  const max = stops.length - 1
  const [low, high] = value
  const percent = (index: number) => (index / max) * 100

  return (
    <div className="range" role="group" aria-label={label}>
      <div className="range-track">
        <span className="range-fill" style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }} />
        {[low, high].map((index, which) => (
          <span key={which} className="range-bubble" style={{ left: `${percent(index)}%` }} aria-hidden="true">
            {stops[index]}
          </span>
        ))}
        <input
          type="range"
          min={0}
          max={max}
          value={low}
          // When both thumbs sit at the far end, keep the low one grabbable.
          style={low === max ? { zIndex: 2 } : undefined}
          aria-label={`${label}: min`}
          aria-valuetext={String(stops[low])}
          onChange={(event) => onChange([Math.min(Number(event.target.value), high), high])}
        />
        <input
          type="range"
          min={0}
          max={max}
          value={high}
          aria-label={`${label}: max`}
          aria-valuetext={String(stops[high])}
          onChange={(event) => onChange([low, Math.max(Number(event.target.value), low)])}
        />
      </div>
    </div>
  )
}

/** Off → ✓ (must be) → ⊟ (must not be) → off, like TopLogger's checkboxes. */
export function TriStateCheckbox({
  label,
  value,
  onChange,
  children,
}: {
  label: ReactNode
  value: TriState
  onChange: (value: TriState) => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const stateLabel = value === true ? t('filters.stateYes') : value === false ? t('filters.stateNot') : t('filters.stateOff')
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value === true ? 'true' : value === false ? 'mixed' : 'false'}
      className="tristate"
      title={stateLabel}
      onClick={() => onChange(nextTriState(value))}
    >
      <span className={`tristate-box tristate-${value === true ? 'yes' : value === false ? 'not' : 'off'}`} aria-hidden="true">
        {value === true ? '✓' : value === false ? '–' : ''}
      </span>
      <span className="tristate-label">{label}</span>
      {children}
      <span className="visually-hidden">({stateLabel})</span>
    </button>
  )
}

/** Dropdown with a checkbox per option; shows the chosen ones as chips. */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; name: string }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return
        // Close just this dropdown, not the dialog around it.
        event.preventDefault()
        setOpen(false)
      } else if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const chosen = options.filter((option) => value.includes(option.id))
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])

  return (
    <div className="multiselect" ref={rootRef}>
      <button
        type="button"
        className={`multiselect-button${chosen.length ? ' has-value' : ''}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
      >
        {chosen.length ? (
          <span className="multiselect-chips">
            {chosen.map((option) => (
              <span key={option.id} className="multiselect-chip">
                {option.name}
              </span>
            ))}
          </span>
        ) : (
          <span className="multiselect-placeholder">{label}</span>
        )}
        <span className="multiselect-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul id={listId} className="multiselect-list" aria-label={label}>
          {options.map((option) => (
            <li key={option.id}>
              <label className="multiselect-option">
                <input type="checkbox" checked={value.includes(option.id)} onChange={() => toggle(option.id)} />
                {option.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** An on/off switch with a label to its right, like TopLogger's "Not". */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      {label}
    </button>
  )
}

/** An "i" button that shows a short explanation. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={text} title={text}>
      i
    </span>
  )
}
