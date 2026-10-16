import type { WallType } from './setting'

// The wall is drawn as a 3D scene, so its shape (lean, arête, corner, roof) reads at a glance.
// World coordinates are metres: x across the wall, y up from the floor, z towards the viewer.
// A route's holds live on the wall's surface: u metres across and v metres up along it.

export type Vec = [number, number, number]
export type Point = { x: number; y: number }

/** The wall section: 6 m across and 4.5 m along its surface from the floor to the top. */
export const WALL_WIDTH_M = 6
export const WALL_LENGTH_M = 4.5
/** The part of the face hidden behind the crash mats, as a fraction of its length. */
export const MAT_FACE = 0.35 / WALL_LENGTH_M
const MAT_HEIGHT = 0.3
/** The viewer stands 8.5 m back at the wall's left end, turned towards its middle, like a photo taken at an angle. */
const EYE: Vec = [0, 1.9, 8.5]
/** A roof is seen crouched and closer, or it would be a thin sliver overhead. */
const ROOF_EYE: Vec = [0.5, 0.7, 5]
const LOOK_AT_X = WALL_WIDTH_M / 2
const EYE_HEIGHT_RANGE = [0.5, 3.6]

/**
 * How the viewer has moved from the default view: walked around the wall (`turn`, degrees),
 * raised or lowered their eyes (`lift`, metres) and zoomed the picture (`zoom` and `pan`, drawing units).
 */
export type Orbit = { turn: number; lift: number; zoom: number; pan: Point }
export const DEFAULT_ORBIT: Orbit = { turn: 0, lift: 0, zoom: 1, pan: { x: 0, y: 0 } }
export const MAX_ZOOM = 4

const baseEye = (wallType: WallType) => (wallType === 'roof' ? ROOF_EYE : EYE)
const degrees = (value: number) => (value * 180) / Math.PI

/** How far you can walk around each wall: a corner's far face would turn its back on you sooner. */
function orbitLimits(wallType: WallType) {
  const eye = baseEye(wallType)
  const start = degrees(Math.atan2(eye[0] - LOOK_AT_X, eye[2]))
  const limit = wallType === 'dihedral' ? 48 : 72
  return { turn: [-limit - start, limit - start], lift: [EYE_HEIGHT_RANGE[0] - eye[1], EYE_HEIGHT_RANGE[1] - eye[1]] }
}

/** Keeps an orbit within the wall's limits and the zoomed picture covering the frame. */
export function clampOrbit(orbit: Orbit, wallType: WallType, width: number, height: number): Orbit {
  const limits = orbitLimits(wallType)
  const zoom = clamp(orbit.zoom, 1, MAX_ZOOM)
  return {
    turn: clamp(orbit.turn, limits.turn[0], limits.turn[1]),
    lift: clamp(orbit.lift, limits.lift[0], limits.lift[1]),
    zoom,
    pan: { x: clamp(orbit.pan.x, width * (1 - zoom), 0), y: clamp(orbit.pan.y, height * (1 - zoom), 0) },
  }
}

/** Zooms by `factor`, keeping the drawing point `at` where it is. */
export function zoomAt(orbit: Orbit, at: Point, factor: number): Orbit {
  const zoom = clamp(orbit.zoom * factor, 1, MAX_ZOOM)
  const applied = zoom / orbit.zoom
  return { ...orbit, zoom, pan: { x: at.x - (at.x - orbit.pan.x) * applied, y: at.y - (at.y - orbit.pan.y) * applied } }
}

/** A camera that turns left or right (never up or down, so vertical edges stay vertical). */
type Camera = { eye: Vec; forward: Vec; right: Vec }

function camera(wallType: WallType, orbit: Orbit): Camera {
  // Walk around the middle of the wall, keeping the same distance.
  const start = baseEye(wallType)
  const radius = Math.hypot(start[0] - LOOK_AT_X, start[2])
  const around = Math.atan2(start[0] - LOOK_AT_X, start[2]) + radians(orbit.turn)
  const eye: Vec = [LOOK_AT_X + radius * Math.sin(around), clamp(start[1] + orbit.lift, EYE_HEIGHT_RANGE[0], EYE_HEIGHT_RANGE[1]), radius * Math.cos(around)]
  const turn = Math.atan2(LOOK_AT_X - eye[0], eye[2])
  return { eye, forward: [Math.sin(turn), 0, -Math.cos(turn)], right: [Math.cos(turn), 0, Math.sin(turn)] }
}
/** Light from the upper left, in front of the wall. */
const LIGHT = normalise([-0.45, 0.75, 0.65])
// How far the faces of an arête or dihedral turn away from the viewer.
const FOLD = (35 * Math.PI) / 180

/** A flat part of the wall, from (u0, v0) to (u1, v1) on the surface. */
export type Panel = { u0: number; u1: number; v0: number; v1: number; origin: Vec; eu: Vec; ev: Vec }

/** The crash mat in front of one panel: its top, its front side (if it faces you) and its seams. */
export type Mat = { panel: Panel; top: Vec[]; front: Vec[] | null; seams: [Vec, Vec][] }

export const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
function normalise(a: Vec): Vec {
  const length = Math.hypot(...a)
  return [a[0] / length, a[1] / length, a[2] / length]
}
/** A direction flattened onto the floor and made unit length. */
const flat = ([x, , z]: Vec): Vec => normalise([x, 0, z])
/** Straight out from a panel's climbing side, along the floor. */
const flatNormal = (panel: Panel): Vec => flat(cross(panel.eu, panel.ev))
const radians = (degrees: number) => (degrees * Math.PI) / 180
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)
/** Up the surface, leaning towards the viewer by `lean` degrees (negative leans away, like a slab). */
const upAlong = (lean: number): Vec => [0, Math.cos(radians(lean)), Math.sin(radians(lean))]

function buildPanels(wallType: WallType, angle: number): Panel[] {
  const half = WALL_WIDTH_M / 2
  const full = { u0: 0, u1: WALL_WIDTH_M, v0: 0, v1: WALL_LENGTH_M }
  if (wallType === 'roof') {
    // A short, slightly overhanging wall, then the roof itself at the wall's angle (90° is flat).
    const lip = WALL_LENGTH_M * 0.45
    const lower = upAlong(10)
    return [
      { ...full, v1: lip, origin: [0, 0, 0], eu: [1, 0, 0], ev: lower },
      { ...full, v0: lip, origin: add([0, 0, 0], lower, lip), eu: [1, 0, 0], ev: upAlong(clamp(angle, 50, 90)) },
    ]
  }
  const ev = upAlong(clamp(angle, -20, 60))
  if (wallType === 'arete' || wallType === 'dihedral') {
    const c = Math.cos(FOLD)
    const s = Math.sin(FOLD)
    // An arête's edge sticks out towards you; a dihedral's corner is furthest away.
    const towards = wallType === 'arete' ? 1 : -1
    const sideZ = wallType === 'arete' ? -half * s : 0
    return [
      { ...full, u1: half, origin: [half - half * c, 0, sideZ], eu: [c, 0, towards * s], ev },
      { ...full, u0: half, origin: [half, 0, sideZ + towards * half * s], eu: [c, 0, -towards * s], ev },
    ]
  }
  return [{ ...full, origin: [0, 0, 0], eu: [1, 0, 0], ev }]
}

/** Perspective projection before fitting to the drawing; the horizon is at y = 0. */
function project(point: Vec, { eye, forward, right }: Camera): Point {
  const relative = sub(point, eye)
  const depth = dot(relative, forward)
  return { x: dot(relative, right) / depth, y: -relative[1] / depth }
}

export class WallView {
  readonly panels: Panel[]
  /** Whether the line where panels meet sticks out (an arête or a roof's lip) rather than going in (a corner). */
  readonly creaseSticksOut: boolean
  private readonly camera: Camera
  private readonly scale: number
  private readonly offset: Point
  private readonly size: { width: number; height: number }

  constructor(wallType: WallType, angle: number, width: number, height: number, orbit: Orbit = DEFAULT_ORBIT) {
    this.panels = buildPanels(wallType, angle)
    this.size = { width, height }
    this.creaseSticksOut = wallType !== 'dihedral'
    this.camera = camera(wallType, orbit)
    // Fit the wall and the first metre of mat in front of it; the rest of the mats runs out of the frame, like a photo.
    const matStrip = this.footprint().flatMap(([x, , z]): Vec[] => [[x, MAT_HEIGHT, z], [x, MAT_HEIGHT, z + 1]])
    const points = [...this.panels.flatMap((panel) => this.corners(panel)), ...matStrip].map((p) => project(p, this.camera))
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const margin = width * 0.025
    const fit = Math.min((width - 2 * margin) / (right - left), (height - 2 * margin) / (bottom - top))
    // Then the viewer's zoom on top of the fitted picture.
    this.scale = fit * orbit.zoom
    this.offset = {
      x: ((width - (right - left) * fit) / 2 - left * fit) * orbit.zoom + orbit.pan.x,
      y: ((height - (bottom - top) * fit) / 2 - top * fit) * orbit.zoom + orbit.pan.y,
    }
  }

  /**
   * The camera behind this view, for a 3D renderer: where the eye is, which way it looks, and the
   * projection as a scale and offset in drawing units (so a 3D picture lines up with toScreen exactly).
   */
  cameraSetup() {
    return { eye: this.camera.eye, forward: this.camera.forward, scale: this.scale, offset: this.offset, ...this.size }
  }

  /** A world point in drawing units. */
  toScreen(point: Vec): Point {
    const p = project(point, this.camera)
    return { x: this.offset.x + p.x * this.scale, y: this.offset.y + p.y * this.scale }
  }

  /** Whether a panel's climbing side faces the viewer; panels turned away are hidden (with their holds). */
  faces(panel: Panel): boolean {
    return dot(cross(panel.eu, panel.ev), sub(this.camera.eye, panel.origin)) > 0
  }

  panelAt(u: number, v: number): Panel {
    return (
      this.panels.find((panel) => u >= panel.u0 && u <= panel.u1 && v >= panel.v0 && v <= panel.v1) ??
      this.panels[this.panels.length - 1]
    )
  }

  /** The world point u metres across and v metres up the surface. */
  surface(u: number, v: number, panel = this.panelAt(u, v)): Vec {
    return add(add(panel.origin, panel.eu, u - panel.u0), panel.ev, v - panel.v0)
  }

  corners(panel: Panel): Vec[] {
    return [
      this.surface(panel.u0, panel.v0, panel),
      this.surface(panel.u1, panel.v0, panel),
      this.surface(panel.u1, panel.v1, panel),
      this.surface(panel.u0, panel.v1, panel),
    ]
  }

  /**
   * Where a hold at face fractions (x across, y from the top) is drawn, with the linear map from the
   * face's own metres (x right, y down the face) to the drawing, so holds tilt and shrink with the wall.
   */
  place(fx: number, fy: number) {
    const u = fx * WALL_WIDTH_M
    const v = (1 - fy) * WALL_LENGTH_M
    const panel = this.panelAt(u, v)
    const world = this.surface(u, v, panel)
    const centre = this.toScreen(world)
    const down: Vec = [-panel.ev[0], -panel.ev[1], -panel.ev[2]]
    const out = normalise(cross(panel.eu, panel.ev))
    const acrossOnScreen = this.derivative(world, panel.eu)
    const downOnScreen = this.derivative(world, down)
    return {
      ...centre,
      visible: this.faces(panel),
      /** The hold's spot in the world, with the wall's directions there: across, down and out of it. */
      world,
      axes: { across: panel.eu, down, out },
      /** How the drawn point moves per metre straight out of the wall, for giving holds depth. */
      lift: this.derivative(world, out),
      matrix: [acrossOnScreen.x, acrossOnScreen.y, downOnScreen.x, downOnScreen.y] as const,
      /** Average drawing units per metre here, for things drawn flat on screen. */
      unit: Math.sqrt(Math.abs(acrossOnScreen.x * downOnScreen.y - acrossOnScreen.y * downOnScreen.x)),
    }
  }

  /** How the drawn point moves when the world point moves by `direction` (per metre). */
  private derivative(point: Vec, direction: Vec): Point {
    const { eye, forward, right } = this.camera
    const relative = sub(point, eye)
    const depth = dot(relative, forward)
    const deeper = dot(direction, forward)
    return {
      x: this.scale * (dot(direction, right) / depth - (dot(relative, right) * deeper) / depth ** 2),
      y: this.scale * (-direction[1] / depth + (relative[1] * deeper) / depth ** 2),
    }
  }

  /** Where the horizon (eye height) is in the drawing: the floor is below it, the gym's back wall above. */
  horizon(): number {
    return this.offset.y
  }

  /** The face fractions under a point of the drawing, or null if it isn't on the wall. */
  toFace(point: Point): { x: number; y: number } | null {
    const { eye, forward, right } = this.camera
    const ray = add(add(forward, right, (point.x - this.offset.x) / this.scale), [0, 1, 0], -(point.y - this.offset.y) / this.scale)
    let best: { k: number; u: number; v: number } | null = null
    for (const panel of this.panels.filter((each) => this.faces(each))) {
      // Solve origin + s·eu + t·ev = eye + k·ray.
      const target = sub(eye, panel.origin)
      const back: Vec = [-ray[0], -ray[1], -ray[2]]
      const det = dot(panel.eu, cross(panel.ev, back))
      if (Math.abs(det) < 1e-9) continue
      const s = dot(target, cross(panel.ev, back)) / det
      const t = dot(panel.eu, cross(target, back)) / det
      const k = dot(panel.eu, cross(panel.ev, target)) / det
      const u = panel.u0 + s
      const v = panel.v0 + t
      const inside = u >= panel.u0 - 1e-6 && u <= panel.u1 + 1e-6 && v >= panel.v0 - 1e-6 && v <= panel.v1 + 1e-6
      if (inside && k > 0 && (!best || k < best.k)) best = { k, u, v }
    }
    return best && { x: best.u / WALL_WIDTH_M, y: 1 - best.v / WALL_LENGTH_M }
  }

  /** How much a panel is lit: about 0 for a vertical wall, negative in shadow, positive in light. */
  light(panel: Panel): number {
    // The climbing side's normal: across × up the surface points out of the wall.
    return this.lightOn(cross(panel.eu, panel.ev), -0.42, 0.14)
  }

  /** How much a surface facing `normal` is lit, as a shade amount between `darkest` and `lightest`. */
  lightOn(normal: Vec, darkest = -0.5, lightest = 0.3): number {
    return clamp((dot(normalise(normal), LIGHT) - 0.6) * 0.6, darkest, lightest)
  }

  /** Whether a surface at `point` facing `normal` is turned towards the viewer. */
  sees(point: Vec, normal: Vec): boolean {
    return dot(normal, sub(this.camera.eye, point)) > 0
  }

  /** The foot of the wall, left to right. */
  private footprint(): Vec[] {
    const points = this.panels.filter((panel) => panel.v0 === 0).flatMap((panel) => [panel.origin, this.surface(panel.u1, 0, panel)])
    return points.filter((point, index) => index === 0 || sub(point, points[index - 1]).some((d) => Math.abs(d) > 1e-9))
  }

  /**
   * Crash mats, one piece in front of each panel standing on the floor. The pieces are mitred where
   * the wall turns, so an arête or a corner has one continuous mat in front of it.
   */
  mats(): Mat[] {
    const standing = this.panels.filter((panel) => panel.v0 === 0)
    // How far the mats reach: past the furthest the wall leans out, and at least 1.8 m.
    const reach = Math.max(1.8, ...standing.flatMap((panel) => this.corners(panel).map((corner) => dot(sub(corner, panel.origin), flatNormal(panel)) + 0.6)))
    const ends = standing.map((panel) => [this.surface(panel.u0, 0, panel), this.surface(panel.u1, 0, panel)])
    // The mats run a little past both ends of the wall.
    ends[0][0] = add(ends[0][0], flat(standing[0].eu), -0.4)
    ends[ends.length - 1][1] = add(ends[ends.length - 1][1], flat(standing[standing.length - 1].eu), 0.4)
    const out = (index: number, side: 0 | 1): Vec => {
      const normal = flatNormal(standing[index])
      const neighbour = side === 0 ? standing[index - 1] : standing[index + 1]
      if (!neighbour) return add(ends[index][side], normal, reach)
      // Mitre: where this piece's front edge meets the neighbour's.
      const other = flatNormal(neighbour)
      return add(ends[index][side], add(normal, other), reach / (1 + dot(normal, other)))
    }
    return standing.map((panel, index) => {
      const raise = ([x, , z]: Vec, height = MAT_HEIGHT): Vec => [x, height, z]
      const [backLeft, backRight] = ends[index].map((point) => raise(point))
      const [frontLeft, frontRight] = [out(index, 0), out(index, 1)].map((point) => raise(point))
      const pieces = Math.max(1, Math.round(Math.hypot(...sub(backRight, backLeft)) / 2))
      return {
        panel,
        top: [backLeft, backRight, frontRight, frontLeft],
        // The front side only shows when it faces the viewer.
        front: dot(flatNormal(panel), sub(this.camera.eye, frontLeft)) > 0 ? [frontLeft, frontRight, raise(frontRight, 0), raise(frontLeft, 0)] : null,
        seams: Array.from({ length: pieces - 1 }, (_, i): [Vec, Vec] => {
          const f = (i + 1) / pieces
          return [add(backLeft, sub(backRight, backLeft), f), add(frontLeft, sub(frontRight, frontLeft), f)]
        }),
      }
    })
  }
}
