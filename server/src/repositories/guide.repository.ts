import type { PoolClient } from 'pg'
import type { BookingStatus, ScheduleStatus } from '../../../shared/src/index.ts'

export type AssignmentStatus = 'active' | 'replaced' | 'removed'

export interface AttendanceCounts {
  confirmedVisitors: number
  checkedInVisitors: number
  expectedVisitors: number
}

export interface GuideAccountRow {
  userId: number
  fullName: string
  email: string
  status: 'active' | 'inactive'
  guideId: number | null
  upcomingAssignments: number
}

export interface AssignmentRow extends AttendanceCounts {
  id: number
  scheduleId: number
  packageId: number
  packageName: string
  description: string
  includedActivities: string
  startsAt: Date
  endsAt: Date
  scheduleStatus: ScheduleStatus
  status: AssignmentStatus
  guideUserId: number | null
  guideName: string
  assignedByName: string | null
  assignedAt: Date
}

export interface DepartureRow extends AttendanceCounts {
  scheduleId: number
  packageId: number
  packageName: string
  startsAt: Date
  endsAt: Date
  scheduleStatus: ScheduleStatus
  assignmentId: number | null
  guideUserId: number | null
  guideName: string | null
  total: number
}

export interface VisitorRow {
  reference: string
  visitorName: string
  partySize: number
  bookingStatus: BookingStatus
  checkedIn: boolean
}

const attendanceSql = `
  COALESCE(SUM(bookings.party_size) FILTER (WHERE bookings.status = 'confirmed'), 0)::int AS confirmed_visitors,
  COALESCE(SUM(bookings.party_size) FILTER (WHERE bookings.status <> 'cancelled' AND receptions.id IS NOT NULL), 0)::int AS checked_in_visitors,
  COALESCE(SUM(bookings.party_size) FILTER (WHERE bookings.status = 'confirmed' AND receptions.id IS NULL), 0)::int AS expected_visitors
`

export async function listGuideAccounts(client: PoolClient, search: string): Promise<GuideAccountRow[]> {
  const result = await client.query<{
    id: string
    full_name: string
    email: string
    status: 'active' | 'inactive'
    guide_id: string | null
    upcoming_assignments: string
  }>(
    `SELECT users.id::text,
            users.full_name,
            users.email,
            users.status,
            guides.id::text AS guide_id,
            (
              SELECT count(*)
              FROM guide_assignments
              JOIN tour_schedules ON tour_schedules.id = guide_assignments.tour_schedule_id
              WHERE guide_assignments.guide_id = guides.id
                AND guide_assignments.status = 'active'
                AND tour_schedules.status = 'scheduled'
                AND tour_schedules.ends_at > now()
            )::text AS upcoming_assignments
     FROM users
     JOIN roles ON roles.id = users.role_id
     LEFT JOIN guides ON guides.user_id = users.id
     WHERE roles.name = 'tour_guide'
       AND (
         $1 = ''
         OR users.full_name ILIKE '%' || $1 || '%'
         OR users.email ILIKE '%' || $1 || '%'
       )
     ORDER BY users.full_name, users.id`,
    [search],
  )
  return result.rows.map((row) => ({
    userId: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    guideId: row.guide_id === null ? null : Number(row.guide_id),
    upcomingAssignments: Number(row.upcoming_assignments),
  }))
}

export async function findGuideAccount(client: PoolClient, userId: number): Promise<GuideAccountRow | undefined> {
  const guides = await listGuideAccounts(client, '')
  return guides.find((guide) => guide.userId === userId)
}

export async function listAssignmentsForGuide(client: PoolClient, guideUserId: number): Promise<AssignmentRow[]> {
  const result = await client.query(assignmentSelect(`WHERE guides.user_id = $1`), [guideUserId])
  return result.rows.map(mapAssignment)
}

export async function findAssignmentForGuide(
  client: PoolClient,
  assignmentId: number,
  guideUserId: number,
): Promise<AssignmentRow | undefined> {
  const result = await client.query(assignmentSelect(`WHERE guide_assignments.id = $1 AND guides.user_id = $2`), [
    assignmentId,
    guideUserId,
  ])
  const row = result.rows[0]
  return row ? mapAssignment(row) : undefined
}

export async function findAssignment(client: PoolClient, assignmentId: number): Promise<AssignmentRow | undefined> {
  const result = await client.query(assignmentSelect(`WHERE guide_assignments.id = $1`), [assignmentId])
  const row = result.rows[0]
  return row ? mapAssignment(row) : undefined
}

export async function listVisitors(client: PoolClient, scheduleId: number): Promise<VisitorRow[]> {
  const result = await client.query<{
    reference: string
    visitor_name: string
    party_size: number
    status: BookingStatus
    checked_in: boolean
  }>(
    `SELECT bookings.reference,
            tourists.full_name AS visitor_name,
            bookings.party_size,
            bookings.status,
            receptions.id IS NOT NULL AS checked_in
     FROM bookings
     JOIN tourists ON tourists.id = bookings.tourist_id
     LEFT JOIN receptions ON receptions.booking_id = bookings.id
     WHERE bookings.tour_schedule_id = $1
       AND bookings.status <> 'cancelled'
     ORDER BY bookings.reference`,
    [scheduleId],
  )
  return result.rows.map((row) => ({
    reference: row.reference,
    visitorName: row.visitor_name,
    partySize: Number(row.party_size),
    bookingStatus: row.status,
    checkedIn: row.checked_in,
  }))
}

export async function listDepartures(
  client: PoolClient,
  input: {
    search: string
    date: string
    packageId: number | null
    assignment: string
    scheduleId?: number | null
    limit: number
    offset: number
  },
): Promise<DepartureRow[]> {
  const result = await client.query<{
    schedule_id: string
    package_id: string
    package_name: string
    starts_at: Date
    ends_at: Date
    schedule_status: ScheduleStatus
    assignment_id: string | null
    guide_user_id: string | null
    guide_name: string | null
    confirmed_visitors: number
    checked_in_visitors: number
    expected_visitors: number
    total: string
  }>(
    `SELECT tour_schedules.id::text AS schedule_id,
            tour_packages.id::text AS package_id,
            tour_packages.name AS package_name,
            tour_schedules.starts_at,
            tour_schedules.ends_at,
            tour_schedules.status AS schedule_status,
            active.id::text AS assignment_id,
            guides.user_id::text AS guide_user_id,
            guides.full_name AS guide_name,
            counts.confirmed_visitors,
            counts.checked_in_visitors,
            counts.expected_visitors,
            count(*) OVER()::text AS total
     FROM tour_schedules
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     LEFT JOIN guide_assignments active
       ON active.tour_schedule_id = tour_schedules.id AND active.status = 'active'
     LEFT JOIN guides ON guides.id = active.guide_id
     LEFT JOIN LATERAL (
       SELECT ${attendanceSql}
       FROM bookings
       LEFT JOIN receptions ON receptions.booking_id = bookings.id
       WHERE bookings.tour_schedule_id = tour_schedules.id
     ) counts ON true
     WHERE ($1 = '' OR tour_packages.name ILIKE '%' || $1 || '%' OR guides.full_name ILIKE '%' || $1 || '%')
       AND ($2 = '' OR (tour_schedules.starts_at AT TIME ZONE 'Africa/Addis_Ababa')::date = NULLIF($2, '')::date)
       AND ($3::bigint IS NULL OR tour_packages.id = $3)
       AND (
         $4 = ''
         OR ($4 = 'assigned' AND active.id IS NOT NULL)
         OR ($4 = 'unassigned' AND active.id IS NULL)
       )
       AND ($7::bigint IS NULL OR tour_schedules.id = $7)
     ORDER BY tour_schedules.starts_at, tour_schedules.id
     LIMIT $5 OFFSET $6`,
    [input.search, input.date, input.packageId, input.assignment, input.limit, input.offset, input.scheduleId ?? null],
  )
  return result.rows.map((row) => ({
    scheduleId: Number(row.schedule_id),
    packageId: Number(row.package_id),
    packageName: row.package_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    scheduleStatus: row.schedule_status,
    assignmentId: row.assignment_id === null ? null : Number(row.assignment_id),
    guideUserId: row.guide_user_id === null ? null : Number(row.guide_user_id),
    guideName: row.guide_name,
    confirmedVisitors: Number(row.confirmed_visitors),
    checkedInVisitors: Number(row.checked_in_visitors),
    expectedVisitors: Number(row.expected_visitors),
    total: Number(row.total),
  }))
}

export async function lockSchedule(client: PoolClient, scheduleId: number): Promise<{
  id: number
  status: ScheduleStatus
  startsAt: Date
  endsAt: Date
} | undefined> {
  const result = await client.query<{ id: string; status: ScheduleStatus; starts_at: Date; ends_at: Date }>(
    `SELECT id::text, status, starts_at, ends_at
     FROM tour_schedules
     WHERE id = $1
     FOR UPDATE`,
    [scheduleId],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  return { id: Number(row.id), status: row.status, startsAt: row.starts_at, endsAt: row.ends_at }
}

export async function lockActiveAssignment(client: PoolClient, scheduleId: number): Promise<{
  id: number
  guideId: number
  guideUserId: number | null
  guideName: string
} | undefined> {
  const result = await client.query<{ id: string; guide_id: string; user_id: string | null; full_name: string }>(
    `SELECT guide_assignments.id::text, guide_assignments.guide_id::text, guides.user_id::text, guides.full_name
     FROM guide_assignments
     JOIN guides ON guides.id = guide_assignments.guide_id
     WHERE guide_assignments.tour_schedule_id = $1
       AND guide_assignments.status = 'active'
     FOR UPDATE OF guide_assignments`,
    [scheduleId],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  return {
    id: Number(row.id),
    guideId: Number(row.guide_id),
    guideUserId: row.user_id === null ? null : Number(row.user_id),
    guideName: row.full_name,
  }
}

export async function lockAssignmentById(client: PoolClient, assignmentId: number): Promise<{
  id: number
  scheduleId: number
  guideId: number
  guideUserId: number | null
  guideName: string
  status: AssignmentStatus
} | undefined> {
  const result = await client.query<{
    id: string
    tour_schedule_id: string
    guide_id: string
    user_id: string | null
    full_name: string
    status: AssignmentStatus
  }>(
    `SELECT guide_assignments.id::text,
            guide_assignments.tour_schedule_id::text,
            guide_assignments.guide_id::text,
            guides.user_id::text,
            guides.full_name,
            guide_assignments.status
     FROM guide_assignments
     JOIN guides ON guides.id = guide_assignments.guide_id
     WHERE guide_assignments.id = $1
     FOR UPDATE OF guide_assignments`,
    [assignmentId],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  return {
    id: Number(row.id),
    scheduleId: Number(row.tour_schedule_id),
    guideId: Number(row.guide_id),
    guideUserId: row.user_id === null ? null : Number(row.user_id),
    guideName: row.full_name,
    status: row.status,
  }
}

export async function findAssignableGuide(client: PoolClient, userId: number): Promise<{
  guideId: number | null
  userId: number
  fullName: string
  role: string
  active: boolean
} | undefined> {
  const result = await client.query<{
    guide_id: string | null
    user_id: string
    full_name: string
    role: string
    user_status: string
    guide_status: string | null
  }>(
    `SELECT guides.id::text AS guide_id,
            users.id::text AS user_id,
            users.full_name,
            roles.name AS role,
            users.status AS user_status,
            guides.status AS guide_status
     FROM users
     JOIN roles ON roles.id = users.role_id
     LEFT JOIN guides ON guides.user_id = users.id
     WHERE users.id = $1
     FOR SHARE OF users`,
    [userId],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  return {
    guideId: row.guide_id === null ? null : Number(row.guide_id),
    userId: Number(row.user_id),
    fullName: row.full_name,
    role: row.role,
    active: row.role === 'tour_guide' && row.user_status === 'active' && row.guide_status === 'active' && row.guide_id !== null,
  }
}

export async function guideOverlaps(
  client: PoolClient,
  guideId: number,
  startsAt: Date,
  endsAt: Date,
  ignoredAssignmentId: number | null,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
     FROM guide_assignments
     JOIN tour_schedules ON tour_schedules.id = guide_assignments.tour_schedule_id
     WHERE guide_assignments.guide_id = $1
       AND guide_assignments.status = 'active'
       AND ($2::bigint IS NULL OR guide_assignments.id <> $2)
       AND tour_schedules.starts_at < $4
       AND $3 < tour_schedules.ends_at
     LIMIT 1`,
    [guideId, ignoredAssignmentId, startsAt, endsAt],
  )
  return (result.rowCount ?? 0) > 0
}

export async function saveActiveAssignment(
  client: PoolClient,
  input: { scheduleId: number; guideId: number; assignedBy: number },
): Promise<number> {
  const existing = await client.query<{ id: string; status: AssignmentStatus }>(
    `SELECT id::text, status
     FROM guide_assignments
     WHERE tour_schedule_id = $1 AND guide_id = $2
     FOR UPDATE`,
    [input.scheduleId, input.guideId],
  )
  const row = existing.rows[0]
  if (row) {
    const updated = await client.query<{ id: string }>(
      `UPDATE guide_assignments
       SET status = 'active', assigned_by = $2, assigned_at = now(), closed_at = NULL
       WHERE id = $1
       RETURNING id::text`,
      [Number(row.id), input.assignedBy],
    )
    return Number(updated.rows[0]?.id)
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO guide_assignments (tour_schedule_id, guide_id, assigned_by, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING id::text`,
    [input.scheduleId, input.guideId, input.assignedBy],
  )
  return Number(inserted.rows[0]?.id)
}

export async function closeAssignment(
  client: PoolClient,
  assignmentId: number,
  status: 'replaced' | 'removed',
): Promise<void> {
  await client.query(
    `UPDATE guide_assignments
     SET status = $2, closed_at = now()
     WHERE id = $1`,
    [assignmentId, status],
  )
}

export async function writeAssignmentAudit(
  client: PoolClient,
  input: {
    administratorId: number
    action: 'guide.assign' | 'guide.reassign' | 'guide.unassign'
    scheduleId: number
    previousGuideUserId: number | null
    guideUserId: number | null
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'assignment', $3, $4::jsonb)`,
    [
      input.administratorId,
      input.action,
      String(input.scheduleId),
      JSON.stringify({
        scheduleId: input.scheduleId,
        previousGuideUserId: input.previousGuideUserId,
        guideUserId: input.guideUserId,
      }),
    ],
  )
}

interface AssignmentSqlRow {
  id: string
  schedule_id: string
  package_id: string
  package_name: string
  description: string
  included_activities: string
  starts_at: Date
  ends_at: Date
  schedule_status: ScheduleStatus
  status: AssignmentStatus
  guide_user_id: string | null
  guide_name: string
  assigned_by_name: string | null
  assigned_at: Date
  confirmed_visitors: number
  checked_in_visitors: number
  expected_visitors: number
}

function assignmentSelect(where: string): string {
  return `SELECT guide_assignments.id::text,
                 tour_schedules.id::text AS schedule_id,
                 tour_packages.id::text AS package_id,
                 tour_packages.name AS package_name,
                 tour_packages.description,
                 tour_packages.included_activities,
                 tour_schedules.starts_at,
                 tour_schedules.ends_at,
                 tour_schedules.status AS schedule_status,
                 guide_assignments.status,
                 guides.user_id::text AS guide_user_id,
                 guides.full_name AS guide_name,
                 assigner.full_name AS assigned_by_name,
                 guide_assignments.assigned_at,
                 counts.confirmed_visitors,
                 counts.checked_in_visitors,
                 counts.expected_visitors
          FROM guide_assignments
          JOIN tour_schedules ON tour_schedules.id = guide_assignments.tour_schedule_id
          JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
          JOIN guides ON guides.id = guide_assignments.guide_id
          LEFT JOIN users assigner ON assigner.id = guide_assignments.assigned_by
          LEFT JOIN LATERAL (
            SELECT ${attendanceSql}
            FROM bookings
            LEFT JOIN receptions ON receptions.booking_id = bookings.id
            WHERE bookings.tour_schedule_id = tour_schedules.id
          ) counts ON true
          ${where}
          ORDER BY guide_assignments.assigned_at DESC, guide_assignments.id DESC`
}

function mapAssignment(row: AssignmentSqlRow): AssignmentRow {
  return {
    id: Number(row.id),
    scheduleId: Number(row.schedule_id),
    packageId: Number(row.package_id),
    packageName: row.package_name,
    description: row.description,
    includedActivities: row.included_activities,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    scheduleStatus: row.schedule_status,
    status: row.status,
    guideUserId: row.guide_user_id === null ? null : Number(row.guide_user_id),
    guideName: row.guide_name,
    assignedByName: row.assigned_by_name,
    assignedAt: row.assigned_at,
    confirmedVisitors: Number(row.confirmed_visitors),
    checkedInVisitors: Number(row.checked_in_visitors),
    expectedVisitors: Number(row.expected_visitors),
  }
}
