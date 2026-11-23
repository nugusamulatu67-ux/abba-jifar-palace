import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { CheckInPage as CheckInHistory } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatWhen } from '../format.ts'

export function ReceptionHomePage() {
  usePageTitle('Reception')
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [reference, setReference] = useState('')
  const [history, setHistory] = useState<CheckInHistory | null>(null)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (!allowed) {
      return
    }
    const controller = new AbortController()
    api<{ history: CheckInHistory }>('/api/reception/check-ins?pageSize=5', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Recent check-ins could not be loaded.')
          setHistory({ checkIns: [], page: 1, pageSize: 5, total: 0 })
          return
        }
        setHistory(result.data.history)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Recent check-ins could not be loaded.')
      })
    return () => controller.abort()
  }, [allowed])

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
      <h1>Reception desk</h1>
      <p className="lede">Check visitors in with a ticket, or record a payment received at the palace.</p>
      <div className="card-grid">
        <article className="info-card">
          <h2>Check in</h2>
          <p>Scan a QR ticket or confirm an arrival from the booking reference.</p>
          <Link className="button" to="/reception/check-in">
            Open scanner
          </Link>
        </article>
        <article className="info-card">
          <h2>Payments</h2>
          <p>Record cash or a bank transfer before a ticket can be checked in.</p>
          <Link className="button secondary" to="/reception/payments">
            Record a payment
          </Link>
        </article>
      </div>
      <form
        className="filters"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          navigate(`/reception/check-in?reference=${encodeURIComponent(reference.trim())}`)
        }}
      >
        <label>
          Booking reference
          <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="AJ-000046" required />
        </label>
        <button className="button" type="submit">
          Find booking
        </button>
      </form>
      <section>
        <h2>Recent check-ins</h2>
        {error && (
          <p className="status bad" role="alert">
            {error}
          </p>
        )}
        {history === null && !error && <p>Loading check-ins…</p>}
        {history?.checkIns.length === 0 && <p>No visitors have been checked in yet.</p>}
        {history && history.checkIns.length > 0 && <CheckInTable rows={history.checkIns} />}
        <p>
          <Link to="/reception/check-ins">Full check-in history</Link>
        </p>
      </section>
    </>
  )
}

export function ReceptionHistoryPage() {
  usePageTitle('Check-ins')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<CheckInHistory | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (search.trim()) {
      params.set('q', search.trim())
    }
    if (date) {
      params.set('date', date)
    }
    api<{ history: CheckInHistory }>(`/api/reception/check-ins?${params.toString()}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Check-ins could not be loaded.')
          setHistory({ checkIns: [], page, pageSize: 20, total: 0 })
          return
        }
        setError('')
        setHistory(result.data.history)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Check-ins could not be loaded.')
      })
    return () => controller.abort()
  }, [search, date, page])

  const pages = history ? Math.max(1, Math.ceil(history.total / history.pageSize)) : 1

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Reception</p>
      <h1>Check-in history</h1>
      <p>
        <Link to="/reception">Reception desk</Link>
      </p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Booking reference
          <input
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
          />
        </label>
        <label>
          Visit date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setPage(1)
              setDate(event.target.value)
            }}
          />
        </label>
      </form>
      {history === null && !error && <p>Loading check-ins…</p>}
      {history?.checkIns.length === 0 && <p>No check-ins match this filter.</p>}
      {history && history.checkIns.length > 0 && <CheckInTable rows={history.checkIns} />}
      {history && history.total > history.pageSize && (
        <div className="actions">
          <button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <button className="button secondary" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export function CheckInTable({ rows }: { rows: CheckInHistory['checkIns'] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Visitor</th>
            <th>Tour</th>
            <th>Visitors</th>
            <th>Checked in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.reference}-${row.arrivedAt}`}>
              <td>{row.reference}</td>
              <td>{row.touristName}</td>
              <td>{row.packageName}</td>
              <td>{row.partySize}</td>
              <td>{formatWhen(row.arrivedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
