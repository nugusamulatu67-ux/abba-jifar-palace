import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { AdminSchedule, AdminTourPackage } from '../../../../shared/src/index.ts'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'
import { formatWhen, palaceDateAndTime } from '../../format.ts'

interface ScheduleFormValues {
  packageId: string
  date: string
  startTime: string
  endTime: string
  maxCapacity: string
}

const emptyForm: ScheduleFormValues = {
  packageId: '',
  date: '',
  startTime: '09:00',
  endTime: '10:30',
  maxCapacity: '',
}

export function ScheduleListPage() {
  usePageTitle('Schedules')
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice ?? ''
  const [packageId, setPackageId] = useState('')
  const [status, setStatus] = useState('')
  const [packages, setPackages] = useState<AdminTourPackage[]>([])
  const [schedules, setSchedules] = useState<AdminSchedule[] | null>(null)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    api<{ packages: AdminTourPackage[] }>('/api/admin/tours', { signal: controller.signal })
      .then((result) => {
        if (result.ok && result.data) {
          setPackages(result.data.packages)
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (packageId) {
      params.set('packageId', packageId)
    }
    if (status) {
      params.set('status', status)
    }
    const query = params.size > 0 ? `?${params.toString()}` : ''
    api<{ schedules: AdminSchedule[] }>(`/api/admin/schedules${query}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Schedules could not be loaded.')
          setSchedules([])
          return
        }
        setError('')
        setSchedules(result.data.schedules)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Schedules could not be loaded.')
      })
    return () => controller.abort()
  }, [packageId, status])

  async function cancel(schedule: AdminSchedule) {
    setPendingId(schedule.id)
    setError('')
    const result = await api<{ schedule: AdminSchedule }>(`/api/admin/schedules/${schedule.id}/cancel`, { method: 'POST' })
    setPendingId(null)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The schedule could not be cancelled.')
      return
    }
    setSchedules((current) => current?.map((item) => (item.id === schedule.id ? result.data!.schedule : item)) ?? current)
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Schedules</h1>
      <div className="actions">
        <Link className="button" to="/admin/schedules/new">
          New schedule
        </Link>
        <Link className="button secondary" to="/admin/tours">
          Packages
        </Link>
      </div>
      {notice && <p className="status ok">{notice}</p>}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Package
          <select value={packageId} onChange={(event) => setPackageId(event.target.value)}>
            <option value="">All packages</option>
            {packages.map((tourPackage) => (
              <option key={tourPackage.id} value={tourPackage.id}>
                {tourPackage.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </form>
      {schedules === null && <p>Loading schedules…</p>}
      {schedules?.length === 0 && <p>No schedules match this filter.</p>}
      {schedules && schedules.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Package</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>
                    {formatWhen(schedule.startsAt)} – {formatWhen(schedule.endsAt)}
                  </td>
                  <td>{schedule.packageName}</td>
                  <td>
                    {schedule.remainingCapacity} left of {schedule.maxCapacity}
                  </td>
                  <td>{schedule.status}</td>
                  <td className="row-actions">
                    {schedule.status === 'scheduled' && <Link to={`/admin/schedules/${schedule.id}`}>Edit</Link>}
                    {schedule.status === 'scheduled' && (
                      <button type="button" disabled={pendingId === schedule.id} onClick={() => void cancel(schedule)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ScheduleFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  usePageTitle(editing ? 'Edit schedule' : 'New schedule')
  const navigate = useNavigate()
  const [packages, setPackages] = useState<AdminTourPackage[]>([])
  const [values, setValues] = useState<ScheduleFormValues>(emptyForm)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(editing)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api<{ packages: AdminTourPackage[] }>('/api/admin/tours', { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Packages could not be loaded.')
          return
        }
        setPackages(result.data.packages.filter((tourPackage) => tourPackage.status !== 'archived'))
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Packages could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!id) {
      return
    }
    const controller = new AbortController()
    api<{ schedule: AdminSchedule }>(`/api/admin/schedules/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That schedule was not found.')
          return
        }
        const schedule = result.data.schedule
        if (schedule.status !== 'scheduled') {
          setLocked(true)
        }
        const start = palaceDateAndTime(schedule.startsAt)
        const end = palaceDateAndTime(schedule.endsAt)
        setValues({
          packageId: String(schedule.packageId),
          date: start.date,
          startTime: start.time,
          endTime: end.time,
          maxCapacity: String(schedule.maxCapacity),
        })
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That schedule was not found.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [id])

  function update(field: keyof ScheduleFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const result = await api<{ schedule: AdminSchedule }>(editing ? `/api/admin/schedules/${id}` : '/api/admin/schedules', {
      method: editing ? 'PATCH' : 'POST',
      body: JSON.stringify({
        packageId: Number(values.packageId),
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        maxCapacity: Number(values.maxCapacity),
      }),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? 'The schedule could not be saved.')
      return
    }
    navigate('/admin/schedules', { state: { notice: editing ? 'Schedule updated.' : 'Schedule created.' } })
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>{editing ? 'Edit schedule' : 'New schedule'}</h1>
      <p>
        <Link to="/admin/schedules">Back to schedules</Link>
      </p>
      <p className="muted">Times use the palace clock, Africa/Addis Ababa (UTC+3).</p>
      {loading && <p>Loading schedule…</p>}
      {!loading && locked && <p className="status bad">Only a scheduled departure can be edited.</p>}
      {!loading && !locked && (
        <form className="panel form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          {error && (
            <p className="status bad" role="alert">
              {error}
            </p>
          )}
          <label>
            Package
            <select value={values.packageId} onChange={(event) => update('packageId', event.target.value)} required>
              <option value="">Choose a package</option>
              {packages.map((tourPackage) => (
                <option key={tourPackage.id} value={tourPackage.id}>
                  {tourPackage.name} ({tourPackage.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} required />
          </label>
          <label>
            Starting time
            <input type="time" value={values.startTime} onChange={(event) => update('startTime', event.target.value)} required />
          </label>
          <label>
            Ending time
            <input type="time" value={values.endTime} onChange={(event) => update('endTime', event.target.value)} required />
          </label>
          <label>
            Visitor capacity
            <input
              inputMode="numeric"
              value={values.maxCapacity}
              onChange={(event) => update('maxCapacity', event.target.value)}
              required
            />
          </label>
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save schedule'}
          </button>
        </form>
      )}
    </div>
  )
}
