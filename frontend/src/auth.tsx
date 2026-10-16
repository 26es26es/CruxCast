import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, UNAUTHORIZED_EVENT } from './api'
import { AuthContext } from './authContext'
import type { User } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true))

    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setUser(await api.login(username, password))
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    setUser(await api.register(username, password))
  }, [])

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
  }, [])

  return (
    <AuthContext value={{ user, ready, login, register, logout }}>{children}</AuthContext>
  )
}
