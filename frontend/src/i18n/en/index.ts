import app from './app'
import auth from './auth'
import logbook from './logbook'
import gymMap from './gymMap'
import board from './board'
import setting from './setting'
import training from './training'
import landing from './landing'

/** All English text, by feature. Dutch must have exactly the same keys. */
const en = {
  ...app,
  ...auth,
  ...logbook,
  ...gymMap,
  ...board,
  ...training,
  ...setting,
  ...landing,
}

export default en
