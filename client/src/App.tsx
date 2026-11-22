import { useEffect, useState } from 'react'
import type { HealthResponse } from '../../shared/src/index.ts'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; health: HealthResponse }
  | { kind: 'error'; message: string }

export default function App() {
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
    <main>
      <p className="eyebrow">Abba Jifar Palace · Jimma, Ethiopia</p>
      <h1>Tour booking and visitor management</h1>
      <p className="lede">
        Phase 1 placeholder. This page checks that the website can reach the API. Booking,
        sign-in, visitor records, payments, and the dashboard come in later phases.
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
              <dd className={state.health.status === 'ok' ? 'status ok' : 'status bad'}>
                {state.health.status}
              </dd>
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
    </main>
  )
}
