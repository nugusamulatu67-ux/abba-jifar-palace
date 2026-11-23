import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BookingView } from '../../../../shared/src/index.ts'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'
import { formatPrice, formatWhen } from '../../format.ts'

export function AdminBookingListPage() {
  usePageTitle('Bookings')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [bookings, setBookings] = useState<BookingView[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (search.trim()) {
      params.set('q', search.trim())
    }
    if (status) {
      params.set('status', status)
    }
    if (date) {
      params.set('date', date)
    }
    const query = params.size > 0 ? `?${params.toString()}` : ''
    api<{ bookings: BookingView[] }>(`/api/admin/bookings${query}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Bookings could not be loaded.')
          setBookings([])
          return
        }
        setError('')
        setBookings(result.data.bookings)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Bookings could not be loaded.')
      })
    return () => controller.abort()
  }, [search, status, date])

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Bookings</h1>
      <p className="lede">Reservations stay unpaid until the palace records a payment in a later phase.</p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Reference or name
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Tour date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </form>
      {bookings === null && <p>Loading bookings…</p>}
      {bookings?.length === 0 && <p>No bookings match this filter.</p>}
      {bookings && bookings.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Tour</th>
                <th>When</th>
                <th>Visitors</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.reference}>
                  <td>
                    <Link to={`/admin/bookings/${booking.reference}`}>{booking.reference}</Link>
                  </td>
                  <td>{booking.packageName}</td>
                  <td>{formatWhen(booking.startsAt)}</td>
                  <td>{booking.partySize}</td>
                  <td>{formatPrice(booking.totalEtb)}</td>
                  <td>{booking.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AdminBookingDetailPage() {
  const { reference } = useParams()
  usePageTitle(reference ? `Booking ${reference}` : 'Booking')
  const [booking, setBooking] = useState<BookingView | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api<{ booking: BookingView }>(`/api/admin/bookings/${reference}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That booking was not found.')
          return
        }
        setBooking(result.data.booking)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That booking was not found.')
      })
    return () => controller.abort()
  }, [reference])

  async function run(action: 'confirm' | 'cancel') {
    if (!booking) {
      return
    }
    setPending(true)
    setError('')
    const result = await api<{ booking: BookingView }>(`/api/admin/bookings/${booking.reference}/${action}`, {
      method: 'POST',
    })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The booking could not be updated.')
      return
    }
    setBooking(result.data.booking)
    setConfirming(false)
    setNotice(action === 'confirm' ? 'Booking confirmed. Payment is still unpaid.' : 'Booking cancelled.')
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>{booking ? booking.reference : 'Booking'}</h1>
      <p>
        <Link to="/admin/bookings">All bookings</Link>
      </p>
      {notice && <p className="status ok">{notice}</p>}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!booking && !error && <p>Loading booking…</p>}
      {booking && (
        <section className="panel">
          <dl className="facts">
            <div>
              <dt>Tour</dt>
              <dd>{booking.packageName}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatWhen(booking.startsAt)} – {formatWhen(booking.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Visitors</dt>
              <dd>{booking.partySize}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatPrice(booking.totalEtb)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{booking.status}</dd>
            </div>
          </dl>
          <div className="actions">
            {booking.canConfirm && (
              <button className="button" type="button" disabled={pending} onClick={() => void run('confirm')}>
                Confirm booking
              </button>
            )}
            {booking.canCancel && !confirming && (
              <button className="button secondary" type="button" onClick={() => setConfirming(true)}>
                Cancel booking
              </button>
            )}
          </div>
          {confirming && (
            <div>
              <p>Cancel this booking and release the seats? The record stays in the history.</p>
              <div className="actions">
                <button className="button" type="button" disabled={pending} onClick={() => void run('cancel')}>
                  {pending ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
                <button className="button secondary" type="button" onClick={() => setConfirming(false)}>
                  Keep booking
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
