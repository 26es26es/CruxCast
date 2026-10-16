import type { Colour, Grade } from '../constants'
import { useClimbLabel } from '../gymMap'

type Props = {
  colour: Colour
  /** The dot's colour, e.g. the gym's exact hold colour. */
  colourHex: string
  grade: Grade | null | ''
  wall: string | null
}

/** "● Purple 5B on Atlas": a climb picked on the gym map. */
export function ClimbName({ colour, colourHex, grade, wall }: Props) {
  const label = useClimbLabel()
  return (
    <span className="map-selection">
      <span className="colour-dot" style={{ background: colourHex }} />
      {label({ colour, grade, wall })}
    </span>
  )
}
