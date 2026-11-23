import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AttendanceSummary, CheckInPage } from '../../../../shared/src/index.ts'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'
import { formatWhen } from '../../format.ts'

export function AdminCheckInPage() {
  usePageTitle('Check-ins')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [tourId, setTourId] = useState('')
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<CheckInPage | null>(null)
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [tours, setTours] = useState<{ id: number; name: string }[]>([])
  const [allowed, setAllowed] = useState(false)
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
    api<{ packages: { id: number; name: string }[] }>('/api/admin/tours', { signal: controller.signal })
      .then((result) => {
        if (result.ok && result.data) {
          setTours(result.data.packages)
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
      })
    return () => controller.abort()
  }, [allowed])

  useEffect(() => {
    if (!allowed) {
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (search.trim()) {
      params.set('q', search.trim())
    }
    if (date) {
      params.set('date', date)
    }
    if (tourId.trim()) {
      params.set('tourId', tourId.trim())
    }
    api<{ history: CheckInPage }>(`/api/admin/check-ins?${params.toString()}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Check-ins could not be loaded.')
          setHistory(null)
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
  }, [allowed, search, date, tourId, page])

  useEffect(() => {
    if (!allowed) {
      return
    }
    const controller = new AbortController()
    const query = date ? `?date=${encodeURIComponent(date)}` : ''
    api<{ summary: AttendanceSummary }>(`/api/admin/check-ins/summary${query}`, { signal: controller.signal })
      .then((result) => {
        if (result.ok && result.data) {
          setSummary(result.data.summary)
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
      })
    return () => controller.abort()
  }, [allowed, date])

  const pages = history ? Math.max(1, Math.ceil(history.total / history.pageSize)) : 1

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Check-ins</h1>
      <p className="lede">Arrival records are kept as history. This page does not change or delete them.</p>
      <p>
        <Link to="/admin">Administration</Link>
      </p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!allowed && !error && <p>Checking access…</p>}
      {allowed && (
        <>
      {summary && (
        <section className="panel">
          <h2>Attendance for {summary.date}</h2>
          <dl className="facts">
            <div>
              <dt>Check-ins</dt>
              <dd>{summary.totalCheckIns}</dd>
            </div>
            <div>
              <dt>Visitors</dt>
              <dd>{summary.totalVisitors}</dd>
            </div>
          </dl>
          {summary.tours.length === 0 && <p>No arrivals on this date.</p>}
          {summary.tours.length > 0 && (
            <ul>
              {summary.tours.map((tour) => (
                <li key={tour.packageId}>
                  {tour.packageName}: {tour.checkIns} {tour.checkIns === 1 ? 'check-in' : 'check-ins'}, {tour.visitors}{' '}
                  {tour.visitors === 1 ? 'visitor' : 'visitors'}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Reference or name
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
        <label>
          Tour
          <select
            value={tourId}
            onChange={(event) => {
              setPage(1)
              setTourId(event.target.value)
            }}
          >
            <option value="">All tours</option>
            {tours.map((tour) => (
              <option key={tour.id} value={tour.id}>
                {tour.name}
              </option>
            ))}
          </select>
        </label>
      </form>
      {history === null && !error && <p>Loading check-ins…</p>}
      {history?.checkIns.length === 0 && <p>No check-ins match this filter.</p>}
      {history && history.checkIns.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Visitor</th>
                <th>Tour</th>
                <th>Visitors</th>
                <th>Checked in</th>
                <th>Receptionist</th>
              </tr>
            </thead>
            <tbody>
              {history.checkIns.map((row) => (
                <tr key={`${row.reference}-${row.arrivedAt}`}>
                  <td>{row.reference}</td>
                  <td>{row.touristName}</td>
                  <td>{row.packageName}</td>
                  <td>{row.partySize}</td>
                  <td>{formatWhen(row.arrivedAt)}</td>
                  <td>{row.receptionistName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
        </>
      )}
    </div>
  )
}
