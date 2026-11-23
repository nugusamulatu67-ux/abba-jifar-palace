import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type {
  AdminTourPackage,
  DepartureAssignmentPage,
  GuideAccount,
  GuideAccountDetail,
} from '../../../../shared/src/index.ts'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'
import { formatWhen } from '../../format.ts'

export function GuideListPage() {
  usePageTitle('Guides')
  const [search, setSearch] = useState('')
  const [guides, setGuides] = useState<GuideAccount[] | null>(null)
  const [error, setError] = useState('')
  const [allowed, setAllowed] = useState(false)

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
    api<{ guides: GuideAccount[] }>(`/api/admin/guides?${params.toString()}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Guides could not be loaded.')
          setGuides(null)
          return
        }
        setError('')
        setGuides(result.data.guides)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Guides could not be loaded.')
      })
    return () => controller.abort()
  }, [allowed, search])

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Tour guides</h1>
      <p className="lede">Registered tour-guide accounts. Account status is shown here and is not changed from this page.</p>
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
          <form className="filters" onSubmit={(event) => event.preventDefault()}>
            <label>
              Name or email
              <input value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </form>
          {guides === null && !error && <p>Loading guides…</p>}
          {guides?.length === 0 && <p>No tour guides match this search.</p>}
          {guides && guides.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Upcoming</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {guides.map((guide) => (
                    <tr key={guide.id}>
                      <td>{guide.fullName}</td>
                      <td>{guide.email}</td>
                      <td>{guide.status}</td>
                      <td>{guide.upcomingAssignments}</td>
                      <td>
                        <Link to={`/admin/guides/${guide.id}`}>History</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function GuideDetailPage() {
  usePageTitle('Guide')
  const params = useParams()
  const [guide, setGuide] = useState<GuideAccountDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ guide: GuideAccountDetail }>(`/api/admin/guides/${params.id ?? ''}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That guide was not found.')
          return
        }
        setGuide(result.data.guide)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That guide was not found.')
      })
    return () => controller.abort()
  }, [params.id])

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>{guide?.fullName ?? 'Guide'}</h1>
      <p>
        <Link to="/admin/guides">All guides</Link>
      </p>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!guide && !error && <p>Loading guide…</p>}
      {guide && (
        <>
          <dl className="facts">
            <div>
              <dt>Email</dt>
              <dd>{guide.email}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{guide.status}</dd>
            </div>
            <div>
              <dt>Upcoming assignments</dt>
              <dd>{guide.upcomingAssignments}</dd>
            </div>
          </dl>
          <h2>Assignment history</h2>
          {guide.assignments.length === 0 && <p>This guide has no assignments yet.</p>}
          {guide.assignments.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tour</th>
                    <th>When</th>
                    <th>Status</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.assignments.map((row) => (
                    <tr key={row.id}>
                      <td>{row.packageName}</td>
                      <td>
                        {formatWhen(row.startsAt)} – {formatWhen(row.endsAt)}
                      </td>
                      <td>{row.status}</td>
                      <td>{formatWhen(row.assignedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function AssignmentAdminPage() {
  usePageTitle('Assignments')
  const [allowed, setAllowed] = useState(false)
  const [packages, setPackages] = useState<AdminTourPackage[]>([])
  const [guides, setGuides] = useState<GuideAccount[]>([])
  const [guideDetail, setGuideDetail] = useState<GuideAccountDetail | null>(null)
  const [board, setBoard] = useState<DepartureAssignmentPage | null>(null)
  const [date, setDate] = useState('')
  const [packageId, setPackageId] = useState('')
  const [assignment, setAssignment] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [guideUserId, setGuideUserId] = useState('')
  const [confirming, setConfirming] = useState<'assign' | 'change' | 'remove' | ''>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
    api<{ packages: AdminTourPackage[] }>('/api/admin/tours', { signal: controller.signal }).then((result) => {
      if (result.ok && result.data) {
        setPackages(result.data.packages)
      }
    })
    api<{ guides: GuideAccount[] }>('/api/admin/guides', { signal: controller.signal }).then((result) => {
      if (result.ok && result.data) {
        setGuides(result.data.guides)
      }
    })
    return () => controller.abort()
  }, [allowed, notice])

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
    if (packageId) {
      params.set('packageId', packageId)
    }
    if (assignment) {
      params.set('assignment', assignment)
    }
    api<{ board: DepartureAssignmentPage }>(`/api/admin/assignments?${params.toString()}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Departures could not be loaded.')
          setBoard(null)
          return
        }
        setBoard(result.data.board)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Departures could not be loaded.')
      })
    return () => controller.abort()
  }, [allowed, search, date, packageId, assignment, page, notice])

  useEffect(() => {
    if (!guideUserId) {
      return
    }
    const controller = new AbortController()
    const now = Date.now()
    api<{ guide: GuideAccountDetail }>(`/api/admin/guides/${guideUserId}`, { signal: controller.signal }).then((result) => {
      if (result.ok && result.data) {
        setGuideDetail({
          ...result.data.guide,
          assignments: result.data.guide.assignments.filter(
            (item) => item.status === 'active' && new Date(item.endsAt).getTime() > now,
          ),
        })
      }
    })
    return () => controller.abort()
  }, [guideUserId])

  const selected = board?.departures.find((row) => row.scheduleId === selectedId) ?? null
  const shownGuide = guideDetail && String(guideDetail.id) === guideUserId ? guideDetail : null
  const pages = board ? Math.max(1, Math.ceil(board.total / board.pageSize)) : 1

  async function save(action: 'assign' | 'change' | 'remove') {
    if (!selected || pending || confirming !== action) {
      return
    }
    setPending(true)
    setError('')
    setNotice('')
    const result =
      action === 'assign'
        ? await api<{ departure: { guideName: string | null } }>('/api/admin/assignments', {
            method: 'POST',
            body: JSON.stringify({ scheduleId: selected.scheduleId, guideUserId: Number(guideUserId) }),
          })
        : await api<{ departure: { guideName: string | null } }>(`/api/admin/assignments/${selected.assignmentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ guideUserId: action === 'remove' ? null : Number(guideUserId) }),
          })
    setPending(false)
    if (!result.ok) {
      setNotice('')
      setError(result.error ?? 'The assignment could not be saved.')
      return
    }
    setNotice(
      action === 'remove'
        ? `${selected.packageName} no longer has an assigned guide.`
        : `${result.data?.departure.guideName ?? 'The guide'} is assigned to ${selected.packageName}.`,
    )
    setConfirming('')
    setSelectedId(null)
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Guide assignments</h1>
      <p className="lede">Each departure has one guide. A guide cannot cover two departures at the same time.</p>
      <p>
        <Link to="/admin">Administration</Link>
      </p>
      {notice && <p className="status ok">{notice}</p>}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!allowed && !error && <p>Checking access…</p>}
      {allowed && (
        <>
          <form className="filters" onSubmit={(event) => event.preventDefault()}>
            <label>
              Tour or guide
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
                value={packageId}
                onChange={(event) => {
                  setPage(1)
                  setPackageId(event.target.value)
                }}
              >
                <option value="">All tours</option>
                {packages.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignment
              <select
                value={assignment}
                onChange={(event) => {
                  setPage(1)
                  setAssignment(event.target.value)
                }}
              >
                <option value="">All departures</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </form>
          {board === null && !error && <p>Loading departures…</p>}
          {board?.departures.length === 0 && <p>No departures match this filter.</p>}
          {board && board.departures.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tour</th>
                    <th>When</th>
                    <th>Guide</th>
                    <th>Confirmed</th>
                    <th>Checked in</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {board.departures.map((row) => (
                    <tr key={row.scheduleId}>
                      <td>{row.packageName}</td>
                      <td>
                        {formatWhen(row.startsAt)} – {formatWhen(row.endsAt)}
                      </td>
                      <td>{row.guideName ?? 'Unassigned'}</td>
                      <td>{row.confirmedVisitors}</td>
                      <td>{row.checkedInVisitors}</td>
                      <td>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => {
                            setSelectedId(row.scheduleId)
                            setGuideUserId(row.guideUserId ? String(row.guideUserId) : '')
                            setConfirming('')
                            setError('')
                          }}
                        >
                          {row.assignmentId ? 'Change' : 'Assign'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {board && board.total > board.pageSize && (
            <div className="actions">
              <button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <button className="button secondary" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          )}
          {selected && (
            <section className="panel">
              <h2>
                {selected.packageName}
              </h2>
              <p>
                {formatWhen(selected.startsAt)} – {formatWhen(selected.endsAt)}
              </p>
              <p>Current guide: {selected.guideName ?? 'Unassigned'}</p>
              <label>
                Guide
                <select value={guideUserId} onChange={(event) => { setGuideUserId(event.target.value); setConfirming('') }}>
                  <option value="">Choose a guide</option>
                  {guides.map((guide) => (
                    <option key={guide.id} value={guide.id}>
                      {guide.fullName} ({guide.upcomingAssignments} upcoming){guide.status === 'inactive' ? ' — inactive' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {shownGuide && (
                <>
                  <h3>Upcoming for {shownGuide.fullName}</h3>
                  {shownGuide.assignments.length === 0 && <p>No upcoming assignments.</p>}
                  <ul>
                    {shownGuide.assignments.map((item) => (
                        <li key={item.id}>
                          {item.packageName}: {formatWhen(item.startsAt)} – {formatWhen(item.endsAt)}
                        </li>
                      ))}
                  </ul>
                </>
              )}
              <div className="actions">
                {!selected.assignmentId && (
                  <button className="button" type="button" disabled={!guideUserId || pending} onClick={() => setConfirming('assign')}>
                    Assign guide
                  </button>
                )}
                {selected.assignmentId && (
                  <>
                    <button className="button" type="button" disabled={!guideUserId || pending} onClick={() => setConfirming('change')}>
                      Change guide
                    </button>
                    <button className="button secondary" type="button" disabled={pending} onClick={() => setConfirming('remove')}>
                      Remove assignment
                    </button>
                  </>
                )}
              </div>
              {confirming === 'assign' && (
                <p>
                  <button className="button" type="button" disabled={pending} onClick={() => void save('assign')}>
                    {pending ? 'Saving…' : 'Confirm assignment'}
                  </button>
                </p>
              )}
              {confirming === 'change' && (
                <p>
                  <button className="button" type="button" disabled={pending} onClick={() => void save('change')}>
                    {pending ? 'Saving…' : 'Confirm change'}
                  </button>
                </p>
              )}
              {confirming === 'remove' && (
                <p>
                  The current guide stays assigned until you confirm.
                  <button className="button secondary" type="button" disabled={pending} onClick={() => void save('remove')}>
                    {pending ? 'Removing…' : 'Confirm removal'}
                  </button>
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
