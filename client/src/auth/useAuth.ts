import { createContext, useContext } from 'react'
import type { PublicUser } from '../../../shared/src/index.ts'

export interface AuthState {
  user: PublicUser | null
  ready: boolean
  signingOut: boolean
  setUser: (user: PublicUser | null) => void
  finishSignOut: () => void
  signOut: () => Promise<string | undefined>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }
  return value
}
