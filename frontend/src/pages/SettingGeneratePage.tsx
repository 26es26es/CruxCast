import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { COLOURS, type Colour } from '../constants'
import { FloatTitle } from '../components/FloatTitle'
import { RoleLegend } from '../components/RoleLegend'
import { ColourPicker, HoldTypeToggles, WallFields } from '../components/RouteOptions'
import { HoldList } from '../components/HoldList'
import { RouteWall } from '../components/RouteWall'
import { errorMessage } from '../i18n'
import { DEFAULT_ANGLES, HOLD_TYPES, PATHS, STYLES, type GenerateSpec, type RouteHold, type Style } from '../setting'
import { Switch } from '../components/FilterControls'

const newSeed = () => Math.floor(Math.random() * 1_000_000)

// Remembered while the app is open, so going back keeps your choices.
let lastSpec: GenerateSpec = {
  wall_type: 'overhang', angle: 20, grade: '6B', style: 'power', path: 'auto', moves: 6, hold_types: [...HOLD_TYPES], seed: newSeed(),
}
let lastColour: Colour = 'purple'
let lastShowOthers = true

export function SettingGeneratePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [spec, setSpec] = useState<GenerateSpec>(lastSpec)
  const [colour, setColour] = useState<Colour>(lastColour)
  const [holds, setHolds] = useState<RouteHold[]>([])
  const [showOthers, setShowOthers] = useState(lastShowOthers)
  const [error, setError] = useState<string | null>(null)
  const update = (changes: Partial<GenerateSpec>) => setSpec((current) => ({ ...current, ...changes }))

  useEffect(() => {
    lastSpec = spec
    let active = true
    api
      .generateRoute(spec)
      .then((result) => {
        if (!active) return
        setHolds(result)
        setError(null)
      })
      .catch((caught) => active && setError(errorMessage(caught)))
    return () => {
      active = false
    }
  }, [spec])

  useEffect(() => {
    lastColour = colour
    lastShowOthers = showOthers
  }, [colour, showOthers])

  const toggleType = (type: (typeof HOLD_TYPES)[number]) =>
    update({ hold_types: spec.hold_types.includes(type) ? spec.hold_types.filter((t) => t !== type) : [...spec.hold_types, type] })

  const editAndSave = () =>
    navigate('/setting/new', {
      state: {
        draft: {
          name: t('setting.generatedName', { style: t(`setting.styles.${spec.style}`), grade: spec.grade }),
          wall_type: spec.wall_type,
          angle: spec.angle,
          gym_wall: null,
          grade: spec.grade,
          styles: [spec.style],
          colour,
          description: '',
          is_public: false,
          holds,
        },
      },
    })

  return (
    <div className="page board-page">
      <Link to="/setting" className="back-link">
        {t('setting.back')}
      </Link>
      <div className="page-head">
        <p className="section-kicker">{t('setting.kicker')}</p>
        <FloatTitle text={t('setting.generateTitle')} />
        <p className="page-lede">{t('setting.generateLede')}</p>
      </div>
      <div className="board-layout">
        <div className="route-stage">
          <RouteWall wallType={spec.wall_type} angle={spec.angle} colour={COLOURS[colour]} holds={holds} showOtherHolds={showOthers} showRoles />
          <div className="wall-options">
            <RoleLegend />
            <Switch label={t('setting.showOtherHolds')} checked={showOthers} onChange={setShowOthers} />
          </div>
          <HoldList holds={holds} />
        </div>
        <div className="board-side form form-panel">
          <WallFields
            wallType={spec.wall_type}
            angle={spec.angle}
            grade={spec.grade}
            onChange={(changes) =>
              update({
                ...(changes.wall_type ? { wall_type: changes.wall_type, angle: DEFAULT_ANGLES[changes.wall_type] } : {}),
                ...(changes.angle !== undefined ? { angle: changes.angle } : {}),
                ...(changes.grade ? { grade: changes.grade } : {}),
              })
            }
          />
          <div className="field">
            <span className="field-label">{t('setting.style')}</span>
            <div className="type-picker" role="radiogroup" aria-label={t('setting.style')}>
              {STYLES.map((style) => (
                <button key={style} type="button" className="pill" aria-pressed={spec.style === style} onClick={() => update({ style: style as Style })}>
                  {t(`setting.styles.${style}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">{t('setting.path')}</span>
            <div className="type-picker" role="group" aria-label={t('setting.path')}>
              {PATHS.map((path) => (
                <button key={path} type="button" className="pill" aria-pressed={spec.path === path} onClick={() => update({ path })}>
                  {t(`setting.paths.${path}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">
              {t('setting.moves')} <strong className="effort-value">{spec.moves}</strong>
            </span>
            <input className="effort-slider" type="range" min={3} max={12} value={spec.moves} onChange={(e) => update({ moves: Number(e.target.value) })} />
          </label>
          <div className="field">
            <span className="field-label">{t('setting.holdTypes')}</span>
            <span className="field-hint">{t('setting.holdTypesHint')}</span>
            <HoldTypeToggles selected={spec.hold_types} onToggle={toggleType} />
          </div>
          <div className="field">
            <span className="field-label">{t('setting.colour')}</span>
            <ColourPicker value={colour} onChange={setColour} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="pill" onClick={() => update({ seed: newSeed() })}>
              ↻ {t('setting.regenerate')}
            </button>
            <button type="button" className="pill pill-primary" disabled={!holds.length} onClick={editAndSave}>
              {t('setting.editAndSave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
