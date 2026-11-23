import type { AttendanceSummary, CheckInPage, CheckInPreview, CheckInRecord } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'
import { getDatabaseErrorCode, getDatabaseErrorMessage } from '../db/errors.ts'
import { withTransaction } from '../db/transaction.ts'
import {
  attendanceSummary,
  eligibility,
  findCheckInByReference,
  findCheckInByToken,
  insertReception,
  listCheckIns,
  lockCheckInByReference,
  lockCheckInByToken,
  palaceToday,
  toPreview,
  writeCheckInAudit,
  type CheckInSource,
} from '../repositories/checkin.repository.ts'

export class CheckInError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function checkInStatus(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof CheckInError) {
    return { status: error.status, message: error.message }
  }
  return undefined
}

export async function previewByToken(token: string): Promise<CheckInPreview> {
  const row = await findCheckInByToken(token)
  if (!row) {
    throw new CheckInError('That ticket was not found.', 404)
  }
  return toPreview(row)
}

export async function previewByReference(reference: string): Promise<CheckInPreview> {
  const row = await findCheckInByReference(reference)
  if (!row) {
    throw new CheckInError('That booking was not found.', 404)
  }
  return toPreview(row)
}

export async function checkIn(receptionistId: number, input: { token?: string; reference?: string }): Promise<CheckInRecord> {
  return withTransaction(pool, async (client) => {
    const row = input.token
      ? await lockCheckInByToken(client, input.token)
      : await lockCheckInByReference(client, input.reference ?? '')
    if (!row) {
      throw new CheckInError(input.token ? 'That ticket was not found.' : 'That booking was not found.', 404)
    }
    if (row.checkedInAt) {
      throw new CheckInError('This ticket has already been checked in.', 409)
    }
    const decision = eligibility(row)
    if (!decision.eligible || !row.ticketId) {
      throw new CheckInError(decision.reason ?? 'This ticket cannot be checked in.', 400)
    }
    try {
      const arrivedAt = await insertReception(client, row.bookingId, row.ticketId, receptionistId)
      await writeCheckInAudit(client, receptionistId, row.reference, row.ticketId, row.partySize, arrivedAt)
      const name = await client.query<{ full_name: string }>('SELECT full_name FROM users WHERE id = $1', [receptionistId])
      return toRecord(row, arrivedAt, name.rows[0]?.full_name ?? 'Reception')
    } catch (error) {
      throw mapCheckInError(error)
    }
  })
}

export async function receptionHistory(search: string, date: string, page: number, pageSize: number): Promise<CheckInPage> {
  return listCheckIns({ search, date, packageId: null, page, pageSize })
}

export async function adminHistory(
  search: string,
  date: string,
  packageId: number | null,
  page: number,
  pageSize: number,
): Promise<CheckInPage> {
  return listCheckIns({ search, date, packageId, page, pageSize })
}

export async function adminSummary(date: string): Promise<AttendanceSummary> {
  return attendanceSummary(date || (await palaceToday()))
}

function toRecord(row: CheckInSource, arrivedAt: Date, receptionistName: string): CheckInRecord {
  return {
    reference: row.reference,
    touristName: row.touristName,
    packageId: row.packageId,
    packageName: row.packageName,
    startsAt: row.startsAt.toISOString(),
    partySize: row.partySize,
    arrivedAt: arrivedAt.toISOString(),
    receptionistName,
  }
}

function mapCheckInError(error: unknown): unknown {
  if (error instanceof CheckInError) {
    return error
  }
  const message = getDatabaseErrorMessage(error)
  if (getDatabaseErrorCode(error) === '23505' || message.includes('already')) {
    return new CheckInError('This ticket has already been checked in.', 409)
  }
  if (message.includes('checkin_ticket_void') || message.includes('checkin_ticket_missing') || message.includes('checkin_ticket_required')) {
    return new CheckInError('This booking does not have a valid ticket.', 400)
  }
  if (message.includes('checkin_booking_closed')) {
    return new CheckInError('A cancelled booking cannot be checked in.', 400)
  }
  if (message.includes('checkin_unpaid')) {
    return new CheckInError('This booking has not been paid.', 400)
  }
  if (message.includes('checkin_schedule_closed')) {
    return new CheckInError('That departure has been cancelled.', 400)
  }
  if (message.includes('checkin_wrong_date')) {
    return new CheckInError('Check-in is only available on the scheduled visit date.', 400)
  }
  if (message.includes('staff_actor_required')) {
    return new CheckInError('Only reception can check visitors in.', 403)
  }
  return error
}
