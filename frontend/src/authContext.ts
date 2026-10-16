import { createContext, useContext } from 'react'
import type { User } from './types'

export type AuthContextValue = {
  user: User | null
  /** False until we know whether a session cookie exists. */
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
