import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { GuideAssignmentDetail, GuideDashboard } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatWhen } from '../format.ts'

export function GuideDashboardPage() {
  usePageTitle('Assigned tours')
  const [dashboard, setDashboard] = useState<GuideDashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ dashboard: GuideDashboard }>('/api/guide/dashboard', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Assigned tours could not be loaded.')
          return
        }
        setDashboard(result.data.dashboard)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Assigned tours could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  return (
    <>
      <p className="eyebrow">Guide</p>
      <h1>{dashboard ? `Welcome, ${dashboard.guideName}` : 'Assigned tours'}</h1>
      <p className="lede">Your departures and how many visitors are expected.</p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!dashboard && !error && <p>Loading assignments…</p>}
      {dashboard && (
        <>
          <p className="status ok">{dashboard.upcomingCount} upcoming assignment{dashboard.upcomingCount === 1 ? '' : 's'}.</p>
          <AssignmentGroup title="Today" rows={dashboard.today} empty="Nothing is scheduled for today." />
          <AssignmentGroup title="Upcoming" rows={dashboard.upcoming} empty="No upcoming departures." />
          <AssignmentGroup title="Recently completed" rows={dashboard.completed} empty="No completed assignments yet." />
        </>
      )}
    </>
  )
}

export function GuideAssignmentPage() {
  usePageTitle('Assignment')
  const params = useParams()
  const [assignment, setAssignment] = useState<GuideAssignmentDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ assignment: GuideAssignmentDetail }>(`/api/guide/assignments/${params.id ?? ''}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That assignment was not found.')
          setAssignment(null)
          return
        }
        setAssignment(result.data.assignment)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That assignment was not found.')
      })
    return () => controller.abort()
  }, [params.id])

  return (
    <>
      <p className="eyebrow">Guide</p>
      <h1>{assignment?.packageName ?? 'Assignment'}</h1>
      <p>
        <Link to="/guide">Assigned tours</Link>
      </p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!assignment && !error && <p>Loading assignment…</p>}
      {assignment && (
        <>
          <p>{assignment.description}</p>
          {assignment.includedActivities && <p>{assignment.includedActivities}</p>}
          <dl className="facts">
            <div>
              <dt>When</dt>
              <dd>
                {formatWhen(assignment.startsAt)} – {formatWhen(assignment.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Confirmed visitors</dt>
              <dd>{assignment.confirmedVisitors}</dd>
            </div>
            <div>
              <dt>Checked in</dt>
              <dd>{assignment.checkedInVisitors}</dd>
            </div>
            <div>
              <dt>Still expected</dt>
              <dd>{assignment.expectedVisitors}</dd>
            </div>
          </dl>
          <h2>Bookings</h2>
          {assignment.visitors.length === 0 && <p>No open bookings for this departure.</p>}
          {assignment.visitors.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Visitor</th>
                    <th>Party</th>
                    <th>Booking</th>
                    <th>Arrived</th>
                  </tr>
                </thead>
                <tbody>
                  {assignment.visitors.map((visitor) => (
                    <tr key={visitor.reference}>
                      <td>{visitor.reference}</td>
                      <td>{visitor.visitorName}</td>
                      <td>{visitor.partySize}</td>
                      <td>{visitor.bookingStatus}</td>
                      <td>{visitor.checkedIn ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

function AssignmentGroup({
  title,
  rows,
  empty,
}: {
  title: string
  rows: GuideDashboard['today']
  empty: string
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length === 0 && <p>{empty}</p>}
      {rows.length > 0 && (
        <div className="card-grid">
          {rows.map((row) => (
            <article className="info-card" key={row.id}>
                <h3>{row.packageName}</h3>
                <p>
                  {formatWhen(row.startsAt)} – {formatWhen(row.endsAt)}
                </p>
                <p>
                  {row.confirmedVisitors} confirmed, {row.checkedInVisitors} checked in, {row.expectedVisitors} still expected.
                </p>
                <Link className="button" to={`/guide/assignments/${row.id}`}>
                  Open assignment
                </Link>
              </article>
          ))}
        </div>
      )}
    </section>
  )
}
