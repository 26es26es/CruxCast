import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ROLE_COLOURS } from '../board'
import { COLOURS } from '../constants'
import { HOLD_RELIEF, HOLD_SHAPES, holesPath, iconPath, JUG_INCUT, mixColour, outerPath, reliefScale, shadeColour, variantIndex, VOLUME_SOLIDS } from '../holdShapes'
import { FACE_ASPECT, RADIUS, type HoldSize, type HoldType, type RouteHold, type WallType } from '../setting'
import { add, cross, dot, MAT_FACE, MAX_ZOOM, sub, WALL_LENGTH_M, WALL_WIDTH_M, WallView, type Vec } from '../wallPerspective'
import { holdManifest, type HoldModelEntry } from '../wall3d/holdManifest'
import { canDraw3d } from '../wall3d/support'
import { useWallOrbit } from './useWallOrbit'

// The 3D wall (three.js) is only downloaded when a full-size wall is shown.
const Wall3D = lazy(() => import('../wall3d/Wall3D'))

// Drawing units: 1600 × 1200, the 4:3 frame the 3D view of the wall is fitted into.
const WIDTH = 1600
const HEIGHT = WIDTH * FACE_ASPECT
const GRAIN_TILE = 240
// Plywood panels are 1.22 m, T-nuts sit every 20 cm.
const PANEL_M = 1.22
const T_NUT_M = 0.2

/** Base colour of the painted plywood. */
const PLYWOOD = '#e8e4dc'

/** Makes an SVG id unique to one wall, since several walls can be on the same page. */
type Scope = (name: string) => string

const gradientName = (hex: string) => `hold-fill-${hex.slice(1)}`
const polygon = (view: WallView, points: Vec[]) => points.map((p) => view.toScreen(p)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** Shared SVG definitions: grain, hold shadows, mats and a fill per hold colour. */
function Defs({ id, colours }: { id: Scope; colours: string[] }) {
  return (
    <defs>
      {/* Grain is rendered once on a small tile and repeated: far cheaper than filtering the whole wall. */}
      <filter id={id('wall-grain')} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={4} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope={0.09} />
        </feComponentTransfer>
      </filter>
      <pattern id={id('grain')} width={GRAIN_TILE} height={GRAIN_TILE} patternUnits="userSpaceOnUse">
        <rect width={GRAIN_TILE} height={GRAIN_TILE} filter={`url(#${id('wall-grain')})`} />
      </pattern>
      {/* Soft shadows the holds cast on the wall. */}
      <filter id={id('hold-shadow')} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={4} />
      </filter>
      <linearGradient id={id('floor')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a2d33" />
        <stop offset="1" stopColor="#4a4e56" />
      </linearGradient>
      <linearGradient id={id('mat-top')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#334253" />
        <stop offset="1" stopColor="#45576b" />
      </linearGradient>
      {colours.map((hex) => (
        <radialGradient key={hex} id={id(gradientName(hex))} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor={shadeColour(hex, 0.4)} />
          <stop offset="0.45" stopColor={hex} />
          <stop offset="1" stopColor={shadeColour(hex, -0.35)} />
        </radialGradient>
      ))}
    </defs>
  )
}

/** Small circles as one path, which is much lighter than hundreds of elements. */
function dots(points: { x: number; y: number; r: number }[]): string {
  return points.map(({ x, y, r }) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`).join('')
}

/** The gym around the wall, the wall's plywood faces lit by their angle, and the crash mats. */
function WallScene({ id, view, simple }: { id: Scope; view: WallView; simple: boolean }) {
  const line = (a: Vec, b: Vec) => {
    const [p, q] = [view.toScreen(a), view.toScreen(b)]
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y }
  }
  const seams: { key: string; a: Vec; b: Vec }[] = []
  const nuts: { x: number; y: number; r: number }[] = []
  const shown = view.panels.filter((panel) => view.faces(panel))
  for (const [index, panel] of shown.entries()) {
    for (let u = PANEL_M; u < WALL_WIDTH_M; u += PANEL_M) {
      if (u > panel.u0 + 0.01 && u < panel.u1 - 0.01) seams.push({ key: `${index}u${u}`, a: view.surface(u, panel.v0, panel), b: view.surface(u, panel.v1, panel) })
    }
    for (let v = PANEL_M; v < WALL_LENGTH_M; v += PANEL_M) {
      if (v > panel.v0 + 0.01 && v < panel.v1 - 0.01) seams.push({ key: `${index}v${v}`, a: view.surface(panel.u0, v, panel), b: view.surface(panel.u1, v, panel) })
    }
    if (simple) continue
    for (let u = panel.u0 + T_NUT_M / 2; u < panel.u1; u += T_NUT_M) {
      for (let v = Math.max(panel.v0, 0.3) + T_NUT_M / 2; v < panel.v1; v += T_NUT_M) {
        const spot = view.place(u / WALL_WIDTH_M, 1 - v / WALL_LENGTH_M)
        nuts.push({ x: spot.x, y: spot.y, r: 0.016 * spot.unit })
      }
    }
  }
  // Where two panels meet: an arête's edge catches the light, a corner is dark, a roof has a lip.
  const creases = view.panels.slice(1).map((panel) =>
    panel.v0 > 0 ? [view.surface(panel.u0, panel.v0, panel), view.surface(panel.u1, panel.v0, panel)] : [view.surface(panel.u0, panel.v0, panel), view.surface(panel.u0, panel.v1, panel)],
  )
  const convex = view.creaseSticksOut
  // A mat in front of a face turned away from you is behind the wall; the others are in front of it.
  const mats = view.mats()
  const matPieces = (front: boolean) =>
    mats
      .filter((mat) => view.faces(mat.panel) === front)
      .map((mat, index) => (
        <g key={`${front}${index}`}>
          <polygon points={polygon(view, mat.top)} fill={`url(#${id('mat-top')})`} />
          {mat.front && <polygon points={polygon(view, mat.front)} fill="#1f2832" />}
          <g stroke="#000" strokeOpacity={0.35} strokeWidth={3}>
            {mat.seams.map(([a, b], seam) => (
              <line key={seam} {...line(a, b)} />
            ))}
          </g>
        </g>
      ))
  return (
    <g>
      <rect width={WIDTH} height={HEIGHT} fill="#24272c" />
      <rect y={view.horizon()} width={WIDTH} height={Math.max(HEIGHT - view.horizon(), 0)} fill={`url(#${id('floor')})`} />
      {matPieces(false)}
      {shown.map((panel, index) => (
        <polygon key={index} points={polygon(view, view.corners(panel))} fill={shadeColour(PLYWOOD, view.light(panel))} stroke="#000" strokeOpacity={0.25} strokeWidth={3} strokeLinejoin="round" />
      ))}
      {!simple && (
        <>
          <path d={dots(nuts)} fill="#cdc6ba" />
          <path d={dots(nuts.map((n) => ({ ...n, r: n.r * 0.55 })))} fill="#3b3631" />
          {shown.map((panel, index) => (
            <polygon key={index} points={polygon(view, view.corners(panel))} fill={`url(#${id('grain')})`} />
          ))}
        </>
      )}
      <g stroke="#000" strokeOpacity={0.14} strokeWidth={3}>
        {seams.map((seam) => (
          <line key={seam.key} {...line(seam.a, seam.b)} />
        ))}
      </g>
      {creases.map(([a, b], index) => (
        <line key={index} {...line(a, b)} stroke={convex ? '#fff' : '#000'} strokeOpacity={convex ? 0.75 : 0.35} strokeWidth={4} strokeLinecap="round" />
      ))}
      {matPieces(true)}
    </g>
  )
}

type DrawnHold = Pick<RouteHold, 'x' | 'y' | 'type' | 'size' | 'rotation'>
type Spot = ReturnType<WallView['place']>

/**
 * One hold standing off the wall: its outline is stacked from the wall out to its top, shrinking
 * the way the hold's sides do, so it has real depth from any angle. Volumes are solids.
 */
function Hold({
  id,
  view,
  hold,
  colour: ownColour,
  faded = false,
  shadow = !faded,
  rough = false,
}: {
  id: Scope
  view: WallView
  hold: DrawnHold
  colour: string
  faded?: boolean
  shadow?: boolean
  /** Fewer layers, for while the view is moving. */
  rough?: boolean
}) {
  // Other routes' holds are toned down towards the wall's colour, so the route stands out.
  const colour = faded ? mixColour(ownColour, PLYWOOD, 0.45) : ownColour
  const spot = view.place(hold.x, hold.y)
  if (!spot.visible) return null
  const radius = RADIUS[hold.size] * WALL_WIDTH_M
  if (hold.type === 'volume') return <Volume id={id} view={view} spot={spot} hold={hold} colour={colour} radius={radius} shadow={shadow} />

  const [a, b, c, d] = spot.matrix
  // Draws in the hold's own plane, `height` metres out from the wall, shifted along the wall by `shift` metres.
  const at = (height: number, scale = 1, shift = { x: 0, y: 0 }) =>
    `translate(${spot.x + spot.lift.x * height} ${spot.y + spot.lift.y * height}) matrix(${a} ${b} ${c} ${d} 0 0) translate(${shift.x} ${shift.y}) rotate(${hold.rotation}) scale(${radius * scale})`
  const shapes = HOLD_SHAPES[hold.type]
  const shape = shapes[variantIndex(hold.x, hold.y, shapes.length)]
  const outline = outerPath(shape)
  const relief = HOLD_RELIEF[hold.type]
  const depth = relief.depth * radius
  // Enough layers that the sides look smooth at this zoom and angle.
  const reach = Math.hypot(spot.lift.x, spot.lift.y) * depth
  const layers = Math.round(Math.min(Math.max(reach / (rough ? 3 : 1), 2), faded ? (rough ? 3 : 12) : rough ? 10 : 28))
  const top = at(depth, reliefScale(relief, 1))
  return (
    <g>
      {shadow && (
        // Lit from the upper left, so the shadow falls down and to the right on the wall.
        <g filter={`url(#${id('hold-shadow')})`}>
          <path d={outline} transform={at(0, 1, { x: depth * 0.6, y: depth * 1 })} fill="#000" opacity={0.32} />
        </g>
      )}
      {Array.from({ length: layers }, (_, layer) => {
        const t = layer / layers
        const side = shadeColour(colour, -0.5 + 0.3 * t)
        return (
          // Each layer is outlined in its own colour, which closes the hairline seams between layers.
          <path
            key={layer}
            d={outline}
            transform={at(depth * t, reliefScale(relief, t))}
            fill={side}
            stroke={layer === 0 ? shadeColour(colour, -0.6) : side}
            strokeWidth={0.06}
            strokeLinejoin="round"
          />
        )
      })}
      <g transform={top}>
        <path d={outline} fill={faded ? colour : `url(#${id(gradientName(colour))})`} stroke={shadeColour(colour, -0.3)} strokeWidth={0.03} />
        {(hold.type === 'jug' || hold.type === 'undercling') && <path d={JUG_INCUT} fill={shadeColour(colour, -0.65)} />}
        {hold.type === 'pocket' && <path d={holesPath(shape)} fill={shadeColour(colour, -0.75)} />}
        {!faded && hold.type !== 'crimp' && hold.type !== 'foot_chip' && (
          <ellipse cx={-0.3} cy={-0.1} rx={0.3} ry={0.12} fill="#fff" opacity={0.3} transform="rotate(-20)" />
        )}
        {hold.type !== 'pocket' && (
          <>
            <circle cy={0.15} r={0.15} fill={shadeColour(colour, -0.25)} />
            <circle cy={0.15} r={0.075} fill="#1d1b19" />
          </>
        )}
      </g>
    </g>
  )
}

/** A volume as a solid: each face lit by the way it points, faces turned away from you left out. */
function Volume({ id, view, spot, hold, colour, radius, shadow }: { id: Scope; view: WallView; spot: Spot; hold: DrawnHold; colour: string; radius: number; shadow: boolean }) {
  const solid = VOLUME_SOLIDS[variantIndex(hold.x, hold.y, VOLUME_SOLIDS.length)]
  const turn = (hold.rotation * Math.PI) / 180
  const { across, down, out } = spot.axes
  const inWorld = ([x, y, h]: [number, number, number], shift = 0): Vec => {
    const sideways = (x * Math.cos(turn) - y * Math.sin(turn)) * radius + shift * 0.6
    const downwards = (x * Math.sin(turn) + y * Math.cos(turn)) * radius + shift
    return add(add(add(spot.world, across, sideways), down, downwards), out, h * radius)
  }
  const points = solid.points.map((point) => inWorld(point))
  const average = (list: Vec[]) => list.reduce((sum, point) => add(sum, point, 1 / list.length), [0, 0, 0] as Vec)
  const middle = average(points)
  const onScreen = (list: Vec[]) => list.map((point) => view.toScreen(point)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const height = Math.max(...solid.points.map(([, , h]) => h)) * radius
  const base = solid.points.filter(([, , h]) => h === 0).map((point) => inWorld(point, height))
  return (
    <g>
      {shadow && (
        <g filter={`url(#${id('hold-shadow')})`}>
          <polygon points={onScreen(base)} fill="#000" opacity={0.32} />
        </g>
      )}
      {solid.faces.map((face, index) => {
        const corners = face.map((i) => points[i])
        const centre = average(corners)
        let normal = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0]))
        if (dot(normal, sub(centre, middle)) < 0) normal = [-normal[0], -normal[1], -normal[2]]
        if (!view.sees(centre, normal)) return null
        return (
          <polygon
            key={index}
            points={onScreen(corners)}
            fill={shadeColour(colour, view.lightOn(normal))}
            stroke={shadeColour(colour, -0.45)}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )
      })}
    </g>
  )
}

/** Other routes' holds, scattered faintly so the wall looks like a real, busy wall. */
function backgroundHolds(route: RouteHold[], routeColour: string, seed: number) {
  let state = seed || 1
  const random = () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
  const colours = Object.values(COLOURS).filter((hex) => hex !== routeColour)
  const types: HoldType[] = ['jug', 'crimp', 'edge', 'sloper', 'pinch', 'pocket', 'sidepull', 'foot_chip', 'macro']
  const sizes: HoldSize[] = ['xs', 's', 'm', 'm', 'l']
  const others: (DrawnHold & { colour: string })[] = []
  const matTop = 1 - MAT_FACE
  for (let attempt = 0; attempt < 220 && others.length < 70; attempt++) {
    const hold = {
      x: 0.03 + random() * 0.94,
      y: 0.04 + random() * (matTop - 0.08),
      type: types[Math.floor(random() * types.length)],
      size: sizes[Math.floor(random() * sizes.length)],
      rotation: Math.round(random() * 90 - 45),
      colour: colours[Math.floor(random() * colours.length)],
    }
    const clear = [...route, ...others].every(
      (other) => Math.hypot(hold.x - other.x, (hold.y - other.y) * FACE_ASPECT) > RADIUS[hold.size] + RADIUS[other.size] + 0.025,
    )
    if (clear) others.push(hold)
  }
  return others
}

type Props = {
  wallType: WallType
  angle: number
  colour: string
  holds: RouteHold[]
  /** Faint holds of other routes in the background. */
  showOtherHolds?: boolean
  /** Coloured rings showing each hold's role (start, hand, top, foot). */
  showRoles?: boolean
  selected?: number | null
  /** Editing: a click on the empty wall, in face fractions. */
  onWallClick?: (x: number, y: number) => void
  /** Editing: a hold was clicked (without dragging). */
  onHoldClick?: (index: number) => void
  /** Editing: a hold was dragged to a new spot, in face fractions. */
  onHoldMove?: (index: number, x: number, y: number) => void
  /** Small previews: no grain, T-nuts or hold shadows, which are invisible at that size but costly to paint. */
  simple?: boolean
  className?: string
}

export function RouteWall({
  wallType,
  angle,
  colour,
  holds,
  showOtherHolds = true,
  showRoles = false,
  selected,
  onWallClick,
  onHoldClick,
  onHoldMove,
  simple = false,
  className,
}: Props) {
  const { t } = useTranslation()
  const svgRef = useRef<SVGSVGElement>(null)
  // useId can contain characters (like ':') that break url(#…) references.
  const prefix = `wall${useId().replace(/[^a-zA-Z0-9]/g, '')}-`
  const id: Scope = (name) => `${prefix}${name}`
  const drag = useRef<{ index: number; moved: boolean } | null>(null)
  const editable = Boolean(onWallClick || onHoldMove)
  // Background holds are placed once per route shape, so they don't jump around while you edit.
  const holdCount = holds.length
  const others = useMemo(
    () => (showOtherHolds ? backgroundHolds(holds, colour, holdCount * 7919 + Math.round(angle + 40)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showOtherHolds, holdCount, colour, angle],
  )
  const colours = useMemo(() => [...new Set([colour, ...others.map((o) => o.colour)])], [colour, others])
  // Double-click zooms on walls you only look at; in the editor clicks place holds.
  const look = useWallOrbit(svgRef, wallType, { width: WIDTH, height: HEIGHT }, { enabled: !simple, doubleClickZoom: !editable })
  const view = useMemo(() => new WallView(wallType, angle, WIDTH, HEIGHT, look.orbit), [wallType, angle, look.orbit])
  // Full-size walls are drawn in 3D when the browser can; until it's ready (and for thumbnails)
  // the flat drawing shows instead. Either way this SVG stays on top for clicks, rings and gestures.
  const use3d = !simple && canDraw3d()
  const [ready3d, setReady3d] = useState(false)
  const markReady = useCallback(() => setReady3d(true), [])
  const drawn3d = use3d && ready3d
  const tapes = useMemo(
    () =>
      holds
        .filter((hold) => hold.role === 'start' || hold.role === 'finish')
        .map((hold) => ({ hold, label: hold.role === 'start' ? t('setting.tape.start') : t('setting.tape.top'), colour: ROLE_COLOURS[hold.role] })),
    [holds, t],
  )

  const toFace = (event: { clientX: number; clientY: number }) => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return null
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const face = view.toFace(point)
    return face && { x: Math.min(Math.max(face.x, 0.02), 0.98), y: Math.min(Math.max(face.y, 0.02), 1 - MAT_FACE - 0.02) }
  }

  const startDrag = (index: number) => (event: ReactPointerEvent) => {
    if (!editable || event.button !== 0) return
    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    drag.current = { index, moved: false }
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag.current || !onHoldMove) return
    const point = toFace(event)
    if (!point) return
    drag.current.moved = true
    onHoldMove(drag.current.index, point.x, point.y)
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    const current = drag.current
    drag.current = null
    if (current) {
      if (!current.moved) onHoldClick?.(current.index)
      return
    }
    const point = toFace(event)
    // A drag that turned the view isn't a click on the wall.
    if (point && event.button === 0 && !look.wasDragged() && (event.target as Element).classList.contains('route-wall-hit')) onWallClick?.(point.x, point.y)
  }

  const wall = (
    <svg
      ref={svgRef}
      className={`route-wall${editable ? ' is-editable' : ''}${simple ? '' : ' can-orbit'}${drawn3d ? ' is-overlay' : ''}${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t('setting.wallLabel', { wall: t(`setting.walls.${wallType}`), angle })}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {!drawn3d && (
        <>
          <Defs id={id} colours={colours} />
          <WallScene id={id} view={view} simple={simple} />
          {others.map((other, index) => (
            <Hold key={`o${index}`} id={id} view={view} hold={other} colour={other.colour} faded rough={look.moving} />
          ))}
        </>
      )}
      {/* Catches clicks on the empty wall. */}
      {view.panels.filter((panel) => view.faces(panel)).map((panel, index) => (
        <polygon key={index} className="route-wall-hit" points={polygon(view, view.corners(panel))} fill="transparent" />
      ))}
      {holds.map((hold, index) => {
        const { x, y, unit, visible } = view.place(hold.x, hold.y)
        if (!visible) return null
        const radius = RADIUS[hold.size] * WALL_WIDTH_M * unit
        return (
          <g
            key={index}
            className={`route-hold${index === selected ? ' is-selected' : ''}`}
            onPointerDown={startDrag(index)}
            data-no-orbit={editable || undefined}
          >
            {drawn3d ? (
              // The hold itself is in the 3D picture underneath; this is what you click and drag.
              <circle cx={x} cy={y} r={radius * 1.15 + 6} fill="transparent" />
            ) : (
              <Hold id={id} view={view} hold={hold} colour={colour} shadow={!simple && !look.moving} rough={look.moving} />
            )}
            {!drawn3d && (hold.role === 'start' || hold.role === 'finish') && (
              // Gym-style tape marking the start and top holds.
              <g transform={`translate(${x} ${y + radius + 26}) rotate(-6)`} className="route-tape">
                <rect x={-46} y={-14} width={92} height={28} rx={3} fill={ROLE_COLOURS[hold.role]} />
                <text y={8} textAnchor="middle">
                  {hold.role === 'start' ? t('setting.tape.start') : t('setting.tape.top')}
                </text>
              </g>
            )}
            {(showRoles || index === selected) && (
              <circle
                className="route-hold-ring"
                cx={x}
                cy={y}
                r={radius * 1.3 + 12}
                stroke={index === selected ? '#0a0a0b' : ROLE_COLOURS[hold.role]}
                strokeDasharray={index === selected ? '16 9' : hold.role === 'foot' ? '12 8' : undefined}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
  if (simple) return wall

  return (
    <>
      <div className="route-wall-frame">
        {use3d && (
          <Suspense fallback={null}>
            <Wall3D view={view} wallKey={`${wallType}:${angle}`} holds={holds} colour={colour} others={others} tapes={tapes} moving={look.moving} onReady={markReady} />
          </Suspense>
        )}
        {wall}
        <div className="wall-view-controls">
          {/* What a drag does: move the (zoomed) picture around, or turn the wall. */}
          <button type="button" aria-pressed={look.mode === 'move'} onClick={() => look.setMode('move')} aria-label={t('setting.view.modeMove')} title={t('setting.view.modeMove')}>
            ✥
          </button>
          <button type="button" aria-pressed={look.mode === 'turn'} onClick={() => look.setMode('turn')} aria-label={t('setting.view.modeTurn')} title={t('setting.view.modeTurn')}>
            ⟲
          </button>
          <button type="button" onClick={() => look.turnBy(-20)} aria-label={t('setting.view.fromLeft')} title={t('setting.view.fromLeft')}>
            ‹
          </button>
          <button type="button" onClick={() => look.turnBy(20)} aria-label={t('setting.view.fromRight')} title={t('setting.view.fromRight')}>
            ›
          </button>
          <button type="button" onClick={() => look.zoomBy(1.5)} disabled={look.orbit.zoom >= MAX_ZOOM} aria-label={t('setting.view.zoomIn')} title={t('setting.view.zoomIn')}>
            +
          </button>
          <button type="button" onClick={() => look.zoomBy(1 / 1.5)} disabled={look.orbit.zoom <= 1} aria-label={t('setting.view.zoomOut')} title={t('setting.view.zoomOut')}>
            −
          </button>
          <button type="button" onClick={look.reset} disabled={!look.changed} aria-label={t('setting.view.reset')} title={t('setting.view.reset')}>
            ⤢
          </button>
        </div>
        <p className="wall-view-hint">{t(look.mode === 'move' ? 'setting.view.hintMove' : 'setting.view.hint')}</p>
      </div>
      {use3d && <HoldCredits />}
    </>
  )
}

/** Credits for hold models added by hand (public/holds), when there are any. */
function HoldCredits() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<HoldModelEntry[]>([])
  useEffect(() => {
    let current = true
    holdManifest().then((list) => current && setEntries(list))
    return () => {
      current = false
    }
  }, [])
  if (!entries.length) return null
  return (
    <p className="hold-credits">
      {t('setting.holdCredits')}{' '}
      {entries.map((entry, index) => (
        <span key={entry.file}>
          {index > 0 && ' · '}
          <a href={entry.url} target="_blank" rel="noopener noreferrer">
            {entry.name}
          </a>{' '}
          {t('setting.holdCreditBy', { author: entry.author, licence: entry.licence })}
        </span>
      ))}
    </p>
  )
}

/** A small side view showing how steep the wall is. */
export function WallProfile({ angle }: { angle: number }) {
  const radians = (angle * Math.PI) / 180
  const top = { x: 14 + 30 * Math.sin(radians), y: 40 - 30 * Math.cos(radians) }
  return (
    <svg className="wall-profile" viewBox="0 0 56 44" aria-hidden="true">
      <line x1={4} y1={40} x2={52} y2={40} />
      <line x1={14} y1={40} x2={top.x} y2={top.y} className="wall-profile-wall" />
    </svg>
  )
}

/** A hold type's outline as a small icon, for pickers and legends. */
export function HoldIcon({ type, colour = 'currentColor' }: { type: HoldType; colour?: string }) {
  return (
    <svg className="hold-icon" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
      <path d={iconPath(type)} fill={colour} fillRule="evenodd" />
    </svg>
  )
}
