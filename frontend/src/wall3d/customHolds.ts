import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { HoldType } from '../setting'
import { HOLDS_FOLDER, holdManifest, type Axis } from './holdManifest'

const AXES: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
  '-x': new THREE.Vector3(-1, 0, 0),
  '-y': new THREE.Vector3(0, -1, 0),
  '-z': new THREE.Vector3(0, 0, -1),
}

/**
 * Turns a downloaded model into the same frame as the built-in holds: gripping side up (+y),
 * back flat on the wall (z = 0), centred, and one unit in radius.
 */
function fitToHoldFrame(geometry: THREE.BufferGeometry, up: Axis, out: Axis): THREE.BufferGeometry {
  const upAxis = AXES[up]
  const outAxis = AXES[out]
  const across = new THREE.Vector3().crossVectors(upAxis, outAxis)
  // Rows are where each of our axes comes from in the model.
  geometry.applyMatrix4(new THREE.Matrix4().set(...across.toArray(), 0, ...upAxis.toArray(), 0, ...outAxis.toArray(), 0, 0, 0, 0, 1))
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const half = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 2
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z)
  geometry.scale(1 / half, 1 / half, 1 / half)
  geometry.computeVertexNormals()
  return geometry
}

let loaded: Promise<Map<HoldType, THREE.BufferGeometry[]>> | undefined

/** The models from public/holds, by hold type (empty if none were added). Loaded once. */
export function loadCustomHolds(): Promise<Map<HoldType, THREE.BufferGeometry[]>> {
  loaded ??= holdManifest().then(async (entries) => {
    const loader = new STLLoader()
    const models = new Map<HoldType, THREE.BufferGeometry[]>()
    for (const entry of entries) {
      try {
        const geometry = await loader.loadAsync(HOLDS_FOLDER + entry.file)
        models.set(entry.type, [...(models.get(entry.type) ?? []), fitToHoldFrame(geometry, entry.up ?? 'y', entry.out ?? 'z')])
      } catch {
        // A missing or broken file just leaves that type with the built-in shapes.
      }
    }
    return models
  })
  return loaded
}
