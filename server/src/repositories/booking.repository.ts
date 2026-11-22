import type { Pool, PoolClient } from 'pg'
import { withTransaction } from '../db/transaction.ts'
import { assertAmountEtb, assertPartySize } from '../validation/booking.ts'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'
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
