import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { PublicTourDetail } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { PageIntro } from '../components/PageIntro.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { useAuth } from '../auth/useAuth.ts'
import { formatDuration, formatPrice, formatWhen } from '../format.ts'

export function TourDetailPage() {
  const { id } = useParams()
  const { user, ready } = useAuth()
  const [tour, setTour] = useState<PublicTourDetail | null>(null)
  const [error, setError] = useState('')
  usePageTitle(tour?.name ?? 'Tour')

  useEffect(() => {
    const controller = new AbortController()
    api<{ package: PublicTourDetail }>(`/api/tours/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That tour is not available.')
          return
        }
        setTour(result.data.package)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That tour is not available.')
      })
    return () => controller.abort()
  }, [id])

  return (
    <>
      <PageIntro
        eyebrow={tour?.category ?? 'Tours'}
        title={tour?.name ?? 'Tour'}
        lede={tour?.description ?? 'Loading the tour details.'}
      />
      <section className="band">
        <div className="wrap">
          <p>
            <Link to="/tours">All tours</Link>
          </p>
          {error && (
            <p className="status bad" role="alert">
              {error}
            </p>
          )}
          {!tour && !error && <p>Loading tour…</p>}
          {tour && (
            <>
              <dl className="facts">
                <div>
                  <dt>Price</dt>
                  <dd>{formatPrice(tour.priceEtb)}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDuration(tour.durationMinutes)}</dd>
                </div>
                <div>
                  <dt>Group size</dt>
                  <dd>{tour.maxGroupSize ? `Up to ${tour.maxGroupSize} visitors` : 'Set on each departure'}</dd>
                </div>
                <div>
                  <dt>Included</dt>
                  <dd>{tour.includedActivities || 'Listed with the guide on the day.'}</dd>
                </div>
              </dl>
              <h2>Upcoming departures</h2>
              {tour.schedules.length === 0 && <p>There is no open departure for this tour yet.</p>}
              {tour.schedules.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Seats left</th>
                        <th>Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tour.schedules.map((schedule) => {
                        const bookPath = `/tours/${tour.id}/book?schedule=${schedule.id}`
                        return (
                          <tr key={schedule.id}>
                            <td>
                              {formatWhen(schedule.startsAt)} – {formatWhen(schedule.endsAt)}
                            </td>
                            <td>
                              {schedule.remainingCapacity} of {schedule.maxCapacity}
                            </td>
                            <td>
                              {schedule.bookable && ready && user && (
                                <Link className="button" to={bookPath}>
                                  Book
                                </Link>
                              )}
                              {schedule.bookable && ready && !user && (
                                <Link className="button" to="/login" state={{ from: bookPath }}>
                                  Sign in to book
                                </Link>
                              )}
                              {schedule.bookable && !ready && <span className="muted">Checking account…</span>}
                              {!schedule.bookable && <span className="muted">Full</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {ready && !user && (
                <p className="section-intro">
                  New visitor? <Link to="/register">Create a tourist account</Link>. Booking itself opens in the next phase.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}
