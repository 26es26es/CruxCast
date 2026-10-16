import { useEffect, useState } from 'react'
import { errorMessage } from './i18n'

/**
 * Data fetched once and shared by every component that needs it, refetched after
 * `maxAgeMs` (never, by default). A failed fetch is forgotten so the next use retries.
 */
export class CachedResource<T> {
  private request: Promise<T> | null = null
  private fetchedAt = 0
  private readonly load: () => Promise<T>
  private readonly maxAgeMs: number

  constructor(load: () => Promise<T>, maxAgeMs = Infinity) {
    this.load = load
    this.maxAgeMs = maxAgeMs
  }

  get(): Promise<T> {
    if (!this.request || Date.now() - this.fetchedAt > this.maxAgeMs) {
      this.fetchedAt = Date.now()
      this.request = this.load().catch((error) => {
        this.request = null
        throw error
      })
    }
    return this.request
  }
}

/** Reads a CachedResource in a component: the data once loaded, or an error message. */
export function useCachedResource<T>(resource: CachedResource<T>): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null })

  useEffect(() => {
    let active = true
    resource
      .get()
      .then((data) => active && setState({ data, error: null }))
      .catch((caught) => active && setState({ data: null, error: errorMessage(caught) }))
    return () => {
      active = false
    }
  }, [resource])

  return state
}
