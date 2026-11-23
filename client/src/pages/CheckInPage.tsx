import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import type { CheckInPreview, CheckInRecord } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatWhen } from '../format.ts'

export function CheckInPage() {
  usePageTitle('Check in')
  const [params] = useSearchParams()
  const [allowed, setAllowed] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [reference, setReference] = useState(params.get('reference') ?? '')
  const [preview, setPreview] = useState<CheckInPreview | null>(null)
  const [credential, setCredential] = useState<{ token?: string; reference?: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const scanLock = useRef(false)

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
    const initial = params.get('reference')
    if (!initial || scanLock.current) {
      return
    }
    scanLock.current = true
    void loadPreview({ reference: initial }).finally(() => {
      scanLock.current = false
    })
  }, [allowed, params])

  useEffect(() => {
    if (!scanning) {
      return
    }
    const scanner = new Html5Qrcode('qr-reader')
    let active = true
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          if (!active || scanLock.current) {
            return
          }
          const token = readTicketToken(decoded)
          scanLock.current = true
          active = false
          void release(scanner).then(() => {
            setScanning(false)
            scanLock.current = false
            if (!token) {
              setCameraError('That code is not a palace ticket. Try the booking reference.')
              return
            }
            void loadPreview({ token })
          })
        },
        () => undefined,
      )
      .catch((caught: unknown) => {
        if (!active) {
          return
        }
        setCameraError(cameraMessage(caught))
        setScanning(false)
      })
    return () => {
      active = false
      void release(scanner)
    }
  }, [scanning])

  async function loadPreview(input: { token?: string; reference?: string }) {
    setError('')
    setNotice('')
    setCameraError('')
    setPreview(null)
    const query = input.token
      ? `token=${encodeURIComponent(input.token)}`
      : `reference=${encodeURIComponent(input.reference ?? '')}`
    const result = await api<{ preview: CheckInPreview }>(`/api/reception/check-ins/preview?${query}`)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'That ticket could not be checked.')
      setCredential(null)
      return
    }
    setPreview(result.data.preview)
    setCredential(input)
  }

  async function confirmArrival() {
    if (!credential || pending) {
      return
    }
    setPending(true)
    setError('')
    const result = await api<{ checkIn: CheckInRecord }>('/api/reception/check-ins', {
      method: 'POST',
      body: JSON.stringify(credential),
    })
    setPending(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The visitor could not be checked in.')
      return
    }
    setNotice(`${result.data.checkIn.reference} is checked in for ${result.data.checkIn.partySize} visitors.`)
    setPreview(null)
    setCredential(null)
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
      <h1>Check in visitors</h1>
      <p className="lede">Scan a palace ticket, then confirm the arrival. The whole party is checked in together.</p>
      <p>
        <Link to="/reception">Reception desk</Link>
      </p>
      {notice && <p className="status ok">{notice}</p>}
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>Scan a ticket</h2>
        <div id="qr-reader" className="scanner-frame" />
        {cameraError && (
          <p className="status bad" role="alert">
            {cameraError}
          </p>
        )}
        <div className="actions">
          {!scanning && (
            <button className="button" type="button" onClick={() => { setCameraError(''); setScanning(true) }}>
              Start camera
            </button>
          )}
          {scanning && (
            <button className="button secondary" type="button" onClick={() => setScanning(false)}>
              Stop camera
            </button>
          )}
        </div>
      </section>
      <form
        className="filters"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void loadPreview({ reference: reference.trim() })
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
      {preview && (
        <section className="panel" aria-live="polite">
          <h2>{preview.palace}</h2>
          <dl className="facts">
            <div>
              <dt>Reference</dt>
              <dd>{preview.reference}</dd>
            </div>
            <div>
              <dt>Visitor</dt>
              <dd>{preview.touristName}</dd>
            </div>
            <div>
              <dt>Tour</dt>
              <dd>{preview.packageName}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatWhen(preview.startsAt)} – {formatWhen(preview.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Visitors</dt>
              <dd>{preview.partySize}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{preview.paymentStatus}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd>{preview.ticketStatus}</dd>
            </div>
          </dl>
          {preview.reason && <p className="status bad">{preview.reason}</p>}
          {preview.eligible && (
            <button className="button" type="button" disabled={pending} onClick={() => void confirmArrival()}>
              {pending ? 'Checking in…' : 'Confirm arrival'}
            </button>
          )}
        </section>
      )}
    </>
  )
}

function readTicketToken(value: string): string | undefined {
  const match = value.match(/\/tickets\/verify\/([A-Za-z0-9_-]{32,80})(?:[/?#]|$)/)
  if (match?.[1]) {
    return match[1]
  }
  if (/^[A-Za-z0-9_-]{32,80}$/.test(value.trim())) {
    return value.trim()
  }
  return undefined
}

function cameraMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError') {
    return 'The browser did not allow the camera. You can still check in with the booking reference.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found. Use the booking reference instead.'
  }
  if (!window.isSecureContext) {
    return 'The camera needs this site on localhost or HTTPS. Use the booking reference instead.'
  }
  return 'The camera could not be started. Use the booking reference instead.'
}

async function release(scanner: Html5Qrcode): Promise<void> {
  try {
    if (scanner.isScanning) {
      await scanner.stop()
    }
    scanner.clear()
  } catch {
    // The camera is already released.
  }
}
