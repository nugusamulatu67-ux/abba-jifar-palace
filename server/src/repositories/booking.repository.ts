import type { Pool, PoolClient } from 'pg'
import type { BookingStatus, BookingView } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'
import { withTransaction } from '../db/transaction.ts'
import { assertAmountEtb, assertPartySize } from '../validation/booking.ts'

export type { BookingStatus }
export type PaymentMethod = 'cash' | 'transfer'

export interface BookTourInput {
  touristId: number
  tourScheduleId: number
  partySize: number
  amountEtb: number
  status?: BookingStatus
  method?: PaymentMethod
  createdBy?: number | null
}

export interface BookTourResult {
  bookingId: number
  paymentId: number
}

function isPoolClient(value: Pool | PoolClient): value is PoolClient {
  return 'release' in value
}

/**
 * Inserts a booking and its payment together.
 * Pass a Pool to run this in its own transaction.
 * Pass a PoolClient to join a transaction the caller already started.
 * The database trigger locks the schedule and rejects an over-capacity booking.
 */
export async function bookTour(
  input: BookTourInput,
  db: Pool | PoolClient,
): Promise<BookTourResult> {
  assertPartySize(input.partySize)
  assertAmountEtb(input.amountEtb)

  if (isPoolClient(db)) {
    return insertBookingAndPayment(db, input)
  }
  return withTransaction(db, (client) => insertBookingAndPayment(client, input))
}

async function insertBookingAndPayment(
  client: PoolClient,
  input: BookTourInput,
): Promise<BookTourResult> {
  const locked = await client.query(
    'SELECT id FROM tour_schedules WHERE id = $1 FOR UPDATE',
    [input.tourScheduleId],
  )
  if ((locked.rowCount ?? 0) !== 1) {
    throw new Error('Tour schedule not found.')
  }

  const booking = await client.query<{ id: string | number }>(
    `INSERT INTO bookings (tourist_id, tour_schedule_id, party_size, status, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.touristId,
      input.tourScheduleId,
      input.partySize,
      input.status ?? 'pending',
      input.createdBy ?? null,
    ],
  )
  const bookingId = Number(booking.rows[0]?.id)

  const payment = await client.query<{ id: string | number }>(
    `INSERT INTO payments (booking_id, amount_etb, status, method)
     VALUES ($1, $2, 'unpaid', $3)
     RETURNING id`,
    [bookingId, input.amountEtb, input.method ?? 'cash'],
  )

  return {
    bookingId,
    paymentId: Number(payment.rows[0]?.id),
  }
}

export interface LockedDeparture {
  scheduleId: number
  packageId: number
  packageName: string
  packageStatus: string
  scheduleStatus: string
  startsAt: Date
  endsAt: Date
  priceEtb: number
  maxCapacity: number
  maxGroupSize: number | null
  seatsTaken: number
}

export async function lockDeparture(client: PoolClient, scheduleId: number): Promise<LockedDeparture | undefined> {
  const result = await client.query<{
    schedule_id: string
    package_id: string
    package_name: string
    package_status: string
    schedule_status: string
    starts_at: Date
    ends_at: Date
    price_etb: number
    max_capacity: number
    max_group_size: number | null
    seats_taken: string
  }>(
    `SELECT
       tour_schedules.id AS schedule_id,
       tour_packages.id AS package_id,
       tour_packages.name AS package_name,
       tour_packages.status AS package_status,
       tour_schedules.status AS schedule_status,
       tour_schedules.starts_at,
       tour_schedules.ends_at,
       tour_packages.price_etb,
       tour_schedules.max_capacity,
       tour_packages.max_group_size,
       COALESCE((
         SELECT SUM(bookings.party_size)
         FROM bookings
         WHERE bookings.tour_schedule_id = tour_schedules.id
           AND bookings.status IN ('pending', 'confirmed')
       ), 0)::text AS seats_taken
     FROM tour_schedules
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE tour_schedules.id = $1
     FOR UPDATE OF tour_schedules`,
    [scheduleId],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  return {
    scheduleId: Number(row.schedule_id),
    packageId: Number(row.package_id),
    packageName: row.package_name,
    packageStatus: row.package_status,
    scheduleStatus: row.schedule_status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    priceEtb: row.price_etb,
    maxCapacity: row.max_capacity,
    maxGroupSize: row.max_group_size,
    seatsTaken: Number(row.seats_taken),
  }
}

export async function findTouristId(client: PoolClient, userId: number): Promise<number | undefined> {
  const result = await client.query<{ id: string }>('SELECT id::text FROM tourists WHERE user_id = $1', [userId])
  const id = result.rows[0]?.id
  return id === undefined ? undefined : Number(id)
}

interface BookingRow {
  reference: string
  tour_schedule_id: string
  package_id: string
  package_name: string
  starts_at: Date
  ends_at: Date
  party_size: number
  amount_etb: number
  status: BookingStatus
  created_at: Date
  cancelled_at: Date | null
  schedule_status: string
  received: boolean
  tourist_user_id: string | null
}

const bookingSelect = `
  SELECT
    bookings.reference,
    bookings.tour_schedule_id,
    tour_packages.id AS package_id,
    tour_packages.name AS package_name,
    tour_schedules.starts_at,
    tour_schedules.ends_at,
    tour_schedules.status AS schedule_status,
    bookings.party_size,
    payments.amount_etb,
    bookings.status,
    bookings.created_at,
    bookings.cancelled_at,
    EXISTS (SELECT 1 FROM receptions WHERE receptions.booking_id = bookings.id) AS received,
    tourists.user_id::text AS tourist_user_id
  FROM bookings
  JOIN tourists ON tourists.id = bookings.tourist_id
  JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
  JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
  JOIN payments ON payments.booking_id = bookings.id
`

export async function listBookingsForUser(userId: number): Promise<BookingView[]> {
  const result = await pool.query<BookingRow>(
    `${bookingSelect}
     WHERE tourists.user_id = $1
     ORDER BY bookings.created_at DESC`,
    [userId],
  )
  return result.rows.map((row) => toBookingView(row, 'tourist'))
}

export async function findBookingForUser(reference: string, userId: number): Promise<BookingView | undefined> {
  const result = await pool.query<BookingRow>(
    `${bookingSelect} WHERE bookings.reference = $1 AND tourists.user_id = $2`,
    [reference, userId],
  )
  const row = result.rows[0]
  return row ? toBookingView(row, 'tourist') : undefined
}

export async function listBookingsForAdmin(search: string, status: string, date: string): Promise<BookingView[]> {
  const result = await pool.query<BookingRow>(
    `${bookingSelect}
     WHERE ($1 = '' OR bookings.reference ILIKE $1 || '%' OR tourists.full_name ILIKE '%' || $1 || '%')
       AND ($2 = '' OR bookings.status = $2)
       AND (
         $3 = ''
         OR (tour_schedules.starts_at AT TIME ZONE 'Africa/Addis_Ababa')::date = NULLIF($3, '')::date
       )
     ORDER BY tour_schedules.starts_at, bookings.reference
     LIMIT 200`,
    [search, status, date],
  )
  return result.rows.map((row) => toBookingView(row, 'administrator'))
}

export async function findBookingForAdmin(reference: string): Promise<BookingView | undefined> {
  const result = await pool.query<BookingRow>(`${bookingSelect} WHERE bookings.reference = $1`, [reference])
  const row = result.rows[0]
  return row ? toBookingView(row, 'administrator') : undefined
}

export async function lockBooking(client: PoolClient, reference: string): Promise<BookingRow | undefined> {
  const result = await client.query<BookingRow>(
    `${bookingSelect} WHERE bookings.reference = $1 FOR UPDATE OF bookings`,
    [reference],
  )
  return result.rows[0]
}

export async function markCancelled(client: PoolClient, reference: string, userId: number): Promise<void> {
  await client.query(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2
     WHERE reference = $1 AND status IN ('pending', 'confirmed')`,
    [reference, userId],
  )
}

export async function markConfirmed(client: PoolClient, reference: string): Promise<void> {
  await client.query(
    `UPDATE bookings
     SET status = 'confirmed'
     WHERE reference = $1 AND status = 'pending'`,
    [reference],
  )
}

export async function writeAudit(
  client: PoolClient,
  userId: number,
  action: string,
  reference: string,
  details: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'booking', $3, $4::jsonb)`,
    [userId, action, reference, JSON.stringify(details)],
  )
}

function toBookingView(row: BookingRow, viewer: 'tourist' | 'administrator'): BookingView {
  const upcoming = row.starts_at.getTime() > Date.now()
  const open = row.status === 'pending' || row.status === 'confirmed'
  const canCancel = open && !row.received && (viewer === 'administrator' || upcoming)
  const canConfirm = viewer === 'administrator' && row.status === 'pending' && row.schedule_status === 'scheduled' && upcoming && !row.received
  return {
    reference: row.reference,
    scheduleId: Number(row.tour_schedule_id),
    packageId: Number(row.package_id),
    packageName: row.package_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    partySize: row.party_size,
    totalEtb: row.amount_etb,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
    canCancel,
    canConfirm,
  }
}
