import { useEffect, useState } from 'react'
import { api } from './api'
import { errorMessage } from './i18n'
import type { GymMap } from './types'

// The backend refreshes from TopLogger every 10 minutes; ask again after that.
const MAX_AGE_MS = 10 * 60 * 1000

// Shared across components so the map is fetched once, not per component.
let cached: { request: Promise<GymMap>; at: number } | null = null

function loadGymMap(): Promise<GymMap> {
  if (!cached || Date.now() - cached.at > MAX_AGE_MS) {
    cached = { request: api.getGymMap(), at: Date.now() }
  }
  return cached.request
}

export function useGymMap(): { map: GymMap | null; error: string | null } {
  const [state, setState] = useState<{ map: GymMap | null; error: string | null }>({
    map: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    loadGymMap()
      .then((map) => active && setState({ map, error: null }))
      .catch((caught) => {
        cached = null
        if (active) setState({ map: null, error: errorMessage(caught) })
      })
    return () => {
      active = false
    }
  }, [])

  return state
}

/** "5 minutes ago", in the current language. */
export function timeAgo(iso: string, language: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}
