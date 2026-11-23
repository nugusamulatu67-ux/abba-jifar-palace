import { useEffect, useState } from 'react'
import { api } from '../api.ts'

export function AreaPage({
  eyebrow,
  title,
  intro,
  endpoint,
}: {
  eyebrow: string
  title: string
  intro: string
  endpoint: string
}) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    api<{ message: string }>(endpoint, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'This area is not available.')
          return
        }
        setMessage(result.data.message)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setError('This area is not available.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [endpoint])

  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      <section className="card" aria-live="polite">
        <h2>Access check</h2>
        {loading && <p>Checking access…</p>}
        {error && (
          <p className="status bad" role="alert">
            {error}
          </p>
        )}
        {message && <p className="status ok">{message}</p>}
      </section>
    </>
  )
}
