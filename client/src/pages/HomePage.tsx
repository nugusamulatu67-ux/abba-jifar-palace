import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HealthResponse } from '../../../shared/src/index.ts'
import { useAuth } from '../auth/useAuth.ts'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; health: HealthResponse }
  | { kind: 'error'; message: string }

export function HomePage() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        const health = (await response.json()) as HealthResponse
        if (!response.ok && response.status !== 503) {
          throw new Error(`Health check failed (${response.status})`)
        }
        setState({ kind: 'ready', health })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        const message = error instanceof Error ? error.message : 'Could not reach the API.'
        setState({ kind: 'error', message })
      })

    return () => controller.abort()
  }, [])

  return (
    <>
      <p className="eyebrow">Heritage site · Jimma</p>
      <h1>Tour booking and visitor management</h1>
      <p className="lede">
        Plan a visit to Abba Jifar Palace. Tourists can create an account and sign in. Staff areas
        stay closed until an administrator creates those accounts.
      </p>
      <p className="actions">
        {user ? (
          <Link className="button" to="/account">
            View your profile
          </Link>
        ) : (
          <>
            <Link className="button" to="/register">
              Create a tourist account
            </Link>
            <Link className="button secondary" to="/login">
              Sign in
            </Link>
          </>
        )}
      </p>

      <section aria-live="polite">
        <h2>API health</h2>
        {state.kind === 'loading' && <p>Checking the API…</p>}
        {state.kind === 'error' && (
          <p className="status bad" role="alert">
            {state.message}. Start the API with <code>npm run dev:server</code>, then refresh.
          </p>
        )}
        {state.kind === 'ready' && (
          <dl>
            <div>
              <dt>Status</dt>
              <dd className={state.health.status === 'ok' ? 'status ok' : 'status bad'}>{state.health.status}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{state.health.service}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd className={state.health.database.status === 'connected' ? 'status ok' : 'status bad'}>
                {state.health.database.status}
              </dd>
            </div>
            <div>
              <dt>Detail</dt>
              <dd>{state.health.database.message}</dd>
            </div>
            <div>
              <dt>Checked at</dt>
              <dd>{state.health.time}</dd>
            </div>
          </dl>
        )}
      </section>
    </>
  )
}
