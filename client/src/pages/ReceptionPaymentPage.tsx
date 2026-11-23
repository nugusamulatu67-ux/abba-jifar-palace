import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { PaymentMethod, StaffPaymentView } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatPrice, formatWhen } from '../format.ts'

export function ReceptionPaymentPage() {
  usePageTitle('Record a payment')
  const [allowed, setAllowed] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [reference, setReference] = useState('')
  const [payment, setPayment] = useState<StaffPaymentView | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ message: string }>('/api/reception/access', { signal: controller.signal })
      .then((result) => {
        if (!result.ok) {
          setAccessError(result.error ?? 'This area is not available.')
          return
        }
        setAllowed(true)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setAccessError('This area is not available.')
      })
    return () => controller.abort()
  }, [])

  async function search(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setConfirming(false)
    setPayment(null)
    const result = await api<{ payment: StaffPaymentView }>(`/api/payments/${reference.trim()}`)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'That booking was not found.')
      return
    }
    setPayment(result.data.payment)
  }

  async function record() {
    if (!payment) {
      return
    }
    setPending(true)
    setError('')
    const result = await api<{ payment: StaffPaymentView }>('/api/reception/payments', {
      method: 'POST',
      body: JSON.stringify({ reference: payment.reference, method }),
    })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The payment could not be recorded.')
      return
    }
    setPayment(result.data.payment)
    setConfirming(false)
    setNotice('Payment recorded. The ticket is ready on the visitor’s booking page.')
  }

  if (accessError) {
    return (
      <p className="status bad" role="alert">
        {accessError}
      </p>
    )
  }
  if (!allowed) {
    return <p>Checking access…</p>
  }

  return (
    <>
      <p className="eyebrow">Reception</p>
      <h1>Record a payment</h1>
      <p>
        <Link to="/reception">Reception desk</Link>
      </p>
      <p className="lede">
        Search a booking reference and record cash or a bank transfer received at the palace. Check-in stays on the reception desk.
      </p>
      <form className="filters" onSubmit={(event) => void search(event)}>
        <label>
          Booking reference
          <input value={reference} onChange={(event) => setReference(event.target.value)} required />
        </label>
        <button className="button" type="submit">
          Search
        </button>
      </form>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="status ok">{notice}</p>}
      {payment && (
        <section className="panel">
          <h2>{payment.reference}</h2>
          <dl className="facts">
            <div>
              <dt>Visitor</dt>
              <dd>{payment.touristName}</dd>
            </div>
            <div>
              <dt>Tour</dt>
              <dd>{payment.packageName}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{formatWhen(payment.startsAt)}</dd>
            </div>
            <div>
              <dt>Visitors</dt>
              <dd>{payment.partySize}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{formatPrice(payment.amountEtb)}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{payment.paymentStatus === 'paid' ? `Paid by ${methodLabel(payment.method)}` : 'Unpaid'}</dd>
            </div>
          </dl>
          {payment.bookingStatus === 'cancelled' && <p>This booking is cancelled, so it cannot be paid.</p>}
          {payment.paymentStatus === 'unpaid' && payment.bookingStatus !== 'cancelled' && !confirming && (
            <button className="button" type="button" onClick={() => setConfirming(true)}>
              Record payment
            </button>
          )}
          {confirming && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void record()
              }}
            >
              <p>Record {formatPrice(payment.amountEtb)} for {payment.reference}?</p>
              <label>
                Method
                <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank transfer</option>
                </select>
              </label>
              <div className="actions">
                <button className="button" type="submit" disabled={pending}>
                  {pending ? 'Recording…' : 'Confirm payment'}
                </button>
                <button className="button secondary" type="button" onClick={() => setConfirming(false)}>
                  Back
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </>
  )
}

function methodLabel(method: PaymentMethod | null): string {
  return method === 'transfer' ? 'bank transfer' : 'cash'
}
