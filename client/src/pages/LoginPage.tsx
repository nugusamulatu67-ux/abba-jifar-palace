import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { PublicUser } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { useAuth } from '../auth/useAuth.ts'
import { homeForRole } from './destinations.ts'

export function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const requested = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const result = await api<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Sign-in failed.')
      return
    }
    setUser(result.data.user)
    navigate(requested && requested !== '/login' ? requested : homeForRole(result.data.user.role))
  }

  return (
    <>
      <p className="eyebrow">Account</p>
      <h1>Sign in</h1>
      <p className="lede">Use the email and password for your palace account.</p>
      <form className="panel form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {error && (
          <p className="status bad" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="login-email">
          Email
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label htmlFor="login-password">
          Password
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="form-note">
          New visitor? <Link to="/register">Create a tourist account</Link>
        </p>
      </form>
    </>
  )
}
