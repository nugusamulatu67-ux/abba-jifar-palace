import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { PublicTourDetail } from '../../../shared/src/index.ts'
import type { BookingView } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatDuration, formatPrice, formatWhen } from '../format.ts'

export function BookingPage() {
  usePageTitle('Book a tour')
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const scheduleId = Number(searchParams.get('schedule'))
  const navigate = useNavigate()
  const [tour, setTour] = useState<PublicTourDetail | null>(null)
  const [partySize, setPartySize] = useState('1')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

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

  const schedule = tour?.schedules.find((item) => item.id === scheduleId)
  const visitors = Number(partySize)
  const total = tour && Number.isInteger(visitors) && visitors > 0 ? tour.priceEtb * visitors : 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const result = await api<{ booking: BookingView }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ scheduleId, partySize: visitors }),
    })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The booking could not be saved.')
      return
    }
    navigate(`/account/bookings/${result.data.booking.reference}`, {
      state: { notice: 'Booking received. It stays pending until the palace confirms it.' },
    })
  }

  return (
    <>
      <p className="eyebrow">Booking</p>
      <h1>Reserve seats</h1>
      <p className="lede">
        Choose how many people are coming. The palace confirms the reservation. This page does not take payment.
      </p>
      <p>
        <Link to={`/tours/${id}`}>Back to the tour</Link>
      </p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!tour && !error && <p>Loading the departure…</p>}
      {tour && !schedule && <p className="status bad">Choose an open departure from the tour page.</p>}
      {tour && schedule && (
        <form className="panel form" onSubmit={(event) => void handleSubmit(event)}>
          <p>
            <strong>{tour.name}</strong>
          </p>
          <p>
            {formatWhen(schedule.startsAt)} – {formatWhen(schedule.endsAt)}
          </p>
          <p>
            {formatPrice(tour.priceEtb)} each · {formatDuration(tour.durationMinutes)} · {schedule.remainingCapacity} seats
            left
          </p>
          {!schedule.bookable && <p className="status bad">This departure is not open for booking.</p>}
          {schedule.bookable && (
            <>
              <label>
                Number of visitors
                <input
                  inputMode="numeric"
                  min={1}
                  max={schedule.remainingCapacity}
                  value={partySize}
                  onChange={(event) => setPartySize(event.target.value)}
                  required
                />
              </label>
              <p>
                Total due at the palace: <strong>{formatPrice(total)}</strong>
              </p>
              <button className="button" type="submit" disabled={pending}>
                {pending ? 'Reserving…' : 'Submit booking'}
              </button>
            </>
          )}
        </form>
      )}
    </>
  )
}
