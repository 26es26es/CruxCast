import * as THREE from 'three'
import { mixColour, variantIndex } from '../holdShapes'
import { RADIUS, type RouteHold } from '../setting'
import { cross, WALL_LENGTH_M, WALL_WIDTH_M, type Panel, type Vec, type WallView } from '../wallPerspective'
import { holdModel, VARIANTS } from './holdGeometry'

// The climbing wall as a lit 3D scene: plywood panels with T-nuts, crash mats, the floor,
// and the holds with real shadows. The camera copies a WallView's projection exactly, so the
// picture lines up with everything drawn or clicked on top of it in drawing units.

const PLYWOOD = '#e8e4dc'
const BACKDROP = '#23262b'
// Texture detail for the plywood, and the panel and T-nut grids in metres.
const PIXELS_PER_METRE = 170
const PANEL_M = 1.22
const T_NUT_M = 0.2
const MAT_HEIGHT = 0.3
// START and TOP tape, in metres.
const TAPE_M: [number, number] = [0.26, 0.075]

export type SceneHold = Pick<RouteHold, 'x' | 'y' | 'type' | 'size' | 'rotation'>
/** START or TOP tape stuck to the wall under a hold. */
export type Tape = { hold: SceneHold; label: string; colour: string }

const vector = ([x, y, z]: Vec) => new THREE.Vector3(x, y, z)

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

/** Painted plywood for one panel: grain, the seams between sheets, and a T-nut every 20 cm. */
function plywoodTexture(panel: Panel, anisotropy: number): THREE.CanvasTexture {
  const width = Math.round((panel.u1 - panel.u0) * PIXELS_PER_METRE)
  const height = Math.round((panel.v1 - panel.v0) * PIXELS_PER_METRE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')!
  // Canvas y runs down; the panel's v runs up.
  const at = (u: number, v: number): [number, number] => [(u - panel.u0) * PIXELS_PER_METRE, (panel.v1 - v) * PIXELS_PER_METRE]
  g.fillStyle = PLYWOOD
  g.fillRect(0, 0, width, height)
  const random = seededRandom(Math.round(panel.u0 * 100 + panel.v0 * 1000) + 7)
  for (let i = 0; i < (width * height) / 900; i++) {
    const [x, y] = [random() * width, random() * height]
    g.strokeStyle = random() < 0.5 ? `rgba(120, 100, 70, ${0.025 + random() * 0.03})` : `rgba(255, 255, 255, ${0.04 + random() * 0.04})`
    g.lineWidth = 1 + random() * 2
    g.beginPath()
    g.moveTo(x, y)
    g.bezierCurveTo(x + 40, y + (random() - 0.5) * 6, x + 90, y + (random() - 0.5) * 6, x + 130 + random() * 120, y + (random() - 0.5) * 4)
    g.stroke()
  }
  g.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  g.lineWidth = 2
  for (let u = Math.ceil(panel.u0 / PANEL_M) * PANEL_M; u < panel.u1; u += PANEL_M) {
    if (u - panel.u0 < 0.01) continue
    g.beginPath()
    g.moveTo(...at(u, panel.v0))
    g.lineTo(...at(u, panel.v1))
    g.stroke()
  }
  for (let v = Math.ceil(panel.v0 / PANEL_M) * PANEL_M; v < panel.v1; v += PANEL_M) {
    if (v - panel.v0 < 0.01) continue
    g.beginPath()
    g.moveTo(...at(panel.u0, v))
    g.lineTo(...at(panel.u1, v))
    g.stroke()
  }
  // T-nuts sit on a grid measured from the wall's corner, so they line up across panels.
  const first = (start: number) => Math.ceil((start - T_NUT_M / 2) / T_NUT_M) * T_NUT_M + T_NUT_M / 2
  for (let u = first(panel.u0); u < panel.u1; u += T_NUT_M) {
    for (let v = Math.max(first(panel.v0), 0.3); v < panel.v1; v += T_NUT_M) {
      const [x, y] = at(u, v)
      g.fillStyle = '#cbc3b5'
      g.beginPath()
      g.arc(x, y, 0.017 * PIXELS_PER_METRE, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#2d2925'
      g.beginPath()
      g.arc(x, y, 0.0095 * PIXELS_PER_METRE, 0, Math.PI * 2)
      g.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

/** Fine speckle that gives holds their sandy, grippy texture (as a bump map). */
function grainTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const image = g.createImageData(size, size)
  const random = seededRandom(12345)
  for (let i = 0; i < size * size; i++) {
    const value = 110 + random() * 145
    image.data.set([value, value, value, 255], i * 4)
  }
  g.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

function tapeTexture(label: string, colour: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 72
  const g = canvas.getContext('2d')!
  g.fillStyle = colour
  g.fillRect(0, 0, 256, 72)
  g.fillStyle = '#ffffff'
  g.font = '700 40px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, 128, 38)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A flat quad through four world corners, with texture coordinates 0..1 across and up. */
function quad(corners: Vec[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  return geometry
}

/** A crash mat: its top, front and sides down to the floor (the back is against the wall). */
function matGeometry(top: Vec[]): THREE.BufferGeometry {
  const floor = top.map(([x, , z]): Vec => [x, 0, z])
  const [t0, t1, t2, t3] = top
  const [b0, b1, b2, b3] = floor
  const faces = [
    [t0, t1, t2, t3],
    [t3, t2, b2, b3],
    [t0, t3, b3, b0],
    [t1, b1, b2, t2],
  ]
  const positions = faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d].flat())
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

export class WallScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera()
  private readonly wall = new THREE.Group()
  private readonly holds = new THREE.Group()
  private readonly sun: THREE.DirectionalLight
  private readonly grain = grainTexture()
  private readonly holdMaterials = new Map<string, THREE.MeshStandardMaterial>()
  // Just a small dark dot where the bolt goes; holds don't need more detail than that.
  private readonly bolt = new THREE.CircleGeometry(0.06, 16)
  private readonly boltMaterial = new THREE.MeshBasicMaterial({ color: '#1d1b19', polygonOffset: true, polygonOffsetFactor: -2 })
  private wallKey = ''
  private frame: number | undefined
  private size = { width: 0, height: 0 }
  private sharpness = 1
  private holdsKey: unknown[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // Nothing in the scene moves when you look around, so shadows are only redrawn after changes.
    this.renderer.shadowMap.autoUpdate = false

    this.scene.background = new THREE.Color(BACKDROP)
    this.scene.fog = new THREE.Fog(BACKDROP, 14, 40)
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#3d4148', 1.15))
    // The key light comes from the upper left, in front of the wall.
    this.sun = new THREE.DirectionalLight('#fff8ee', 2.6)
    this.sun.position.set(-2.5, 7.5, 8)
    this.sun.target.position.set(WALL_WIDTH_M / 2, 1.8, 0)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.015
    this.scene.add(this.sun, this.sun.target)
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.45)
    fill.position.set(10, 3, 7)
    this.scene.add(fill)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: '#3a3e45', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.002
    floor.receiveShadow = true
    this.scene.add(floor, this.wall, this.holds)
  }

  /** Builds the panels and mats for this wall shape (skipped if it hasn't changed). */
  setWall(view: WallView, key: string) {
    if (key === this.wallKey) return
    this.wallKey = key
    this.clear(this.wall, true)
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    for (const panel of view.panels) {
      const material = new THREE.MeshStandardMaterial({ map: plywoodTexture(panel, anisotropy), roughness: 0.92, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(quad(view.corners(panel)), material)
      mesh.receiveShadow = true
      this.wall.add(mesh)
    }
    const matMaterial = new THREE.MeshStandardMaterial({ color: '#4d6a8a', roughness: 0.8, side: THREE.DoubleSide })
    const seams: number[] = []
    for (const mat of view.mats()) {
      const mesh = new THREE.Mesh(matGeometry(mat.top), matMaterial)
      mesh.receiveShadow = true
      this.wall.add(mesh)
      for (const [a, b] of mat.seams) seams.push(a[0], MAT_HEIGHT + 0.003, a[2], b[0], MAT_HEIGHT + 0.003, b[2])
    }
    const seamGeometry = new THREE.BufferGeometry()
    seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seams, 3))
    this.wall.add(new THREE.LineSegments(seamGeometry, new THREE.LineBasicMaterial({ color: '#141c24' })))
    this.renderer.shadowMap.needsUpdate = true
  }

  /** Places the route's holds, other routes' holds and the tape (skipped if none of them changed). */
  setHolds(view: WallView, route: SceneHold[], colour: string, others: (SceneHold & { colour: string })[], tapes: Tape[]) {
    const key = [route, colour, others, tapes, this.wallKey]
    if (key.every((part, i) => part === this.holdsKey[i])) return
    this.holdsKey = key
    this.clear(this.holds, false)
    for (const hold of route) this.addHold(view, hold, colour)
    // Other routes' holds are toned towards the wall's colour so the route stands out.
    for (const hold of others) this.addHold(view, hold, mixColour(hold.colour, PLYWOOD, 0.5))
    for (const tape of tapes) this.addTape(view, tape)
    this.renderer.shadowMap.needsUpdate = true
  }

  /** Forgets which holds are placed, so the next setHolds builds them again (e.g. with new models). */
  refreshHolds() {
    this.holdsKey = []
  }

  /** Copies the view's camera: same eye, direction and projection. */
  setView(view: WallView) {
    const { eye, forward, scale, offset, width, height } = view.cameraSetup()
    this.camera.position.set(...eye)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(eye[0] + forward[0], eye[1] + forward[1], eye[2] + forward[2])
    this.camera.updateMatrixWorld()
    const [near, far] = [0.05, 150]
    // Maps camera space to the same drawing units as view.toScreen, then to clip space.
    this.camera.projectionMatrix.set(
      (2 * scale) / width, 0, 1 - (2 * offset.x) / width, 0,
      0, (2 * scale) / height, (2 * offset.y) / height - 1, 0,
      0, 0, -(far + near) / (far - near), (-2 * far * near) / (far - near),
      0, 0, -1, 0,
    )
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
  }

  resize(width: number, height: number) {
    this.size = { width, height }
    this.renderer.setSize(width, height, false)
  }

  /**
   * Draws at a fraction of full resolution (1 is full): lower while the view is moving keeps
   * dragging smooth on slower devices, and the sharp picture comes back when it stops.
   */
  setSharpness(sharpness: number) {
    if (sharpness === this.sharpness) return
    this.sharpness = sharpness
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * sharpness)
    this.renderer.setSize(this.size.width, this.size.height, false)
  }

  /** Draws on the next animation frame; several changes within one frame are drawn once. */
  render() {
    if (this.frame !== undefined) return
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined
      this.renderer.render(this.scene, this.camera)
    })
  }

  dispose() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.clear(this.wall, true)
    this.clear(this.holds, false)
    this.grain.dispose()
    this.bolt.dispose()
    this.boltMaterial.dispose()
    for (const material of this.holdMaterials.values()) material.dispose()
    this.renderer.dispose()
  }

  /** The hold's frame on the wall: across, up and out of its panel, turned by its rotation and sized in metres. */
  private placeOnWall(view: WallView, hold: SceneHold, radius: number, out = 0): THREE.Matrix4 {
    const spot = view.place(hold.x, hold.y)
    const panel = view.panelAt(hold.x * WALL_WIDTH_M, (1 - hold.y) * WALL_LENGTH_M)
    const across = vector(panel.eu)
    const up = vector(panel.ev)
    const normal = vector(cross(panel.eu, panel.ev)).normalize()
    const position = vector(spot.world).addScaledVector(normal, out)
    // Rotations are clockwise as seen on the wall; with y up that is a negative turn about z.
    return new THREE.Matrix4()
      .makeBasis(across, up, normal)
      .setPosition(position)
      .multiply(new THREE.Matrix4().makeRotationZ((-hold.rotation * Math.PI) / 180))
      .multiply(new THREE.Matrix4().makeScale(radius, radius, radius))
  }

  private material(colour: string): THREE.MeshStandardMaterial {
    let material = this.holdMaterials.get(colour)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.68, bumpMap: this.grain, bumpScale: 1.5, side: THREE.DoubleSide, vertexColors: true })
      this.holdMaterials.set(colour, material)
    }
    return material
  }

  private addHold(view: WallView, hold: SceneHold, colour: string) {
    const radius = RADIUS[hold.size] * WALL_WIDTH_M
    const model = holdModel(hold.type, variantIndex(hold.x, hold.y, VARIANTS))
    const group = new THREE.Group()
    group.matrixAutoUpdate = false
    group.matrix.copy(this.placeOnWall(view, hold, radius))
    const mesh = new THREE.Mesh(model.geometry, this.material(colour))
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    if (model.bolt) {
      const bolt = new THREE.Mesh(this.bolt, this.boltMaterial)
      bolt.position.copy(model.bolt).setZ(model.bolt.z + 0.003)
      group.add(bolt)
    }
    this.holds.add(group)
  }

  private addTape(view: WallView, tape: Tape) {
    const radius = RADIUS[tape.hold.size] * WALL_WIDTH_M
    // Just below the hold, tilted a little like hand-stuck tape, and kept on the hold's own face
    // (so it doesn't hang off an arête or a roof's lip).
    const panel = view.panelAt(tape.hold.x * WALL_WIDTH_M, (1 - tape.hold.y) * WALL_LENGTH_M)
    const u = Math.min(Math.max(tape.hold.x * WALL_WIDTH_M, panel.u0 + TAPE_M[0] / 2 + 0.02), panel.u1 - TAPE_M[0] / 2 - 0.02)
    const v = Math.max((1 - tape.hold.y) * WALL_LENGTH_M - radius - 0.08, panel.v0 + TAPE_M[1])
    const below = { ...tape.hold, x: u / WALL_WIDTH_M, y: 1 - v / WALL_LENGTH_M, rotation: -6 }
    const material = new THREE.MeshStandardMaterial({ map: tapeTexture(tape.label, tape.colour), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...TAPE_M), material)
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(this.placeOnWall(view, below, 1, 0.003))
    mesh.receiveShadow = true
    this.holds.add(mesh)
  }

  /** Empties a group, freeing what was made for it (hold meshes share cached geometry, so that stays). */
  private clear(group: THREE.Group, ownsGeometry: boolean) {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        if (ownsGeometry || object.geometry.type === 'PlaneGeometry') object.geometry.dispose()
        const material = object.material as THREE.Material & { map?: THREE.Texture | null }
        // Wall and tape materials belong to one mesh each; hold materials are shared and kept.
        if (ownsGeometry || material.map) {
          material.map?.dispose()
          material.dispose()
        }
      }
    })
    group.clear()
  }
}
