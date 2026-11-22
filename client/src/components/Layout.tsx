import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { ROLE_LABELS } from '../../../shared/src/index.ts'
import { useAuth } from '../auth/useAuth.ts'

export function Layout({ children }: { children: ReactNode }) {
  const { user, ready, signOut, signingOut, finishSignOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/' && signingOut) {
      finishSignOut()
    }
  }, [location.pathname, signingOut, finishSignOut])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="site">
      <header className="site-header">
        <NavLink className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            AJ
          </span>
          <span>
            <strong>Abba Jifar Palace</strong>
            <small>Jimma, Ethiopia</small>
          </span>
        </NavLink>
        <nav aria-label="Primary">
          <NavLink to="/">Home</NavLink>
          {ready && user?.role === 'administrator' && <NavLink to="/admin">Administration</NavLink>}
          {ready && user?.role === 'tour_guide' && <NavLink to="/guide">Assigned tours</NavLink>}
          {ready && user?.role === 'receptionist' && <NavLink to="/reception">Reception</NavLink>}
          {ready && user && <NavLink to="/account">Profile</NavLink>}
          {ready && !user && <NavLink to="/login">Sign in</NavLink>}
          {ready && !user && <NavLink to="/register">Register</NavLink>}
          {ready && user && (
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          )}
        </nav>
      </header>
      {ready && user && (
        <p className="signed-in">
          Signed in as {user.fullName} · {ROLE_LABELS[user.role]}
        </p>
      )}
      <main>{children}</main>
    </div>
  )
}
