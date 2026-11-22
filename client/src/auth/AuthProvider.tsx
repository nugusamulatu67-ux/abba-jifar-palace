import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { PublicUser } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { AuthContext, type AuthState } from './useAuth.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [ready, setReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api<{ user: PublicUser }>('/api/auth/me', { signal: controller.signal })
      .then((result) => {
        setUser(result.ok && result.data ? result.data.user : null)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setReady(true)
        }
      })

    return () => controller.abort()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      signingOut,
      setUser,
      finishSignOut() {
        setSigningOut(false)
      },
      async signOut() {
        const result = await api<{ message: string }>('/api/auth/logout', { method: 'POST' })
        setSigningOut(true)
        setUser(null)
        return result.ok ? undefined : result.error
      },
    }),
    [user, ready, signingOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
