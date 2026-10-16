import type { CSSProperties } from 'react'

/** Inline CSS custom properties (e.g. `--type-colour`), which React's style type doesn't know. */
export function cssVars(vars: Record<`--${string}`, string | number | undefined>): CSSProperties {
  return vars as CSSProperties
}
