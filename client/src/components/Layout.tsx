import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ROLE_LABELS } from '../../../shared/src/index.ts'
import { useAuth } from '../auth/useAuth.ts'
import { SiteFooter } from './SiteFooter.tsx'

const publicLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About', end: false },
  { to: '/gallery', label: 'Gallery', end: false },
  { to: '/visit', label: 'Visit Information', end: false },
  { to: '/announcements', label: 'Announcements', end: false },
  { to: '/tours', label: 'Tours', end: false },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, ready, signOut, signingOut, finishSignOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

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
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className={menuOpen ? 'site-header menu-open' : 'site-header'}>
        <div className="wrap header-bar">
          <NavLink className="brand" to="/" end>
            <span className="brand-mark" aria-hidden="true">
              AJ
            </span>
            <span>
              <strong>Abba Jifar Palace</strong>
              <small>Jimma, Ethiopia</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <nav id="primary-nav" aria-label="Primary" onClick={() => setMenuOpen(false)}>
            {publicLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
            {ready && user?.role === 'administrator' && <NavLink to="/admin">Administration</NavLink>}
            {ready && user?.role === 'tour_guide' && <NavLink to="/guide">Assigned tours</NavLink>}
            {ready && user?.role === 'receptionist' && <NavLink to="/reception">Reception</NavLink>}
            {ready && user && <NavLink to="/account">Profile</NavLink>}
            {ready && !user && <NavLink to="/login">Sign in</NavLink>}
            {ready && !user && (
              <NavLink className="nav-register" to="/register">
                Register
              </NavLink>
            )}
            {ready && user && (
              <button type="button" onClick={() => void handleSignOut()}>
                Sign out
              </button>
            )}
          </nav>
        </div>
      </header>
      {ready && user && (
        <p className="signed-in">
          Signed in as {user.fullName} · {ROLE_LABELS[user.role]}
        </p>
      )}
      <main id="content">{children}</main>
      <SiteFooter />
    </div>
  )
}
