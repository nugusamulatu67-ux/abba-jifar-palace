import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { PaymentListItem, PaymentMethod, StaffPaymentView } from '../../../../shared/src/index.ts'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'
import { formatPrice, formatWhen } from '../../format.ts'

export function AdminPaymentListPage() {
  usePageTitle('Payments')
  const [allowed, setAllowed] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [payments, setPayments] = useState<PaymentListItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ message: string }>('/api/admin/access', { signal: controller.signal })
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? 'This area is not available.')
          return
        }
        setAllowed(true)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('This area is not available.')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!allowed) {
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (search.trim()) {
      params.set('q', search.trim())
    }
    if (status) {
      params.set('status', status)
    }
    if (method) {
      params.set('method', method)
    }
    const query = params.size > 0 ? `?${params.toString()}` : ''
    api<{ payments: PaymentListItem[] }>(`/api/admin/payments${query}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Payments could not be loaded.')
          setPayments([])
          return
        }
        setError('')
        setPayments(result.data.payments)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Payments could not be loaded.')
      })
    return () => controller.abort()
  }, [allowed, search, status, method])

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Payments</h1>
      <p className="lede">Palace staff record cash or a bank transfer. The website does not take payment itself.</p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!allowed && !error && <p>Checking access…</p>}
      {allowed && (
        <form className="filters" onSubmit={(event) => event.preventDefault()}>
          <label>
            Reference or name
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label>
            Method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="transfer">Bank transfer</option>
            </select>
          </label>
        </form>
      )}
      {allowed && payments === null && <p>Loading payments…</p>}
      {payments?.length === 0 && <p>No payments match this filter.</p>}
      {payments && payments.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Visitor</th>
                <th>Tour</th>
                <th>When</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.reference}>
                  <td>
                    <Link to={`/admin/payments/${payment.reference}`}>{payment.reference}</Link>
                  </td>
                  <td>{payment.touristName}</td>
                  <td>{payment.packageName}</td>
                  <td>{formatWhen(payment.startsAt)}</td>
                  <td>{formatPrice(payment.amountEtb)}</td>
                  <td>{payment.paymentStatus}</td>
                  <td>{payment.method === 'transfer' ? 'Bank transfer' : payment.method === 'cash' ? 'Cash' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AdminPaymentDetailPage() {
  const { reference } = useParams()
  usePageTitle(reference ? `Payment ${reference}` : 'Payment')
  const [payment, setPayment] = useState<StaffPaymentView | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ payment: StaffPaymentView }>(`/api/admin/payments/${reference}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That payment was not found.')
          return
        }
        setPayment(result.data.payment)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That payment was not found.')
      })
    return () => controller.abort()
  }, [reference])

  async function record() {
    if (!payment) {
      return
    }
    setPending(true)
    setError('')
    const result = await api<{ payment: StaffPaymentView }>('/api/admin/payments', {
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
    setNotice('Payment recorded. A ticket was issued for this booking.')
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>{payment ? payment.reference : 'Payment'}</h1>
      <p>
        <Link to="/admin/payments">All payments</Link>
      </p>
      {notice && <p className="status ok">{notice}</p>}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!payment && !error && <p>Loading payment…</p>}
      {payment && (
        <section className="panel">
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
              <dd>
                {formatWhen(payment.startsAt)} – {formatWhen(payment.endsAt)}
              </dd>
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
              <dt>Booking</dt>
              <dd>{payment.bookingStatus}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{payment.paymentStatus}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{payment.method === 'transfer' ? 'Bank transfer' : payment.method === 'cash' ? 'Cash' : 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Recorded by</dt>
              <dd>{payment.recordedByName ?? '—'}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd>{payment.ticket ? payment.ticket.status : 'None'}</dd>
            </div>
          </dl>
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
              <p>Record {formatPrice(payment.amountEtb)} received at the palace?</p>
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
          <h2>History</h2>
          {payment.audits.length === 0 && <p>No payment actions have been recorded.</p>}
          {payment.audits.length > 0 && (
            <ul>
              {payment.audits.map((entry) => (
                <li key={`${entry.action}-${entry.createdAt}`}>
                  {entry.action} · {entry.actorName ?? 'Staff'} · {formatWhen(entry.createdAt)}
                  {entry.amountEtb !== null ? ` · ${formatPrice(entry.amountEtb)}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
