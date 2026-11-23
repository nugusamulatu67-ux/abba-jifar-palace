import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import type { PoolClient } from 'pg'
import { env } from '../src/config/env.ts'
import { getDatabaseErrorCode, getDatabaseErrorMessage } from '../src/db/errors.ts'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { bookTour } from '../src/repositories/booking.repository.ts'
import { verifyPassword } from '../src/security/password.ts'

const { Client, Pool } = pg

const testDatabaseUrl = new URL(env.databaseUrl)
testDatabaseUrl.pathname = '/abba_jifar_test'

let testPool: InstanceType<typeof Pool>

async function recreateTestDatabase(): Promise<void> {
  const admin = new Client({ connectionString: env.databaseUrl })
  await admin.connect()
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = 'abba_jifar_test' AND pid <> pg_backend_pid()`,
    )
    await admin.query('DROP DATABASE IF EXISTS abba_jifar_test')
    await admin.query('CREATE DATABASE abba_jifar_test')
  } finally {
    await admin.end()
  }
}

async function withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await testPool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('ROLLBACK')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

test.before(async () => {
  await recreateTestDatabase()
  const applied = await migrate(testDatabaseUrl.toString())
  assert.deepEqual(applied, [
    '001_init.sql',
    '002_auth_roles.sql',
    '003_tour_package_details.sql',
    '004_booking_reference.sql',
    '005_tickets.sql',
  ])
  const appliedAgain = await migrate(testDatabaseUrl.toString())
  assert.deepEqual(appliedAgain, [])
  testPool = new Pool({ connectionString: testDatabaseUrl.toString() })
})

test.after(async () => {
  await testPool.end()
})

test('migration creates every application table', async () => {
  const result = await testPool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  )
  assert.deepEqual(
    result.rows.map((row) => row.table_name),
    [
      'announcements',
      'audit_logs',
      'bookings',
      'guide_assignments',
      'guides',
      'payments',
      'receptions',
      'roles',
      'schema_migrations',
      'sessions',
      'tickets',
      'tour_packages',
      'tour_schedules',
      'tourists',
      'users',
      'visit_logs',
      'visitor_feedback',
    ],
  )
})

test('a foreign key rejects a booking for a missing tourist', async () => {
  await withClient(async (client) => {
    const error = await client
      .query(
        `INSERT INTO bookings (tourist_id, tour_schedule_id, party_size)
         VALUES (999999, 999999, 1)`,
      )
      .then(
        () => undefined,
        (caught: unknown) => caught,
      )
    assert.equal(getDatabaseErrorCode(error), '23503')
  })
})

test('a unique constraint rejects a duplicate user email', async () => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO users (role_id, full_name, email, password_hash)
       SELECT id, 'First Visitor', 'visitor@abba-jifar.local', 'hash'
       FROM roles WHERE name = 'tourist'`,
    )
    const error = await client
      .query(
        `INSERT INTO users (role_id, full_name, email, password_hash)
         SELECT id, 'Second Visitor', 'visitor@abba-jifar.local', 'hash'
         FROM roles WHERE name = 'tourist'`,
      )
      .then(
        () => undefined,
        (caught: unknown) => caught,
      )
    assert.equal(getDatabaseErrorCode(error), '23505')
  })
})

test('a rolled-back transaction does not keep the inserted row', async () => {
  const client = await testPool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO tour_packages (name, description, price_etb, duration_minutes)
       VALUES ('Rollback Package', 'Temporary', 100, 60)`,
    )
    await client.query('ROLLBACK')
  } finally {
    client.release()
  }

  const result = await testPool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM tour_packages WHERE name = 'Rollback Package'`,
  )
  assert.equal(result.rows[0]?.count, '0')
})

test('a booking without a payment fails when the transaction commits', async () => {
  const client = await testPool.connect()
  try {
    await client.query('BEGIN')
    const touristId = await insertTourist(client, 'No Payment')
    const scheduleId = await insertSchedule(client, 4)
    await client.query(
      `INSERT INTO bookings (tourist_id, tour_schedule_id, party_size)
       VALUES ($1, $2, 1)`,
      [touristId, scheduleId],
    )
    const error = await client.query('COMMIT').then(
      () => undefined,
      (caught: unknown) => caught,
    )
    assert.match(getDatabaseErrorMessage(error), /booking_requires_payment/)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
  }
})

test('bookTour stores the booking and payment in one transaction', async () => {
  const touristId = await insertTouristCommitted('Ada')
  const scheduleId = await insertScheduleCommitted(3)
  try {
    const created = await bookTour(
      { touristId, tourScheduleId: scheduleId, partySize: 2, amountEtb: 400 },
      testPool,
    )
    const rows = await testPool.query<{ booking_id: string; amount_etb: number }>(
      'SELECT booking_id::text, amount_etb FROM payments WHERE id = $1',
      [created.paymentId],
    )
    assert.equal(rows.rows[0]?.booking_id, String(created.bookingId))
    assert.equal(rows.rows[0]?.amount_etb, 400)
  } finally {
    await clearSchedule(scheduleId, [touristId])
  }
})

test('confirmed and pending bookings cannot exceed schedule capacity', async () => {
  const firstTourist = await insertTouristCommitted('Capacity One')
  const secondTourist = await insertTouristCommitted('Capacity Two')
  const scheduleId = await insertScheduleCommitted(1)
  try {
    const results = await Promise.allSettled([
      bookTour({ touristId: firstTourist, tourScheduleId: scheduleId, partySize: 1, amountEtb: 100 }, testPool),
      bookTour({ touristId: secondTourist, tourScheduleId: scheduleId, partySize: 1, amountEtb: 100 }, testPool),
    ])
    const succeeded = results.filter((result) => result.status === 'fulfilled')
    const failed = results.filter((result) => result.status === 'rejected')
    assert.equal(succeeded.length, 1)
    assert.equal(failed.length, 1)
    assert.match(getDatabaseErrorMessage(failed[0]?.reason), /booking_capacity_exceeded/)

    const remaining = await testPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM bookings WHERE tour_schedule_id = $1`,
      [scheduleId],
    )
    assert.equal(remaining.rows[0]?.count, '1')
  } finally {
    await clearSchedule(scheduleId, [firstTourist, secondTourist])
  }
})

test('the same tourist cannot hold two active bookings for one schedule', async () => {
  const touristId = await insertTouristCommitted('Repeat Visitor')
  const scheduleId = await insertScheduleCommitted(5)
  try {
    await bookTour({ touristId, tourScheduleId: scheduleId, partySize: 1, amountEtb: 100 }, testPool)
    const error = await bookTour(
      { touristId, tourScheduleId: scheduleId, partySize: 1, amountEtb: 100 },
      testPool,
    ).then(
      () => undefined,
      (caught: unknown) => caught,
    )
    assert.equal(getDatabaseErrorCode(error), '23505')
  } finally {
    await clearSchedule(scheduleId, [touristId])
  }
})

test('only staff or an administrator can be recorded on a payment', async () => {
  await withClient(async (client) => {
    const visitor = await client.query<{ id: string }>(
      `INSERT INTO users (role_id, full_name, email, password_hash)
       SELECT id, 'Visitor Person', 'pay-visitor@abba-jifar.local', 'hash'
       FROM roles WHERE name = 'tourist'
       RETURNING id::text`,
    )
    const touristId = await insertTourist(client, 'Payment Visitor', Number(visitor.rows[0]?.id))
    const scheduleId = await insertSchedule(client, 2)
    await bookTour(
      { touristId, tourScheduleId: scheduleId, partySize: 1, amountEtb: 100 },
      client,
    )
    await client.query('SAVEPOINT before_recorder')
    const error = await client
      .query('UPDATE payments SET recorded_by = $1', [Number(visitor.rows[0]?.id)])
      .then(
        () => undefined,
        (caught: unknown) => caught,
      )
    assert.match(getDatabaseErrorMessage(error), /staff_actor_required/)
    await client.query('ROLLBACK TO SAVEPOINT before_recorder')
  })
})

test('seed data can be inserted twice without duplicating rows', async () => {
  await seed(testDatabaseUrl.toString())
  await seed(testDatabaseUrl.toString())

  const counts = await testPool.query<{
    roles: string
    admins: string
    packages: string
    schedules: string
    guides: string
    assignments: string
  }>(
    `SELECT
       (SELECT count(*) FROM roles)::text AS roles,
       (SELECT count(*) FROM users WHERE email = $1)::text AS admins,
       (SELECT count(*) FROM tour_packages)::text AS packages,
       (SELECT count(*) FROM tour_schedules)::text AS schedules,
       (SELECT count(*) FROM guides)::text AS guides,
       (SELECT count(*) FROM guide_assignments)::text AS assignments`,
    [env.seedAdminEmail],
  )
  assert.deepEqual(counts.rows[0], {
    roles: '4',
    admins: '1',
    packages: '3',
    schedules: '4',
    guides: '2',
    assignments: '2',
  })

  const password = await testPool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE email = $1',
    [env.seedAdminEmail],
  )
  assert.equal(await verifyPassword(env.seedAdminPassword, password.rows[0]?.password_hash ?? ''), true)
  assert.equal(await verifyPassword('wrong-password', password.rows[0]?.password_hash ?? ''), false)
  assert.equal((password.rows[0]?.password_hash ?? '').includes(env.seedAdminPassword), false)
})

let packageNumber = 0

async function insertSchedule(client: PoolClient, capacity: number): Promise<number> {
  packageNumber += 1
  const name = `Package ${packageNumber}`
  const tourPackage = await client.query<{ id: string }>(
    `INSERT INTO tour_packages (name, description, price_etb, duration_minutes)
     VALUES ($1, 'Test package', 100, 60)
     RETURNING id::text`,
    [name],
  )
  const startsAt = new Date(Date.UTC(2026, 10, packageNumber, 6, 0, 0))
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)
  const schedule = await client.query<{ id: string }>(
    `INSERT INTO tour_schedules (tour_package_id, starts_at, ends_at, max_capacity)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [Number(tourPackage.rows[0]?.id), startsAt.toISOString(), endsAt.toISOString(), capacity],
  )
  return Number(schedule.rows[0]?.id)
}

async function insertTourist(client: PoolClient, name: string, userId?: number): Promise<number> {
  const tourist = await client.query<{ id: string }>(
    `INSERT INTO tourists (full_name, user_id) VALUES ($1, $2) RETURNING id::text`,
    [name, userId ?? null],
  )
  return Number(tourist.rows[0]?.id)
}

async function insertScheduleCommitted(capacity: number): Promise<number> {
  const client = await testPool.connect()
  try {
    return await insertSchedule(client, capacity)
  } finally {
    client.release()
  }
}

async function insertTouristCommitted(name: string): Promise<number> {
  const client = await testPool.connect()
  try {
    return await insertTourist(client, name)
  } finally {
    client.release()
  }
}

async function clearSchedule(scheduleId: number, touristIds: number[]): Promise<void> {
  await testPool.query(
    'DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_schedule_id = $1)',
    [scheduleId],
  )
  await testPool.query('DELETE FROM bookings WHERE tour_schedule_id = $1', [scheduleId])
  const schedule = await testPool.query<{ tour_package_id: string }>(
    'DELETE FROM tour_schedules WHERE id = $1 RETURNING tour_package_id::text',
    [scheduleId],
  )
  const packageId = schedule.rows[0]?.tour_package_id
  if (packageId) {
    await testPool.query('DELETE FROM tour_packages WHERE id = $1', [Number(packageId)])
  }
  await testPool.query('DELETE FROM tourists WHERE id = ANY($1::bigint[])', [touristIds])
}
