import { useEffect, useRef, useState } from 'react'
import type { WallView } from '../wallPerspective'
import { loadCustomHolds } from './customHolds'
import { setCustomHolds } from './holdGeometry'
import { WallScene, type SceneHold, type Tape } from './wallScene'

type Props = {
  view: WallView
  /** Changes when the wall's shape does (type and angle), so panels are only rebuilt then. */
  wallKey: string
  holds: SceneHold[]
  colour: string
  others: (SceneHold & { colour: string })[]
  tapes: Tape[]
  /** True while the view is being dragged, pinched or animated: drawn at lower resolution meanwhile. */
  moving: boolean
  /** Called once the first 3D picture is on screen. */
  onReady: () => void
}

/** The wall drawn in 3D with three.js; loaded on demand so other pages don't pay for it. */
export default function Wall3D({ view, wallKey, holds, colour, others, tapes, moving, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<WallScene | null>(null)
  const readyRef = useRef(onReady)

  useEffect(() => {
    readyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const canvas = canvasRef.current!
    const scene = new WallScene(canvas)
    sceneRef.current = scene
    const resize = new ResizeObserver(([entry]) => {
      scene.resize(entry.contentRect.width, entry.contentRect.height)
      scene.render()
    })
    resize.observe(canvas)
    return () => {
      resize.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // Hold models added in public/holds replace the built-in shapes once they've loaded.
  const [customVersion, setCustomVersion] = useState(0)
  useEffect(() => {
    let current = true
    loadCustomHolds().then((models) => {
      if (!current || models.size === 0) return
      setCustomHolds(models)
      sceneRef.current?.refreshHolds()
      setCustomVersion((version) => version + 1)
    })
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setSharpness(moving ? 0.6 : 1)
    scene.setWall(view, wallKey)
    scene.setHolds(view, holds, colour, others, tapes)
    scene.setView(view)
    scene.render()
    readyRef.current()
  }, [view, wallKey, holds, colour, others, tapes, moving, customVersion])

  return <canvas ref={canvasRef} className="route-wall-canvas" aria-hidden="true" />
}
