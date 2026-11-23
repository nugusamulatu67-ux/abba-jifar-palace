import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth.ts'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready, signingOut } = useAuth()
  const location = useLocation()

  if (!ready) {
    return <p className="muted">Checking your session…</p>
  }

  if (!user) {
    if (signingOut) {
      return null
    }
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return children
}
