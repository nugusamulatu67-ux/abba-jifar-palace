import type { BookingView } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'
import { getDatabaseErrorCode, getDatabaseErrorMessage } from '../db/errors.ts'
import { withTransaction } from '../db/transaction.ts'
import {
  bookTour,
  findBookingForAdmin,
  findBookingForUser,
  findTouristId,
  listBookingsForAdmin,
  listBookingsForUser,
  lockBooking,
  lockDeparture,
  markCancelled,
  markConfirmed,
  writeAudit,
} from '../repositories/booking.repository.ts'

export class BookingError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function bookingStatus(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof BookingError) {
    return { status: error.status, message: error.message }
  }
  return undefined
}

export async function touristBookings(userId: number): Promise<BookingView[]> {
  return listBookingsForUser(userId)
}

export async function touristBooking(userId: number, reference: string): Promise<BookingView> {
  const booking = await findBookingForUser(reference, userId)
  if (!booking) {
    throw new BookingError('That booking was not found.', 404)
  }
  return booking
}

export async function createTouristBooking(userId: number, scheduleId: number, partySize: number): Promise<BookingView> {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 500) {
    throw new BookingError('Enter a whole number of visitors from 1 to 500.', 400)
  }

  const reference = await withTransaction(pool, async (client) => {
    const touristId = await findTouristId(client, userId)
    if (!touristId) {
      throw new BookingError('A tourist profile is required before booking.', 400)
    }
    const departure = await lockDeparture(client, scheduleId)
    if (!departure) {
      throw new BookingError('That departure was not found.', 404)
    }
    if (departure.packageStatus !== 'active') {
      throw new BookingError('That tour is not open for booking.', 400)
    }
    if (departure.scheduleStatus !== 'scheduled') {
      throw new BookingError('That departure is not open for booking.', 400)
    }
    if (departure.startsAt.getTime() <= Date.now()) {
      throw new BookingError('That departure has already started.', 400)
    }
    if (departure.maxGroupSize !== null && partySize > departure.maxGroupSize) {
      throw new BookingError(`A party cannot be larger than ${departure.maxGroupSize}.`, 400)
    }
    const remaining = departure.maxCapacity - departure.seatsTaken
    if (partySize > remaining) {
      throw new BookingError('Not enough seats remain for that party.', 409)
    }
    const totalEtb = departure.priceEtb * partySize
    if (!Number.isSafeInteger(totalEtb) || totalEtb > 1_000_000) {
      throw new BookingError('That party is too large for this price.', 400)
    }

    try {
      const created = await bookTour(
        {
          touristId,
          tourScheduleId: scheduleId,
          partySize,
          amountEtb: totalEtb,
          status: 'pending',
          createdBy: userId,
        },
        client,
      )
      const stored = await client.query<{ reference: string }>('SELECT reference FROM bookings WHERE id = $1', [
        created.bookingId,
      ])
      const bookingReference = stored.rows[0]?.reference
      if (!bookingReference) {
        throw new BookingError('The booking could not be saved.', 500)
      }
      await writeAudit(client, userId, 'booking.create', bookingReference, {
        partySize,
        totalEtb,
        scheduleId,
      })
      return bookingReference
    } catch (error) {
      throw mapBookingError(error)
    }
  })

  return touristBooking(userId, reference)
}

export async function cancelTouristBooking(userId: number, reference: string): Promise<BookingView> {
  await withTransaction(pool, async (client) => {
    const row = await lockBooking(client, reference)
    if (!row || Number(row.tourist_user_id) !== userId) {
      throw new BookingError('That booking was not found.', 404)
    }
    await applyCancellation(client, row, userId, true)
  })
  return touristBooking(userId, reference)
}

export async function adminBookings(search: string, status: string, date: string): Promise<BookingView[]> {
  return listBookingsForAdmin(search, status, date)
}

export async function adminBooking(reference: string): Promise<BookingView> {
  const booking = await findBookingForAdmin(reference)
  if (!booking) {
    throw new BookingError('That booking was not found.', 404)
  }
  return booking
}

export async function confirmBooking(userId: number, reference: string): Promise<BookingView> {
  await withTransaction(pool, async (client) => {
    const row = await lockBooking(client, reference)
    if (!row) {
      throw new BookingError('That booking was not found.', 404)
    }
    if (row.status === 'confirmed') {
      return
    }
    if (row.status !== 'pending' || row.schedule_status !== 'scheduled' || row.received || row.starts_at.getTime() <= Date.now()) {
      throw new BookingError('Only a pending booking for an upcoming departure can be confirmed.', 400)
    }
    await markConfirmed(client, reference)
    await writeAudit(client, userId, 'booking.confirm', reference, { partySize: row.party_size })
  })
  return adminBooking(reference)
}

export async function cancelAdminBooking(userId: number, reference: string): Promise<BookingView> {
  await withTransaction(pool, async (client) => {
    const row = await lockBooking(client, reference)
    if (!row) {
      throw new BookingError('That booking was not found.', 404)
    }
    await applyCancellation(client, row, userId, false)
  })
  return adminBooking(reference)
}

async function applyCancellation(
  client: Parameters<typeof markCancelled>[0],
  row: NonNullable<Awaited<ReturnType<typeof lockBooking>>>,
  userId: number,
  touristRule: boolean,
): Promise<void> {
  if (row.status === 'cancelled') {
    return
  }
  if (row.received) {
    throw new BookingError('A booking that has already been received cannot be cancelled.', 400)
  }
  if (row.status !== 'pending' && row.status !== 'confirmed') {
    throw new BookingError('This booking cannot be cancelled.', 400)
  }
  if (touristRule && row.starts_at.getTime() <= Date.now()) {
    throw new BookingError('This booking can no longer be cancelled.', 400)
  }
  await markCancelled(client, row.reference, userId)
  await writeAudit(client, userId, 'booking.cancel', row.reference, { partySize: row.party_size })
}

function mapBookingError(error: unknown): unknown {
  if (error instanceof BookingError) {
    return error
  }
  const message = getDatabaseErrorMessage(error)
  if (message.includes('booking_capacity_exceeded')) {
    return new BookingError('Not enough seats remain for that party.', 409)
  }
  if (message.includes('booking_schedule_not_open')) {
    return new BookingError('That departure is not open for booking.', 400)
  }
  if (getDatabaseErrorCode(error) === '23505') {
    return new BookingError('You already have a booking for this departure.', 409)
  }
  return error
}
