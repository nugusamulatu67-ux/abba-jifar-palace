import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicTicketCheck } from '../../../shared/src/index.ts'
import { api } from '../api.ts'
import { usePageTitle } from '../components/usePageTitle.ts'
import { formatWhen } from '../format.ts'

export function TicketVerifyPage() {
  const { token } = useParams()
  usePageTitle('Ticket')
  const [ticket, setTicket] = useState<PublicTicketCheck | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ ticket: PublicTicketCheck }>(`/api/tickets/${token}/verify`, { signal: controller.signal })
      .then((result) => {
        if (!result.ok || !result.data) {
          setError(result.error ?? 'That ticket was not found.')
          return
        }
        setTicket(result.data.ticket)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        setError('That ticket was not found.')
      })
    return () => controller.abort()
  }, [token])

  return (
    <>
      <p className="eyebrow">Abba Jifar Palace</p>
      <h1>Ticket check</h1>
      {error && (
        <p className="status bad" role="alert">
          {error}
        </p>
      )}
      {!ticket && !error && <p>Checking ticket…</p>}
      {ticket && (
        <section className="panel">
          <p className={ticket.valid ? 'status ok' : 'status bad'}>{ticket.valid ? 'This ticket is valid.' : 'This ticket is not valid.'}</p>
          <dl className="facts">
            <div>
              <dt>Palace</dt>
              <dd>{ticket.palace}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{ticket.reference}</dd>
            </div>
            <div>
              <dt>Tour</dt>
              <dd>{ticket.packageName}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatWhen(ticket.startsAt)} – {formatWhen(ticket.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Visitors</dt>
              <dd>{ticket.partySize}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{ticket.ticketStatus}</dd>
            </div>
          </dl>
        </section>
      )}
    </>
  )
}
