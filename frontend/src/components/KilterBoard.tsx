import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ROLE_COLOURS } from '../board'
import type { BoardHold, BoardLayout, HoldRole } from '../types'

type Props = {
  layout: BoardLayout
  holds: BoardHold[]
  /** Makes holds tappable, opening the role picker. */
  onChange?: (holds: BoardHold[]) => void
}

// Drawing units: the board is 1000 wide.
const WIDTH = 1000
const PICKER_OUTER = 150
const PICKER_INNER = 52

type Wedge = { role: HoldRole; label: string; from: number; to: number }

/** A ring slice between two angles (degrees, 0 = right, clockwise). */
function wedgePath(cx: number, cy: number, from: number, to: number): string {
  const point = (radius: number, degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    return `${cx + radius * Math.cos(radians)} ${cy + radius * Math.sin(radians)}`
  }
  return [
    `M ${point(PICKER_INNER, from)}`,
    `L ${point(PICKER_OUTER, from)}`,
    `A ${PICKER_OUTER} ${PICKER_OUTER} 0 0 1 ${point(PICKER_OUTER, to)}`,
    `L ${point(PICKER_INNER, to)}`,
    `A ${PICKER_INNER} ${PICKER_INNER} 0 0 0 ${point(PICKER_INNER, from)}`,
    'Z',
  ].join(' ')
}

export function KilterBoard({ layout, holds, onChange }: Props) {
  const { t } = useTranslation()
  const height = WIDTH / layout.aspect
  const [picking, setPicking] = useState<number | null>(null)
  const roles = useMemo(() => new Map(holds.map((hold) => [hold.id, hold.role])), [holds])

  // Centre and ring size per hold, in drawing units.
  const shapes = useMemo(
    () =>
      layout.holds.map((hold) => {
        const cx = hold.x * WIDTH
        const cy = hold.y * height
        const points = hold.points.map(([x, y]) => [x * WIDTH, y * height] as const)
        const reach = Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy)))
        return { id: hold.id, cx, cy, ring: reach + 7, points: points.map((p) => p.join(',')).join(' ') }
      }),
    [layout, height],
  )

  useEffect(() => {
    if (picking === null) return
    const close = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && setPicking(null)
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [picking])

  const choose = (holdId: number, role: HoldRole | null) => {
    const rest = holds.filter((hold) => hold.id !== holdId)
    onChange?.(role ? [...rest, { id: holdId, role }] : rest)
    setPicking(null)
  }

  const wedges: Wedge[] = [
    { role: 'finish', label: t('board.roles.finish'), from: -135, to: -45 },
    { role: 'hand', label: t('board.roles.hand'), from: -45, to: 45 },
    { role: 'start', label: t('board.roles.start'), from: 45, to: 135 },
    { role: 'foot', label: t('board.roles.foot'), from: 135, to: 225 },
  ]

  const picked = picking === null ? null : shapes.find((shape) => shape.id === picking)
  // Keep the picker on the board even for holds near an edge.
  const pickerX = picked ? Math.min(Math.max(picked.cx, PICKER_OUTER), WIDTH - PICKER_OUTER) : 0
  const pickerY = picked ? Math.min(Math.max(picked.cy, PICKER_OUTER), height - PICKER_OUTER) : 0

  const onKey = (action: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  const editable = Boolean(onChange)

  return (
    <div className={`kilter-board${editable ? ' is-editable' : ''}${holds.length ? ' has-route' : ''}`}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={layout.name}>
        {/* Clicking the empty board closes the picker. */}
        <rect width={WIDTH} height={height} fill="transparent" onClick={() => setPicking(null)} />
        {shapes.map((shape) => (
          <g key={shape.id} className={roles.has(shape.id) ? 'kb-hold is-used' : 'kb-hold'}>
            <polygon
              points={shape.points}
              onClick={editable ? () => setPicking(shape.id === picking ? null : shape.id) : undefined}
            />
            <circle className="kb-bolt" cx={shape.cx} cy={shape.cy} r={3.2} />
          </g>
        ))}
        {shapes.map((shape) => {
          const role = roles.get(shape.id)
          return role ? (
            <circle
              key={shape.id}
              className="kb-ring"
              cx={shape.cx}
              cy={shape.cy}
              r={shape.ring}
              stroke={ROLE_COLOURS[role]}
            />
          ) : null
        })}

        {picked && (
          <g className="kb-picker">
            <circle cx={pickerX} cy={pickerY} r={PICKER_OUTER + 4} className="kb-picker-backdrop" />
            {wedges.map((wedge) => {
              const middle = ((wedge.from + wedge.to) / 2) * (Math.PI / 180)
              const labelRadius = (PICKER_INNER + PICKER_OUTER) / 2
              const lx = pickerX + labelRadius * Math.cos(middle)
              const ly = pickerY + labelRadius * Math.sin(middle)
              const active = roles.get(picked.id) === wedge.role
              return (
                <g
                  key={wedge.role}
                  className={active ? 'kb-wedge is-active' : 'kb-wedge'}
                  role="button"
                  tabIndex={0}
                  aria-label={wedge.label}
                  onClick={() => choose(picked.id, wedge.role)}
                  onKeyDown={onKey(() => choose(picked.id, wedge.role))}
                >
                  <path d={wedgePath(pickerX, pickerY, wedge.from + 1, wedge.to - 1)} />
                  <text x={lx} y={ly - 16} textAnchor="middle">
                    {wedge.label}
                  </text>
                  <circle cx={lx} cy={ly + 16} r={11} stroke={ROLE_COLOURS[wedge.role]} className="kb-wedge-ring" />
                </g>
              )
            })}
            <g
              className="kb-wedge kb-remove"
              role="button"
              tabIndex={0}
              aria-label={t('board.roles.remove')}
              onClick={() => choose(picked.id, null)}
              onKeyDown={onKey(() => choose(picked.id, null))}
            >
              <circle cx={pickerX} cy={pickerY} r={PICKER_INNER - 4} />
              <text x={pickerX} y={pickerY + 10} textAnchor="middle">
                ✕
              </text>
            </g>
            {/* Marks the hold being changed. */}
            <circle className="kb-picked" cx={picked.cx} cy={picked.cy} r={picked.ring} />
          </g>
        )}
      </svg>
    </div>
  )
}
