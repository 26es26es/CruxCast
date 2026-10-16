// Whether this browser can draw the 3D wall. Kept apart from the 3D code so checking it
// doesn't load three.js; without WebGL the wall falls back to the flat drawing.

let supported: boolean | undefined

export function canDraw3d(): boolean {
  if (supported === undefined) {
    try {
      supported = Boolean(document.createElement('canvas').getContext('webgl2'))
    } catch {
      supported = false
    }
  }
  return supported
}
