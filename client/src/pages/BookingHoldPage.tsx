import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { PublicSchedule } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatWhen } from '../format.ts'

export function BookingHoldPage() {
  usePageTitle('Booking')
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get('schedule')
  const [schedule, setSchedule] = useState<PublicSchedule | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!scheduleId) {
      return
    }
    const controller = new AbortController()
    api<{ schedule: PublicSchedule }>(`/api/schedules/${scheduleId}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That departure is not available.')
          return
        }
        if (String(result.data.schedule.packageId) !== id) {
          setError('That departure does not belong to this tour.')
          return
        }
        setSchedule(result.data.schedule)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That departure is not available.')
      })
    return () => controller.abort()
  }, [id, scheduleId])

  return (
    <>
      <p className="eyebrow">Booking</p>
      <h1>Booking is not open yet</h1>
      <p className="lede">
        You are signed in. This page only confirms the departure you chose. It does not reserve a seat or take a payment.
      </p>
      {!scheduleId && (
        <p className="status bad" role="alert">
          Choose a departure from the tour page first.
        </p>
      )}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {scheduleId && !schedule && !error && <p>Checking the departure…</p>}
      {schedule && (
        <section className="panel">
          <p>
            {formatWhen(schedule.startsAt)} – {formatWhen(schedule.endsAt)}
          </p>
          <p>
            {schedule.remainingCapacity} of {schedule.maxCapacity} seats are still open.
          </p>
          <p className="status ok">Nothing has been reserved.</p>
        </section>
      )}
      <p>
        <Link to={`/tours/${id}`}>Back to the tour</Link>
      </p>
    </>
  )
}
