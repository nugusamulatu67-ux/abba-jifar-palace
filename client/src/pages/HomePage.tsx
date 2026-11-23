import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HealthResponse } from '../../../shared/src/index.ts'
import { PhotoFrame } from '../components/PhotoFrame.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { VerifyNote } from '../components/VerifyNote.tsx'
import { gallerySlots, tourThemes, verifiedFacts } from '../content/publicSite.ts'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; health: HealthResponse }
  | { kind: 'error'; message: string }

export function HomePage() {
  usePageTitle('Home')
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
      <section className="hero">
        <div className="wrap hero-copy">
          <p className="eyebrow light">Jimma, Ethiopia</p>
          <h1>Abba Jifar Palace</h1>
          <p className="lede">
            A historical heritage site. This website introduces the palace and the tours visitors will be able to book.
          </p>
          <p className="actions">
            <Link className="button light" to="/tours">
              Explore tours
            </Link>
            <Link className="button ghost" to="/visit">
              Plan a visit
            </Link>
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap split">
          <div>
            <p className="eyebrow">Introduction</p>
            <h2>A palace website for visitors</h2>
            <p>
              The project documents describe one place: Abba Jifar Palace, a historical heritage site in Jimma, Ethiopia.
              People will use this site to learn about the palace, create a tourist account, and later reserve a tour.
            </p>
          </div>
          <dl className="fact-list">
            {verifiedFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="band band-paper">
        <div className="wrap">
          <p className="eyebrow">History</p>
          <h2>What can be said today</h2>
          <p className="section-intro">
            A short historical introduction belongs here. The documents do not yet include a verified history, so the
            passage below is held until it can be checked.
          </p>
          <VerifyNote purpose="A verified historical introduction is not in the project documents." />
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Photographs</p>
              <h2>The palace in pictures</h2>
            </div>
            <Link to="/gallery">Open the gallery</Link>
          </div>
          <div className="frame-grid">
            {gallerySlots.slice(0, 3).map((item) => (
              <PhotoFrame key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="band band-paper">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tours</p>
              <h2>Ways to see the palace</h2>
            </div>
            <Link to="/tours">View tour themes</Link>
          </div>
          <p className="section-intro">
            These descriptions are already stored for development. Booking, dates, and prices are not part of this page.
          </p>
          <div className="card-grid">
            {tourThemes.map((tour) => (
              <article key={tour.name} className="info-card">
                <h3>{tour.name}</h3>
                <p>{tour.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <p className="eyebrow">Significance</p>
          <h2>Why the visit matters</h2>
          <div className="card-grid">
            <article className="info-card">
              <h3>A heritage site</h3>
              <p>The project identifies Abba Jifar Palace as a historical heritage site in Jimma, Ethiopia.</p>
            </article>
            <article className="info-card">
              <h3>Tours for visitors</h3>
              <p>Guided visits are planned around the palace, with a slower museum and garden walk among the themes.</p>
            </article>
            <article className="info-card">
              <h3>Still to be written</h3>
              <VerifyNote purpose="Cultural significance beyond the heritage-site description is not documented here yet." />
            </article>
          </div>
        </div>
      </section>

      <section className="band band-tight" aria-live="polite">
        <div className="wrap status-row">
          <h2>Site status</h2>
          {state.kind === 'loading' && <p>Checking the API…</p>}
          {state.kind === 'error' && (
            <p className="status bad" role="alert">
              {state.message}
            </p>
          )}
          {state.kind === 'ready' && (
            <p>
              <span className={state.health.status === 'ok' ? 'status ok' : 'status bad'}>{state.health.status}</span>
              {' · '}
              Database{' '}
              <span className={state.health.database.status === 'connected' ? 'status ok' : 'status bad'}>
                {state.health.database.status}
              </span>
            </p>
          )}
        </div>
      </section>
    </>
  )
}
