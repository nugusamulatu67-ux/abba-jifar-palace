import { useEffect, useState } from 'react'
import { ROLE_LABELS, type PublicUser } from '../../../shared/src/index.ts'
import { api } from '../api.ts'

export function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    api<{ user: PublicUser }>('/api/auth/me', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Could not load your profile.')
          return
        }
        setUser(result.data.user)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  return (
    <>
      <p className="eyebrow">Your account</p>
      <h1>Profile</h1>
      {loading && <p>Loading your profile…</p>}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {user && (
        <section>
          <h2>{user.fullName}</h2>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={user.status === 'active' ? 'status ok' : 'status bad'}>{user.status}</dd>
            </div>
          </dl>
        </section>
      )}
    </>
  )
}
