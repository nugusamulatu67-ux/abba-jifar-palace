import type { PoolClient } from 'pg'
import type { PaymentAuditEntry, PaymentListItem, PaymentMethod, PaymentStatus, TicketStatus } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'

export interface PaymentRecord {
  bookingId: number
  reference: string
  packageName: string
  startsAt: Date
  endsAt: Date
  partySize: number
  priceEtb: number
  bookingStatus: 'pending' | 'confirmed' | 'cancelled'
  touristName: string
  touristUserId: number | null
  amountEtb: number
  paymentStatus: PaymentStatus
  method: PaymentMethod
  paidAt: Date | null
  recordedByName: string | null
  ticketStatus: TicketStatus | null
  ticketToken: string | null
  ticketIssuedAt: Date | null
}

const paymentSelect = `
  SELECT
    bookings.id::text AS booking_id,
    bookings.reference,
    tour_packages.name AS package_name,
    tour_schedules.starts_at,
    tour_schedules.ends_at,
    bookings.party_size,
    tour_packages.price_etb,
    bookings.status AS booking_status,
    tourists.full_name AS tourist_name,
    tourists.user_id::text AS tourist_user_id,
    payments.amount_etb,
    payments.status AS payment_status,
    payments.method,
    payments.paid_at,
    recorder.full_name AS recorded_by_name,
    tickets.status AS ticket_status,
    tickets.token AS ticket_token,
    tickets.issued_at AS ticket_issued_at
  FROM bookings
  JOIN tourists ON tourists.id = bookings.tourist_id
  JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
  JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
  JOIN payments ON payments.booking_id = bookings.id
  LEFT JOIN users recorder ON recorder.id = payments.recorded_by
  LEFT JOIN tickets ON tickets.booking_id = bookings.id
`

export async function lockPayment(client: PoolClient, reference: string): Promise<PaymentRecord | undefined> {
  const result = await client.query(paymentSelect + ' WHERE bookings.reference = $1 FOR UPDATE OF bookings, payments', [
    reference,
  ])
  return result.rows[0] ? mapPayment(result.rows[0]) : undefined
}

export async function findPayment(reference: string): Promise<PaymentRecord | undefined> {
  const result = await pool.query(paymentSelect + ' WHERE bookings.reference = $1', [reference])
  return result.rows[0] ? mapPayment(result.rows[0]) : undefined
}

export async function listPayments(search: string, status: string, method: string): Promise<PaymentListItem[]> {
  const result = await pool.query(
    `SELECT
       bookings.reference,
       tourists.full_name AS tourist_name,
       tour_packages.name AS package_name,
       tour_schedules.starts_at,
       bookings.party_size,
       bookings.status AS booking_status,
       payments.amount_etb,
       payments.status AS payment_status,
       payments.method,
       payments.paid_at
     FROM payments
     JOIN bookings ON bookings.id = payments.booking_id
     JOIN tourists ON tourists.id = bookings.tourist_id
     JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE ($1 = '' OR bookings.reference ILIKE $1 || '%' OR tourists.full_name ILIKE '%' || $1 || '%')
       AND ($2 = '' OR payments.status = $2)
       AND ($3 = '' OR (payments.status = 'paid' AND payments.method = $3))
     ORDER BY payments.updated_at DESC, bookings.id DESC
     LIMIT 200`,
    [search, status, method],
  )
  return result.rows.map((row) => ({
    reference: String(row.reference),
    touristName: String(row.tourist_name),
    packageName: String(row.package_name),
    startsAt: toIso(row.starts_at),
    partySize: Number(row.party_size),
    bookingStatus: row.booking_status,
    amountEtb: Number(row.amount_etb),
    paymentStatus: row.payment_status,
    method: row.payment_status === 'paid' ? row.method : null,
    paidAt: row.paid_at ? toIso(row.paid_at) : null,
  }))
}

export async function markPaid(
  client: PoolClient,
  bookingId: number,
  method: PaymentMethod,
  amountEtb: number,
  recordedBy: number,
): Promise<Date> {
  const result = await client.query<{ paid_at: Date }>(
    `UPDATE payments
     SET status = 'paid',
         method = $2,
         amount_etb = $3,
         recorded_by = $4,
         paid_at = now()
     WHERE booking_id = $1
       AND status = 'unpaid'
     RETURNING paid_at`,
    [bookingId, method, amountEtb, recordedBy],
  )
  const paidAt = result.rows[0]?.paid_at
  if (!paidAt) {
    throw new Error('payment_already_recorded')
  }
  return paidAt
}

export async function insertTicket(client: PoolClient, bookingId: number, token: string): Promise<number> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO tickets (booking_id, token, status)
     VALUES ($1, $2, 'valid')
     RETURNING id::text`,
    [bookingId, token],
  )
  return Number(result.rows[0]?.id)
}

export async function writePaymentAudit(
  client: PoolClient,
  userId: number,
  action: string,
  entityType: 'payment' | 'ticket',
  reference: string,
  details: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, action, entityType, reference, JSON.stringify(details)],
  )
}

export async function listPaymentAudits(reference: string): Promise<PaymentAuditEntry[]> {
  const result = await pool.query(
    `SELECT audit_logs.action, audit_logs.created_at, audit_logs.details, users.full_name AS actor_name
     FROM audit_logs
     LEFT JOIN users ON users.id = audit_logs.user_id
     WHERE audit_logs.entity_id = $1
       AND audit_logs.entity_type IN ('payment', 'ticket')
     ORDER BY audit_logs.created_at, audit_logs.id`,
    [reference],
  )
  return result.rows.map((row) => {
    const details = asDetails(row.details)
    return {
      action: String(row.action),
      actorName: row.actor_name ? String(row.actor_name) : null,
      createdAt: toIso(row.created_at),
      method: typeof details.method === 'string' ? details.method : null,
      amountEtb: typeof details.amountEtb === 'number' ? details.amountEtb : null,
    }
  })
}

export interface PublicTicketRow {
  status: TicketStatus
  reference: string
  packageName: string
  startsAt: Date
  endsAt: Date
  partySize: number
}

export async function findTicketByToken(token: string): Promise<PublicTicketRow | undefined> {
  const result = await pool.query(
    `SELECT
       tickets.status,
       bookings.reference,
       tour_packages.name AS package_name,
       tour_schedules.starts_at,
       tour_schedules.ends_at,
       bookings.party_size
     FROM tickets
     JOIN bookings ON bookings.id = tickets.booking_id
     JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE tickets.token = $1`,
    [token],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  return {
    status: row.status,
    reference: String(row.reference),
    packageName: String(row.package_name),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    partySize: Number(row.party_size),
  }
}

function mapPayment(row: Record<string, unknown>): PaymentRecord {
  return {
    bookingId: Number(row.booking_id),
    reference: String(row.reference),
    packageName: String(row.package_name),
    startsAt: row.starts_at as Date,
    endsAt: row.ends_at as Date,
    partySize: Number(row.party_size),
    priceEtb: Number(row.price_etb),
    bookingStatus: row.booking_status as PaymentRecord['bookingStatus'],
    touristName: String(row.tourist_name),
    touristUserId: row.tourist_user_id === null ? null : Number(row.tourist_user_id),
    amountEtb: Number(row.amount_etb),
    paymentStatus: row.payment_status as PaymentStatus,
    method: row.method as PaymentMethod,
    paidAt: (row.paid_at as Date | null) ?? null,
    recordedByName: row.recorded_by_name ? String(row.recorded_by_name) : null,
    ticketStatus: (row.ticket_status as TicketStatus | null) ?? null,
    ticketToken: row.ticket_token ? String(row.ticket_token) : null,
    ticketIssuedAt: (row.ticket_issued_at as Date | null) ?? null,
  }
}

function asDetails(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString()
}
