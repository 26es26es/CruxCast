import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { ROLE_COLOURS, ROLES } from '../board'
import { COLOURS } from '../constants'
import { Switch } from '../components/FilterControls'
import { FloatTitle } from '../components/FloatTitle'
import { RoleLegend } from '../components/RoleLegend'
import { ColourPicker, HoldTypeToggles, WallFields } from '../components/RouteOptions'
import { HoldList } from '../components/HoldList'
import { RouteWall } from '../components/RouteWall'
import { useGymMap } from '../gymMap'
import { errorMessage } from '../i18n'
import { shapeCount, shapeName, shapeOf, withFixedShapes } from '../holdShapes'
import {
  DEFAULT_ANGLES,
  DEFAULT_SIZE,
  HOLD_TYPES,
  routeIssues,
  turned,
  withSingleTop,
  SIZES,
  STYLES,
  type HoldSize,
  type HoldType,
  type RouteHold,
  type RouteTemplateInput,
  type Style,
} from '../setting'
import type { HoldRole } from '../types'

const EMPTY: RouteTemplateInput = {
  name: '',
  wall_type: 'vertical',
  angle: 0,
  gym_wall: null,
  grade: '6A',
  styles: [],
  colour: 'purple',
  description: '',
  inspired_by: null,
  inspired_by_url: null,
  is_public: false,
  holds: [],
}

const MAX_STYLES = 4

/** Create (/setting/new, optionally from a draft) or edit (/setting/:id/edit) a template. */
export function SettingEditorPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { map } = useGymMap()
  const editing = id !== undefined
  const [draft, setDraft] = useState<RouteTemplateInput | null>(() => {
    if (editing) return null
    const start = (location.state as { draft?: RouteTemplateInput } | null)?.draft ?? EMPTY
    return { ...start, holds: withFixedShapes(start.holds) }
  })
  const [selected, setSelected] = useState<number | null>(null)
  const [palette, setPalette] = useState<{ type: HoldType; role: HoldRole }>({ type: 'jug', role: 'hand' })
  const [showRoles, setShowRoles] = useState(true)
  const [showOthers, setShowOthers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triedSaving, setTriedSaving] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) return
    api
      .getTemplate(Number(id))
      .then((template) => {
        if (!template.is_mine) {
          navigate(`/setting/${template.id}`, { replace: true })
          return
        }
        const { name, wall_type, angle, gym_wall, grade, styles, colour, description, inspired_by, inspired_by_url, is_public, holds } = template
        setDraft({ name, wall_type, angle, gym_wall, grade, styles, colour, description, inspired_by, inspired_by_url, is_public, holds: withFixedShapes(holds) })
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [editing, id, navigate])

  // With a hold selected: Delete removes it, R turns it clockwise (Shift+R anticlockwise),
  // unless you're typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement).closest('input, textarea, select')
      if (selected === null || typing) return
      if (event.key === 'Escape') {
        setSelected(null)
        return
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault()
        const by = event.shiftKey ? -15 : 15
        setDraft((current) =>
          current ? { ...current, holds: current.holds.map((hold, i) => (i === selected ? { ...hold, rotation: turned(hold.rotation, by) } : hold)) } : current,
        )
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      setDraft((current) => (current ? { ...current, holds: current.holds.filter((_, i) => i !== selected) } : current))
      setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  // Clicking anywhere outside the wall and the selected hold's controls lets go of the hold.
  useEffect(() => {
    if (selected === null) return
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.route-wall-frame, .hold-editor')) setSelected(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [selected])

  if (!draft) {
    return <div className="page">{error ? <p className="error-text">{error}</p> : <p className="status-text">{t('common.loading')}</p>}</div>
  }

  const set = (changes: Partial<RouteTemplateInput>) => setDraft((current) => (current ? { ...current, ...changes } : current))
  const setHold = (index: number, changes: Partial<RouteHold>) => {
    const holds = draft.holds.map((hold, i) => (i === index ? { ...hold, ...changes } : hold))
    // Only one top: making a hold the top turns the old top into a hand hold.
    set({ holds: changes.role === 'finish' ? withSingleTop(holds, index) : holds })
  }
  const hold = selected !== null ? draft.holds[selected] : null
  const issues = routeIssues(draft.holds)

  const addHold = (x: number, y: number) => {
    // With a hold selected, a click on the empty wall just lets go of it; the next click places one.
    if (selected !== null) {
      setSelected(null)
      return
    }
    const newHold: RouteHold = {
      x, y,
      type: palette.type,
      size: palette.role === 'foot' && palette.type !== 'volume' ? 'xs' : DEFAULT_SIZE[palette.type],
      rotation: palette.type === 'undercling' ? 180 : 0,
      role: palette.role,
    }
    // The shape is chosen once, where it's placed, and then kept wherever the hold is moved.
    newHold.variant = shapeOf(newHold)
    const holds = [...draft.holds, newHold]
    set({ holds: newHold.role === 'finish' ? withSingleTop(holds, holds.length - 1) : holds })
    setSelected(draft.holds.length)
  }

  const toggleStyle = (style: Style) =>
    set({
      styles: draft.styles.includes(style)
        ? draft.styles.filter((s) => s !== style)
        : draft.styles.length < MAX_STYLES ? [...draft.styles, style] : draft.styles,
    })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setTriedSaving(true)
    if (issues.length) return
    setSaving(true)
    setError(null)
    try {
      const saved = editing ? await api.replaceTemplate(Number(id), draft) : await api.createTemplate(draft)
      navigate(`/setting/${saved.id}`, { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  return (
    <div className="page board-page">
      <Link to={editing ? `/setting/${id}` : '/setting'} className="back-link">
        {t('setting.back')}
      </Link>
      <div className="page-head">
        <p className="section-kicker">{t('setting.kicker')}</p>
        <FloatTitle text={editing ? t('setting.editTitle') : t('setting.newTitle')} />
        <p className="page-lede">{t('setting.editorHint')}</p>
      </div>

      <div className="board-layout">
        <div className="route-stage">
          <div className="setter-palette">
            <HoldTypeToggles selected={[palette.type]} onToggle={(type) => setPalette({ ...palette, type })} />
            <div className="type-picker" role="group" aria-label={t('setting.role')}>
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className="pill"
                  aria-pressed={palette.role === role}
                  onClick={() => setPalette({ ...palette, role })}
                >
                  <span className="role-ring" style={{ borderColor: ROLE_COLOURS[role] }} />
                  {t(`board.roles.${role}`)}
                </button>
              ))}
            </div>
          </div>
          <RouteWall
            wallType={draft.wall_type}
            angle={draft.angle}
            colour={COLOURS[draft.colour]}
            holds={draft.holds}
            selected={selected}
            showRoles={showRoles}
            showOtherHolds={showOthers}
            onWallClick={addHold}
            onHoldClick={(index) => setSelected(index === selected ? null : index)}
            onHoldMove={(index, x, y, riders = []) => {
              setSelected(index)
              const moved = new Map([[index, { x, y }], ...riders.map((rider): [number, { x: number; y: number }] => [rider.index, { x: rider.x, y: rider.y }])])
              set({ holds: draft.holds.map((hold, i) => ({ ...hold, ...moved.get(i) })) })
            }}
            onHoldRotate={(index, rotation) => setHold(index, { rotation })}
          />
          {hold && selected !== null && (
            <div className="hold-editor" aria-label={t('setting.selectedHold')}>
              <select aria-label={t('setting.holdType')} value={hold.type} onChange={(e) => setHold(selected, { type: e.target.value as HoldType })}>
                {HOLD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`setting.holds.${type}`)}
                  </option>
                ))}
              </select>
              <select aria-label={t('setting.size')} value={hold.size} onChange={(e) => setHold(selected, { size: e.target.value as HoldSize })}>
                {SIZES.map((size) => (
                  <option key={size} value={size}>
                    {t(`setting.sizes.${size}`)}
                  </option>
                ))}
              </select>
              <select aria-label={t('setting.role')} value={hold.role} onChange={(e) => setHold(selected, { role: e.target.value as HoldRole })}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`board.roles.${role}`)}
                  </option>
                ))}
              </select>
              <select aria-label={t('setting.shape')} value={shapeOf(hold)} onChange={(e) => setHold(selected, { variant: Number(e.target.value) })}>
                {Array.from({ length: shapeCount(hold.type) }, (_, n) => (
                  <option key={n} value={n}>
                    {hold.type === 'volume' ? t(`setting.volumes.${shapeName('volume', n)}`) : t(`setting.shapes.${shapeName(hold.type, n)}`)}
                  </option>
                ))}
              </select>
              <div className="rotation-control">
                <span className="field-label">{t('setting.rotation')}</span>
                <button type="button" className="pill pill-icon" aria-label={t('setting.rotateLeft')} title={t('setting.rotateLeft')} onClick={() => setHold(selected, { rotation: turned(hold.rotation, -15) })}>
                  ⟲
                </button>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={hold.rotation}
                  aria-label={t('setting.rotation')}
                  onChange={(e) => setHold(selected, { rotation: Number(e.target.value) })}
                />
                <button type="button" className="pill pill-icon" aria-label={t('setting.rotateRight')} title={t('setting.rotateRight')} onClick={() => setHold(selected, { rotation: turned(hold.rotation, 15) })}>
                  ⟳
                </button>
                <output>{hold.rotation}°</output>
              </div>
              <button
                type="button"
                className="pill pill-danger"
                onClick={() => {
                  set({ holds: draft.holds.filter((_, i) => i !== selected) })
                  setSelected(null)
                }}
              >
                {t('setting.removeHold')}
              </button>
              <p className="hold-editor-hint">{t('setting.rotateHint')}</p>
            </div>
          )}
          <div className="wall-options">
            <RoleLegend holds={draft.holds.map((h, i) => ({ id: i, role: h.role }))} />
            <Switch label={t('setting.showRoles')} checked={showRoles} onChange={setShowRoles} />
            <Switch label={t('setting.showOtherHolds')} checked={showOthers} onChange={setShowOthers} />
          </div>
          <HoldList holds={draft.holds} />
        </div>

        <form className="board-side form form-panel" onSubmit={save}>
          <label className="field">
            <span className="field-label">{t('board.name')}</span>
            <input className="input" required maxLength={60} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <WallFields
            wallType={draft.wall_type}
            angle={draft.angle}
            grade={draft.grade}
            onChange={(changes) =>
              set({
                ...(changes.wall_type ? { wall_type: changes.wall_type, angle: DEFAULT_ANGLES[changes.wall_type] } : {}),
                ...(changes.angle !== undefined ? { angle: changes.angle } : {}),
                ...(changes.grade ? { grade: changes.grade } : {}),
              })
            }
          />
          <div className="field">
            <span className="field-label">{t('setting.stylesLabel')}</span>
            <div className="type-picker" role="group" aria-label={t('setting.stylesLabel')}>
              {STYLES.map((style) => (
                <button key={style} type="button" className="pill" aria-pressed={draft.styles.includes(style)} onClick={() => toggleStyle(style)}>
                  {t(`setting.styles.${style}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">{t('setting.gymWall')}</span>
            <input
              className="input"
              list="gym-walls"
              maxLength={60}
              placeholder={t('setting.gymWallPlaceholder')}
              value={draft.gym_wall ?? ''}
              onChange={(e) => set({ gym_wall: e.target.value || null })}
            />
            <datalist id="gym-walls">
              {map?.walls.map((wall) => <option key={wall.id} value={wall.name} />)}
            </datalist>
          </label>
          <div className="field">
            <span className="field-label">{t('setting.colour')}</span>
            <ColourPicker value={draft.colour} onChange={(colour) => set({ colour })} />
          </div>
          <label className="field">
            <span className="field-label">{t('fields.description')}</span>
            <textarea maxLength={2000} placeholder={t('setting.descriptionPlaceholder')} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">{t('setting.inspiredByLabel')}</span>
            <input className="input" maxLength={120} placeholder={t('setting.inspiredByPlaceholder')} value={draft.inspired_by ?? ''} onChange={(e) => set({ inspired_by: e.target.value || null })} />
          </label>
          <label className="field">
            <span className="field-label">{t('setting.inspiredByUrl')}</span>
            <input className="input" type="url" maxLength={300} placeholder="https://" value={draft.inspired_by_url ?? ''} onChange={(e) => set({ inspired_by_url: e.target.value || null })} />
          </label>
          <div className="field">
            <span className="field-label">{t('board.visibility')}</span>
            <Switch label={draft.is_public ? t('board.publicHint') : t('board.privateHint')} checked={draft.is_public} onChange={(is_public) => set({ is_public })} />
          </div>
          {triedSaving && issues.map((issue) => (
            <p key={issue} className="error-text" role="alert">
              {t(issue)}
            </p>
          ))}
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="form-actions">
            {draft.holds.length > 0 && (
              <button type="button" className="pill" onClick={() => { set({ holds: [] }); setSelected(null) }}>
                {t('board.clear')}
              </button>
            )}
            <button type="submit" className="pill pill-primary" disabled={saving}>
              {saving ? t('common.saving') : t('setting.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
