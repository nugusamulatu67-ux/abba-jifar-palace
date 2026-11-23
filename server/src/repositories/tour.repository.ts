import type { PoolClient } from 'pg'
import type {
  AdminSchedule,
  AdminTourPackage,
  PackageStatus,
  PublicSchedule,
  PublicTourDetail,
  PublicTourPackage,
  ScheduleStatus,
} from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'
import type { PackageInput, ScheduleInput } from '../validation/tour.ts'

interface PackageRow {
  id: string
  name: string
  description: string
  price_etb: number
  duration_minutes: number
  category: string
  included_activities: string
  max_group_size: number | null
  status: PackageStatus
  created_at: Date
  updated_at: Date
  upcoming_count?: string
  next_starts_at?: Date | null
}

interface ScheduleRow {
  id: string
  tour_package_id: string
  package_name: string
  package_status: PackageStatus
  starts_at: Date
  ends_at: Date
  max_capacity: number
  remaining_capacity: string
  status: ScheduleStatus
  created_at: Date
  updated_at: Date
}

const returningColumns = `
  id, name, description, price_etb, duration_minutes, category,
  included_activities, max_group_size, status, created_at, updated_at
`

const packageColumns = `
  tour_packages.id,
  tour_packages.name,
  tour_packages.description,
  tour_packages.price_etb,
  tour_packages.duration_minutes,
  tour_packages.category,
  tour_packages.included_activities,
  tour_packages.max_group_size,
  tour_packages.status,
  tour_packages.created_at,
  tour_packages.updated_at
`

const remainingSeats = `
  tour_schedules.max_capacity - COALESCE((
    SELECT SUM(bookings.party_size)
    FROM bookings
    WHERE bookings.tour_schedule_id = tour_schedules.id
      AND bookings.status IN ('pending', 'confirmed')
  ), 0)
`

export async function listPublicPackages(): Promise<PublicTourPackage[]> {
  const result = await pool.query<PackageRow>(
    `SELECT ${packageColumns},
       (
         SELECT count(*)
         FROM tour_schedules
         WHERE tour_schedules.tour_package_id = tour_packages.id
           AND tour_schedules.status = 'scheduled'
           AND tour_schedules.starts_at > now()
       )::text AS upcoming_count,
       (
         SELECT min(starts_at)
         FROM tour_schedules
         WHERE tour_schedules.tour_package_id = tour_packages.id
           AND tour_schedules.status = 'scheduled'
           AND tour_schedules.starts_at > now()
       ) AS next_starts_at
     FROM tour_packages
     WHERE status = 'active'
     ORDER BY name`,
  )
  return result.rows.map(toPublicPackage)
}

export async function findPublicPackage(id: number): Promise<PublicTourDetail | undefined> {
  const result = await pool.query<PackageRow>(
    `SELECT ${packageColumns},
       (
         SELECT count(*)
         FROM tour_schedules
         WHERE tour_schedules.tour_package_id = tour_packages.id
           AND tour_schedules.status = 'scheduled'
           AND tour_schedules.starts_at > now()
       )::text AS upcoming_count,
       (
         SELECT min(starts_at)
         FROM tour_schedules
         WHERE tour_schedules.tour_package_id = tour_packages.id
           AND tour_schedules.status = 'scheduled'
           AND tour_schedules.starts_at > now()
       ) AS next_starts_at
     FROM tour_packages
     WHERE id = $1 AND status = 'active'`,
    [id],
  )
  const row = result.rows[0]
  if (!row) {
    return undefined
  }
  const schedules = await listPublicSchedules(id)
  return { ...toPublicPackage(row), schedules }
}

export async function listPublicSchedules(packageId?: number): Promise<PublicSchedule[]> {
  const result = await pool.query<ScheduleRow>(
    `SELECT
       tour_schedules.id,
       tour_schedules.tour_package_id,
       tour_packages.name AS package_name,
       tour_packages.status AS package_status,
       tour_schedules.starts_at,
       tour_schedules.ends_at,
       tour_schedules.max_capacity,
       (${remainingSeats})::text AS remaining_capacity,
       tour_schedules.status,
       tour_schedules.created_at,
       tour_schedules.updated_at
     FROM tour_schedules
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE tour_packages.status = 'active'
       AND tour_schedules.status = 'scheduled'
       AND tour_schedules.starts_at > now()
       AND ($1::bigint IS NULL OR tour_schedules.tour_package_id = $1)
     ORDER BY tour_schedules.starts_at`,
    [packageId ?? null],
  )
  return result.rows.map(toPublicSchedule)
}

export async function findPublicSchedule(id: number): Promise<PublicSchedule | undefined> {
  const result = await pool.query<ScheduleRow>(
    `SELECT
       tour_schedules.id,
       tour_schedules.tour_package_id,
       tour_packages.name AS package_name,
       tour_packages.status AS package_status,
       tour_schedules.starts_at,
       tour_schedules.ends_at,
       tour_schedules.max_capacity,
       (${remainingSeats})::text AS remaining_capacity,
       tour_schedules.status,
       tour_schedules.created_at,
       tour_schedules.updated_at
     FROM tour_schedules
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE tour_schedules.id = $1
       AND tour_packages.status = 'active'
       AND tour_schedules.status = 'scheduled'
       AND tour_schedules.starts_at > now()`,
    [id],
  )
  const row = result.rows[0]
  return row ? toPublicSchedule(row) : undefined
}

export async function listAdminPackages(search: string, status: string): Promise<AdminTourPackage[]> {
  const result = await pool.query<PackageRow>(
    `SELECT ${packageColumns}
     FROM tour_packages
     WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR category ILIKE '%' || $1 || '%')
       AND ($2 = '' OR status = $2)
     ORDER BY updated_at DESC, name`,
    [search, status],
  )
  return result.rows.map(toAdminPackage)
}

export async function findAdminPackage(id: number): Promise<AdminTourPackage | undefined> {
  const result = await pool.query<PackageRow>(`SELECT ${packageColumns} FROM tour_packages WHERE id = $1`, [id])
  const row = result.rows[0]
  return row ? toAdminPackage(row) : undefined
}

export async function insertPackage(input: PackageInput): Promise<AdminTourPackage> {
  const result = await pool.query<PackageRow>(
    `INSERT INTO tour_packages (
       name, description, price_etb, duration_minutes, category, included_activities, max_group_size
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${returningColumns}`,
    [
      input.name,
      input.description,
      input.priceEtb,
      input.durationMinutes,
      input.category,
      input.includedActivities,
      input.maxGroupSize,
    ],
  )
  return toAdminPackage(result.rows[0] as PackageRow)
}

export async function updatePackage(id: number, input: PackageInput): Promise<AdminTourPackage | undefined> {
  const result = await pool.query<PackageRow>(
    `UPDATE tour_packages
     SET name = $2,
         description = $3,
         price_etb = $4,
         duration_minutes = $5,
         category = $6,
         included_activities = $7,
         max_group_size = $8
     WHERE id = $1
     RETURNING ${returningColumns}`,
    [
      id,
      input.name,
      input.description,
      input.priceEtb,
      input.durationMinutes,
      input.category,
      input.includedActivities,
      input.maxGroupSize,
    ],
  )
  const row = result.rows[0]
  return row ? toAdminPackage(row) : undefined
}

export async function updatePackageStatus(id: number, status: PackageStatus): Promise<AdminTourPackage | undefined> {
  const result = await pool.query<PackageRow>(
    `UPDATE tour_packages SET status = $2 WHERE id = $1 RETURNING ${returningColumns}`,
    [id, status],
  )
  const row = result.rows[0]
  return row ? toAdminPackage(row) : undefined
}

export async function listAdminSchedules(packageId: number | undefined, status: string): Promise<AdminSchedule[]> {
  const result = await pool.query<ScheduleRow>(
    `SELECT
       tour_schedules.id,
       tour_schedules.tour_package_id,
       tour_packages.name AS package_name,
       tour_packages.status AS package_status,
       tour_schedules.starts_at,
       tour_schedules.ends_at,
       tour_schedules.max_capacity,
       (${remainingSeats})::text AS remaining_capacity,
       tour_schedules.status,
       tour_schedules.created_at,
       tour_schedules.updated_at
     FROM tour_schedules
     JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
     WHERE ($1::bigint IS NULL OR tour_schedules.tour_package_id = $1)
       AND ($2 = '' OR tour_schedules.status = $2)
     ORDER BY tour_schedules.starts_at`,
    [packageId ?? null, status],
  )
  return result.rows.map(toAdminSchedule)
}

export async function findAdminSchedule(id: number): Promise<AdminSchedule | undefined> {
  const rows = await listAdminSchedules(undefined, '')
  return rows.find((schedule) => schedule.id === id)
}

export async function insertSchedule(client: PoolClient, input: ScheduleInput): Promise<number> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO tour_schedules (tour_package_id, starts_at, ends_at, max_capacity)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [input.packageId, input.startsAt.toISOString(), input.endsAt.toISOString(), input.maxCapacity],
  )
  return Number(result.rows[0]?.id)
}

export async function updateSchedule(client: PoolClient, id: number, input: ScheduleInput): Promise<boolean> {
  const result = await client.query(
    `UPDATE tour_schedules
     SET tour_package_id = $2, starts_at = $3, ends_at = $4, max_capacity = $5
     WHERE id = $1 AND status = 'scheduled'`,
    [id, input.packageId, input.startsAt.toISOString(), input.endsAt.toISOString(), input.maxCapacity],
  )
  return (result.rowCount ?? 0) > 0
}

export async function cancelSchedule(id: number): Promise<AdminSchedule | undefined> {
  await pool.query(
    `UPDATE tour_schedules SET status = 'cancelled' WHERE id = $1 AND status = 'scheduled'`,
    [id],
  )
  return findAdminSchedule(id)
}

export async function bookedSeats(client: PoolClient, scheduleId: number): Promise<number> {
  const result = await client.query<{ seats: string }>(
    `SELECT COALESCE(SUM(party_size), 0)::text AS seats
     FROM bookings
     WHERE tour_schedule_id = $1 AND status IN ('pending', 'confirmed')`,
    [scheduleId],
  )
  return Number(result.rows[0]?.seats ?? 0)
}

export async function lockPackage(client: PoolClient, id: number): Promise<AdminTourPackage | undefined> {
  const result = await client.query<PackageRow>(
    `SELECT ${packageColumns} FROM tour_packages WHERE id = $1 FOR UPDATE`,
    [id],
  )
  const row = result.rows[0]
  return row ? toAdminPackage(row) : undefined
}

function toPublicPackage(row: PackageRow): PublicTourPackage {
  return {
    ...packageFields(row),
    upcomingCount: Number(row.upcoming_count ?? 0),
    nextStartsAt: row.next_starts_at ? row.next_starts_at.toISOString() : null,
  }
}

function toAdminPackage(row: PackageRow): AdminTourPackage {
  return {
    ...packageFields(row),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function packageFields(row: PackageRow) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    priceEtb: row.price_etb,
    durationMinutes: row.duration_minutes,
    category: row.category,
    includedActivities: row.included_activities,
    maxGroupSize: row.max_group_size,
  }
}

function toPublicSchedule(row: ScheduleRow): PublicSchedule {
  const remainingCapacity = Number(row.remaining_capacity)
  return {
    id: Number(row.id),
    packageId: Number(row.tour_package_id),
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    maxCapacity: row.max_capacity,
    remainingCapacity,
    bookable: row.package_status === 'active' && row.status === 'scheduled' && remainingCapacity > 0 && row.starts_at > new Date(),
  }
}

function toAdminSchedule(row: ScheduleRow): AdminSchedule {
  return {
    ...toPublicSchedule(row),
    packageName: row.package_name,
    packageStatus: row.package_status,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}
