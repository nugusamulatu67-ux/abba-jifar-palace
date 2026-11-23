import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { AdminTourPackage, PackageStatus } from '../../../../shared/src/index.ts'
import { api } from '../../api.ts'
import { usePageTitle } from '../../components/usePageTitle.ts'
import { formatDuration, formatPrice } from '../../format.ts'

interface PackageFormValues {
  name: string
  description: string
  priceEtb: string
  durationMinutes: string
  category: string
  includedActivities: string
  maxGroupSize: string
}

const emptyForm: PackageFormValues = {
  name: '',
  description: '',
  priceEtb: '',
  durationMinutes: '',
  category: '',
  includedActivities: '',
  maxGroupSize: '',
}

export function PackageListPage() {
  usePageTitle('Tour packages')
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice ?? ''
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [packages, setPackages] = useState<AdminTourPackage[] | null>(null)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (search.trim()) {
      params.set('q', search.trim())
    }
    if (status) {
      params.set('status', status)
    }
    const query = params.size > 0 ? `?${params.toString()}` : ''
    api<{ packages: AdminTourPackage[] }>(`/api/admin/tours${query}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'Packages could not be loaded.')
          setPackages([])
          return
        }
        setError('')
        setPackages(result.data.packages)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('Packages could not be loaded.')
      })
    return () => controller.abort()
  }, [search, status])

  async function changeStatus(tourPackage: AdminTourPackage, next: PackageStatus) {
    setPendingId(tourPackage.id)
    setError('')
    const result = await api<{ package: AdminTourPackage }>(`/api/admin/tours/${tourPackage.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: next }),
    })
    setPendingId(null)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The status could not be changed.')
      return
    }
    setPackages((current) =>
      current?.map((item) => (item.id === tourPackage.id ? result.data!.package : item)) ?? current,
    )
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Tour packages</h1>
      <div className="actions">
        <Link className="button" to="/admin/tours/new">
          New package
        </Link>
        <Link className="button secondary" to="/admin/schedules">
          Schedules
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
          Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or category" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </form>
      {packages === null && <p>Loading packages…</p>}
      {packages?.length === 0 && <p>No packages match this filter.</p>}
      {packages && packages.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Package</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((tourPackage) => (
                <tr key={tourPackage.id}>
                  <td>
                    <strong>{tourPackage.name}</strong>
                    <div className="muted">{tourPackage.category}</div>
                  </td>
                  <td>{formatPrice(tourPackage.priceEtb)}</td>
                  <td>{formatDuration(tourPackage.durationMinutes)}</td>
                  <td>{tourPackage.status}</td>
                  <td className="row-actions">
                    <Link to={`/admin/tours/${tourPackage.id}`}>Edit</Link>
                    {tourPackage.status !== 'active' && (
                      <button type="button" disabled={pendingId === tourPackage.id} onClick={() => void changeStatus(tourPackage, 'active')}>
                        Activate
                      </button>
                    )}
                    {tourPackage.status === 'active' && (
                      <button type="button" disabled={pendingId === tourPackage.id} onClick={() => void changeStatus(tourPackage, 'inactive')}>
                        Deactivate
                      </button>
                    )}
                    {tourPackage.status !== 'archived' && (
                      <button type="button" disabled={pendingId === tourPackage.id} onClick={() => void changeStatus(tourPackage, 'archived')}>
                        Archive
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

export function PackageFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  usePageTitle(editing ? 'Edit package' : 'New package')
  const navigate = useNavigate()
  const [values, setValues] = useState<PackageFormValues>(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(editing)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!id) {
      return
    }
    const controller = new AbortController()
    api<{ package: AdminTourPackage }>(`/api/admin/tours/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That package was not found.')
          return
        }
        const tourPackage = result.data.package
        setValues({
          name: tourPackage.name,
          description: tourPackage.description,
          priceEtb: String(tourPackage.priceEtb),
          durationMinutes: String(tourPackage.durationMinutes),
          category: tourPackage.category,
          includedActivities: tourPackage.includedActivities,
          maxGroupSize: tourPackage.maxGroupSize === null ? '' : String(tourPackage.maxGroupSize),
        })
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That package was not found.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [id])

  function update(field: keyof PackageFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const body = {
      name: values.name,
      description: values.description,
      priceEtb: Number(values.priceEtb),
      durationMinutes: Number(values.durationMinutes),
      category: values.category,
      includedActivities: values.includedActivities,
      maxGroupSize: values.maxGroupSize.trim() === '' ? null : Number(values.maxGroupSize),
    }
    const result = await api<{ package: AdminTourPackage }>(editing ? `/api/admin/tours/${id}` : '/api/admin/tours', {
      method: editing ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? 'The package could not be saved.')
      return
    }
    navigate('/admin/tours', { state: { notice: editing ? 'Package updated.' : 'Package created.' } })
  }

  return (
    <div className="wrap admin-page">
      <p className="eyebrow">Administration</p>
      <h1>{editing ? 'Edit package' : 'New package'}</h1>
      <p>
        <Link to="/admin/tours">Back to packages</Link>
      </p>
      {loading && <p>Loading package…</p>}
      {!loading && (
        <form className="panel form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          {error && (
            <p className="status bad" role="alert">
              {error}
            </p>
          )}
          <label>
            Name
            <input value={values.name} onChange={(event) => update('name', event.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={values.description} onChange={(event) => update('description', event.target.value)} required rows={4} />
          </label>
          <label>
            Category
            <input value={values.category} onChange={(event) => update('category', event.target.value)} required />
          </label>
          <label>
            Price in whole birr
            <input inputMode="numeric" value={values.priceEtb} onChange={(event) => update('priceEtb', event.target.value)} required />
          </label>
          <label>
            Duration in minutes
            <input
              inputMode="numeric"
              value={values.durationMinutes}
              onChange={(event) => update('durationMinutes', event.target.value)}
              required
            />
          </label>
          <label>
            Maximum group size <span className="optional">(optional)</span>
            <input inputMode="numeric" value={values.maxGroupSize} onChange={(event) => update('maxGroupSize', event.target.value)} />
          </label>
          <label>
            Included activities <span className="optional">(optional)</span>
            <textarea
              value={values.includedActivities}
              onChange={(event) => update('includedActivities', event.target.value)}
              rows={3}
            />
          </label>
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save package'}
          </button>
        </form>
      )}
    </div>
  )
}
