import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'

export function AdminHubPage() {
  usePageTitle('Administration')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ message: string }>('/api/admin/access', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'This area is not available.')
          return
        }
        setMessage(result.data.message)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('This area is not available.')
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Staff</p>
      <h1>Tour management</h1>
      <p className="lede">Create the tours visitors can browse, then add the dates those tours run.</p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!message && !error && <p>Checking access…</p>}
      {message && (
        <>
          <p className="status ok">{message}</p>
          <div className="card-grid">
            <article className="info-card">
              <h2>Packages</h2>
              <p>Name, price, duration, category, and whether a tour is open.</p>
              <Link className="button" to="/admin/tours">
                Manage packages
              </Link>
            </article>
            <article className="info-card">
              <h2>Schedules</h2>
              <p>Dates, times, and how many visitors each departure can take.</p>
              <Link className="button" to="/admin/schedules">
                Manage schedules
              </Link>
            </article>
            <article className="info-card">
              <h2>Bookings</h2>
              <p>Review reservations, confirm a pending booking, or cancel one.</p>
              <Link className="button" to="/admin/bookings">
                Manage bookings
              </Link>
            </article>
            <article className="info-card">
              <h2>Payments</h2>
              <p>Record cash or a bank transfer received at the palace.</p>
              <Link className="button" to="/admin/payments">
                Manage payments
              </Link>
            </article>
          </div>
        </>
      )}
    </div>
  )
}
