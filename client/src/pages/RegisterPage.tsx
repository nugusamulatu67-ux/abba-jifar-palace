import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { PublicUser } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { useAuth } from '../auth/useAuth.ts'

export function RegisterPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const requested = (location.state as { from?: string } | null)?.from
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = fullName.trim()
    if (trimmedName.length < 2) {
      setError('Enter a full name of at least 2 characters.')
      return
    }
    if (password.length < 8 || password.length > 72) {
      setError('Password must be 8 to 72 characters.')
      return
    }
    setError('')
    setPending(true)
    const result = await api<{ user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: trimmedName,
        email,
        password,
        phone: phone.trim() || undefined,
      }),
    })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Registration failed.')
      return
    }
    setUser(result.data.user)
    navigate(requested && requested.startsWith('/') ? requested : '/account')
  }

  return (
    <>
      <p className="eyebrow">Tourist account</p>
      <h1>Create an account</h1>
      <p className="lede">Registration is for visitors. Staff accounts are created by an administrator.</p>
      <form className="panel form" onSubmit={(event) => void handleSubmit(event)}>
        {error && (
          <p className="status bad" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="register-name">
          Full name
          <input
            id="register-name"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <label htmlFor="register-email">
          Email
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label htmlFor="register-phone">
          Phone <span className="optional">(optional)</span>
          <input
            id="register-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label htmlFor="register-password">
          Password
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-describedby="password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <p id="password-hint" className="form-note">
          Use 8 to 72 characters.
        </p>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
        <p className="form-note">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </>
  )
}
