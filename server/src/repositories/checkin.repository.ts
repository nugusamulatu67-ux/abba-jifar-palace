import type { PoolClient } from 'pg'
import type { AttendanceSummary, CheckInPage, CheckInPreview, CheckInRecord } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'

export interface CheckInSource {
  bookingId: number
  reference: string
  touristName: string
  packageId: number
  packageName: string
  startsAt: Date
  endsAt: Date
  partySize: number
  paymentStatus: 'unpaid' | 'paid'
  ticketId: number | null
  ticketStatus: 'valid' | 'void' | null
  bookingStatus: 'pending' | 'confirmed' | 'cancelled'
  scheduleStatus: string
  visitDay: string
  palaceToday: string
  checkedInAt: Date | null
}

const sourceSelect = `
  SELECT
    bookings.id::text AS booking_id,
    bookings.reference,
    tourists.full_name AS tourist_name,
    tour_packages.id::text AS package_id,
    tour_packages.name AS package_name,
    tour_schedules.starts_at,
    tour_schedules.ends_at,
    tour_schedules.status AS schedule_status,
    bookings.party_size,
    bookings.status AS booking_status,
    payments.status AS payment_status,
    tickets.id::text AS ticket_id,
    tickets.status AS ticket_status,
    receptions.arrived_at AS checked_in_at,
    to_char((tour_schedules.starts_at AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-DD') AS visit_day,
    to_char((now() AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-DD') AS palace_today
  FROM bookings
  JOIN tourists ON tourists.id = bookings.tourist_id
  JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
  JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
  JOIN payments ON payments.booking_id = bookings.id
  LEFT JOIN tickets ON tickets.booking_id = bookings.id
  LEFT JOIN receptions ON receptions.booking_id = bookings.id
`

export async function lockCheckInByToken(client: PoolClient, token: string): Promise<CheckInSource | undefined> {
  const result = await client.query(`${sourceSelect} WHERE tickets.token = $1 FOR UPDATE OF tickets, bookings`, [token])
  return result.rows[0] ? mapSource(result.rows[0]) : undefined
}

export async function lockCheckInByReference(client: PoolClient, reference: string): Promise<CheckInSource | undefined> {
  const result = await client.query(`${sourceSelect} WHERE bookings.reference = $1 FOR UPDATE OF bookings`, [reference])
  return result.rows[0] ? mapSource(result.rows[0]) : undefined
}

export async function findCheckInByToken(token: string): Promise<CheckInSource | undefined> {
  const result = await pool.query(`${sourceSelect} WHERE tickets.token = $1`, [token])
  return result.rows[0] ? mapSource(result.rows[0]) : undefined
}

export async function findCheckInByReference(reference: string): Promise<CheckInSource | undefined> {
  const result = await pool.query(`${sourceSelect} WHERE bookings.reference = $1`, [reference])
  return result.rows[0] ? mapSource(result.rows[0]) : undefined
}

export async function insertReception(
  client: PoolClient,
  bookingId: number,
  ticketId: number,
  receptionistId: number,
): Promise<Date> {
  const result = await client.query<{ arrived_at: Date }>(
    `INSERT INTO receptions (booking_id, ticket_id, received_by)
     VALUES ($1, $2, $3)
     RETURNING arrived_at`,
    [bookingId, ticketId, receptionistId],
  )
  const arrivedAt = result.rows[0]?.arrived_at
  if (!arrivedAt) {
    throw new Error('checkin_not_saved')
  }
  return arrivedAt
}

export async function writeCheckInAudit(
  client: PoolClient,
  receptionistId: number,
  reference: string,
  ticketId: number,
  partySize: number,
  arrivedAt: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, 'visitor.checkin', 'checkin', $2, $3::jsonb)`,
    [
      receptionistId,
      reference,
      JSON.stringify({
        ticketId,
        partySize,
        arrivedAt: arrivedAt.toISOString(),
      }),
    ],
  )
}

export async function listCheckIns(input: {
  search: string
  date: string
  packageId: number | null
  page: number
  pageSize: number
}): Promise<CheckInPage> {
  const offset = (input.page - 1) * input.pageSize
  const result = await pool.query(
    `SELECT
       bookings.reference,
       tourists.full_name AS tourist_name,
       tour_packages.id::text AS package_id,
       tour_packages.name AS package_name,
       tour_schedules.starts_at,
       bookings.party_size,
       receptions.arrived_at,
       users.full_name AS receptionist_name,
       count(*) OVER()::text AS total
     FROM receptions
     JOIN bookings ON bookings.id = receptions.booking_id
     JOIN tourists ON tourists.id = bookings.tourist_id
     JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     JOIN users ON users.id = receptions.received_by
     WHERE ($1 = '' OR bookings.reference ILIKE $1 || '%' OR tourists.full_name ILIKE '%' || $1 || '%')
       AND (
         $2 = ''
         OR (receptions.arrived_at AT TIME ZONE 'Africa/Addis_Ababa')::date = NULLIF($2, '')::date
       )
       AND ($3::bigint IS NULL OR tour_packages.id = $3)
     ORDER BY receptions.arrived_at DESC, receptions.id DESC
     LIMIT $4 OFFSET $5`,
    [input.search, input.date, input.packageId, input.pageSize, offset],
  )
  const total = Number(result.rows[0]?.total ?? 0)
  return {
    checkIns: result.rows.map(mapRecord),
    page: input.page,
    pageSize: input.pageSize,
    total,
  }
}

export async function attendanceSummary(date: string): Promise<AttendanceSummary> {
  const totals = await pool.query<{ check_ins: string; visitors: string; visit_date: string }>(
    `SELECT
       count(*)::text AS check_ins,
       COALESCE(SUM(bookings.party_size), 0)::text AS visitors,
       to_char($1::date, 'YYYY-MM-DD') AS visit_date
     FROM receptions
     JOIN bookings ON bookings.id = receptions.booking_id
     WHERE (receptions.arrived_at AT TIME ZONE 'Africa/Addis_Ababa')::date = $1::date`,
    [date],
  )
  const tours = await pool.query(
    `SELECT
       tour_packages.id::text AS package_id,
       tour_packages.name AS package_name,
       count(*)::text AS check_ins,
       COALESCE(SUM(bookings.party_size), 0)::text AS visitors
     FROM receptions
     JOIN bookings ON bookings.id = receptions.booking_id
     JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE (receptions.arrived_at AT TIME ZONE 'Africa/Addis_Ababa')::date = $1::date
     GROUP BY tour_packages.id, tour_packages.name
     ORDER BY tour_packages.name`,
    [date],
  )
  return {
    date: totals.rows[0]?.visit_date ?? date,
    totalCheckIns: Number(totals.rows[0]?.check_ins ?? 0),
    totalVisitors: Number(totals.rows[0]?.visitors ?? 0),
    tours: tours.rows.map((row) => ({
      packageId: Number(row.package_id),
      packageName: String(row.package_name),
      checkIns: Number(row.check_ins),
      visitors: Number(row.visitors),
    })),
  }
}

export async function palaceToday(): Promise<string> {
  const result = await pool.query<{ today: string }>(
    `SELECT to_char((now() AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-DD') AS today`,
  )
  return result.rows[0]?.today ?? ''
}

export function toPreview(row: CheckInSource): CheckInPreview {
  const decision = eligibility(row)
  return {
    palace: 'Abba Jifar Palace',
    reference: row.reference,
    touristName: row.touristName,
    packageId: row.packageId,
    packageName: row.packageName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    partySize: row.partySize,
    paymentStatus: row.paymentStatus,
    ticketStatus: row.ticketStatus ?? 'missing',
    bookingStatus: row.bookingStatus,
    eligible: decision.eligible,
    reason: decision.reason,
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
  }
}

export function eligibility(row: CheckInSource): { eligible: boolean; reason: string | null } {
  if (row.checkedInAt) {
    return { eligible: false, reason: 'This ticket has already been checked in.' }
  }
  if (!row.ticketId || row.ticketStatus !== 'valid') {
    return { eligible: false, reason: 'This booking does not have a valid ticket.' }
  }
  if (row.bookingStatus === 'cancelled') {
    return { eligible: false, reason: 'A cancelled booking cannot be checked in.' }
  }
  if (row.paymentStatus !== 'paid') {
    return { eligible: false, reason: 'This booking has not been paid.' }
  }
  if (row.scheduleStatus !== 'scheduled') {
    return { eligible: false, reason: 'That departure has been cancelled.' }
  }
  if (row.visitDay !== row.palaceToday) {
    return { eligible: false, reason: 'Check-in is only available on the scheduled visit date.' }
  }
  return { eligible: true, reason: null }
}

function mapSource(row: Record<string, unknown>): CheckInSource {
  return {
    bookingId: Number(row.booking_id),
    reference: String(row.reference),
    touristName: String(row.tourist_name),
    packageId: Number(row.package_id),
    packageName: String(row.package_name),
    startsAt: row.starts_at as Date,
    endsAt: row.ends_at as Date,
    partySize: Number(row.party_size),
    paymentStatus: row.payment_status as CheckInSource['paymentStatus'],
    ticketId: row.ticket_id === null || row.ticket_id === undefined ? null : Number(row.ticket_id),
    ticketStatus: (row.ticket_status as CheckInSource['ticketStatus']) ?? null,
    bookingStatus: row.booking_status as CheckInSource['bookingStatus'],
    scheduleStatus: String(row.schedule_status),
    visitDay: String(row.visit_day),
    palaceToday: String(row.palace_today),
    checkedInAt: (row.checked_in_at as Date | null) ?? null,
  }
}

function mapRecord(row: Record<string, unknown>): CheckInRecord {
  return {
    reference: String(row.reference),
    touristName: String(row.tourist_name),
    packageId: Number(row.package_id),
    packageName: String(row.package_name),
    startsAt: row.starts_at instanceof Date ? row.starts_at.toISOString() : new Date(String(row.starts_at)).toISOString(),
    partySize: Number(row.party_size),
    arrivedAt: row.arrived_at instanceof Date ? row.arrived_at.toISOString() : new Date(String(row.arrived_at)).toISOString(),
    receptionistName: String(row.receptionist_name),
  }
}
