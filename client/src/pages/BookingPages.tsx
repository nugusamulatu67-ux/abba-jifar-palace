import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { BookingView, PaymentView } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatPrice, formatWhen } from '../format.ts'

export function MyBookingsPage() {
  usePageTitle('My bookings')
  const [bookings, setBookings] = useState<BookingView[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ bookings: BookingView[] }>('/api/bookings', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Your bookings could not be loaded.')
          setBookings([])
          return
        }
        setBookings(result.data.bookings)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Your bookings could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  return (
    <>
      <p className="eyebrow">Your account</p>
      <h1>My bookings</h1>
      <p className="lede">These are the reservations on your account. Payment is made at the palace, not on this page.</p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {bookings === null && !error && <p>Loading bookings…</p>}
      {bookings?.length === 0 && (
        <p>
          You have no bookings yet. <Link to="/tours">Browse tours</Link>
        </p>
      )}
      {bookings && bookings.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Tour</th>
                <th>When</th>
                <th>Visitors</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.reference}>
                  <td>
                    <Link to={`/account/bookings/${booking.reference}`}>{booking.reference}</Link>
                  </td>
                  <td>{booking.packageName}</td>
                  <td>{formatWhen(booking.startsAt)}</td>
                  <td>{booking.partySize}</td>
                  <td>{booking.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function BookingDetailPage() {
  const { reference } = useParams()
  usePageTitle(reference ? `Booking ${reference}` : 'Booking')
  const location = useLocation()
  const navigate = useNavigate()
  const notice = (location.state as { notice?: string } | null)?.notice ?? ''
  const [booking, setBooking] = useState<BookingView | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api<{ booking: BookingView }>(`/api/bookings/${reference}`, { signal: controller.signal })
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

  async function cancelBooking() {
    if (!booking) {
      return
    }
    setPending(true)
    setError('')
    const result = await api<{ booking: BookingView }>(`/api/bookings/${booking.reference}/cancel`, { method: 'POST' })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The booking could not be cancelled.')
      return
    }
    setBooking(result.data.booking)
    setConfirming(false)
    navigate(`/account/bookings/${booking.reference}`, { replace: true, state: { notice: 'Booking cancelled. The seats are released.' } })
  }

  return (
    <>
      <p className="eyebrow">Your account</p>
      <h1>{booking ? booking.reference : 'Booking'}</h1>
      <p>
        <Link to="/account/bookings">All my bookings</Link>
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
              <dt>Amount</dt>
              <dd>{formatPrice(booking.totalEtb)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{statusText(booking.status)}</dd>
            </div>
          </dl>
          {booking.canCancel && !confirming && (
            <button className="button secondary" type="button" onClick={() => setConfirming(true)}>
              Cancel booking
            </button>
          )}
          {confirming && (
            <div className="no-print">
              <p>Cancel this booking? The seats go back to the departure, and the reservation stays in your history.</p>
              <div className="actions">
                <button className="button" type="button" disabled={pending} onClick={() => void cancelBooking()}>
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
      {booking && <PaymentPanel reference={booking.reference} />}
    </>
  )
}

function statusText(status: BookingView['status']): string {
  if (status === 'pending') {
    return 'Pending. The palace still needs to confirm it.'
  }
  if (status === 'confirmed') {
    return 'Confirmed by the palace.'
  }
  return 'Cancelled. The seats are no longer held.'
}

function PaymentPanel({ reference }: { reference: string }) {
  const [payment, setPayment] = useState<PaymentView | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ payment: PaymentView }>(`/api/payments/${reference}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Payment details could not be loaded.')
          return
        }
        setPayment(result.data.payment)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Payment details could not be loaded.')
      })
    return () => controller.abort()
  }, [reference])

  return (
    <section className="panel">
      <h2>Payment and ticket</h2>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!payment && !error && <p>Loading payment…</p>}
      {payment?.paymentStatus === 'unpaid' && (
        <p>Payment is due at the palace. This page cannot mark the booking as paid.</p>
      )}
      {payment?.paymentStatus === 'paid' && (
        <dl className="facts">
          <div>
            <dt>Payment</dt>
            <dd>Paid</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{methodLabel(payment.method)}</dd>
          </div>
          <div>
            <dt>Paid on</dt>
            <dd>{payment.paidAt ? formatWhen(payment.paidAt) : 'Recorded'}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatPrice(payment.amountEtb)}</dd>
          </div>
        </dl>
      )}
      {payment?.ticket?.status === 'valid' && payment.ticket.qrDataUrl && (
        <article className="ticket-sheet">
          <p className="eyebrow">Abba Jifar Palace</p>
          <h3>Entry ticket</h3>
          <dl className="facts">
            <div>
              <dt>Reference</dt>
              <dd>{payment.reference}</dd>
            </div>
            <div>
              <dt>Tour</dt>
              <dd>{payment.packageName}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatWhen(payment.startsAt)} – {formatWhen(payment.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Visitors</dt>
              <dd>{payment.partySize}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd>Valid</dd>
            </div>
          </dl>
          <img src={payment.ticket.qrDataUrl} alt="QR code for this palace ticket" />
          <p className="no-print">
            <button className="button secondary" type="button" onClick={() => window.print()}>
              Print ticket
            </button>
          </p>
        </article>
      )}
      {payment?.ticket?.status === 'void' && <p>This ticket is no longer valid.</p>}
    </section>
  )
}

function methodLabel(method: PaymentView['method']): string {
  if (method === 'cash') {
    return 'Cash'
  }
  if (method === 'transfer') {
    return 'Bank transfer'
  }
  return 'Not recorded'
}
