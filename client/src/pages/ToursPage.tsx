import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PublicTourPackage } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { PageIntro } from '../components/PageIntro.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatDuration, formatPrice, formatWhen } from '../format.ts'

export function ToursPage() {
  usePageTitle('Tours')
  const [packages, setPackages] = useState<PublicTourPackage[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ packages: PublicTourPackage[] }>('/api/tours', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'The tours could not be loaded.')
          return
        }
        setPackages(result.data.packages)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('The tours could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  return (
    <>
      <PageIntro
        eyebrow="Tours"
        title="Available tours"
        lede="These are the palace tours that are open for visitors. Choose a tour to see the price, what is included, and the upcoming departures."
      />
      <section className="band">
        <div className="wrap">
          {error && (
            <p className="status bad" role="alert">
              {error}
            </p>
          )}
          {packages === null && !error && <p>Loading tours…</p>}
          {packages?.length === 0 && <p>No tours are open at the moment.</p>}
          {packages && packages.length > 0 && (
            <div className="card-grid">
              {packages.map((tour) => (
                <article key={tour.id} className="info-card">
                  <p className="eyebrow">{tour.category}</p>
                  <h2>{tour.name}</h2>
                  <p>{tour.description}</p>
                  <p>
                    <strong>{formatPrice(tour.priceEtb)}</strong>
                    <span className="muted"> · {formatDuration(tour.durationMinutes)}</span>
                  </p>
                  <p className="muted">
                    {tour.upcomingCount > 0 && tour.nextStartsAt
                      ? `${tour.upcomingCount} upcoming · next ${formatWhen(tour.nextStartsAt)}`
                      : 'No upcoming departure'}
                  </p>
                  <Link className="button" to={`/tours/${tour.id}`}>
                    View tour
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
