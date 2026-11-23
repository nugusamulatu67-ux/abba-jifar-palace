import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, test } from 'node:test'
import { env } from '../src/config/env.ts'
import { pool } from '../src/config/database.ts'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { createApp } from '../src/app.ts'
import { bookTour } from '../src/repositories/booking.repository.ts'

const stamp = Date.now()
const touristEmail = `phase5-tourist-${stamp}@abba-jifar.local`
const packageName = `Phase5 Palace Walk ${stamp}`

let baseUrl = ''
let server: ReturnType<typeof createServer>
let adminCookie = ''
let touristCookie = ''

describe('tour packages and schedules', { concurrency: 1 }, () => {
  test.before(async () => {
    await migrate(env.databaseUrl)
    await seed(env.databaseUrl)
    server = createServer(createApp())
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`

    const admin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: env.seedAdminEmail, password: env.seedAdminPassword },
    })
    assert.equal(admin.status, 200)
    adminCookie = admin.cookie

    const tourist = await request('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Phase5 Visitor',
        email: touristEmail,
        password: 'visitor-pass-1',
        phone: '0911555666',
      },
    })
    assert.equal(tourist.status, 201)
    touristCookie = tourist.cookie
  })

  test.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await pool.query(
      `DELETE FROM payments
       WHERE booking_id IN (
         SELECT bookings.id
         FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase5 %'
       )`,
    )
    await pool.query(
      `DELETE FROM bookings
       WHERE tour_schedule_id IN (
         SELECT tour_schedules.id
         FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase5 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tour_schedules
       WHERE tour_package_id IN (SELECT id FROM tour_packages WHERE name LIKE 'Phase5 %')`,
    )
    await pool.query(`DELETE FROM tour_packages WHERE name LIKE 'Phase5 %'`)
    await pool.query(
      `DELETE FROM tourists
       WHERE email = $1
          OR user_id IN (SELECT id FROM users WHERE email = $1)`,
      [touristEmail],
    )
    await pool.query(`DELETE FROM users WHERE email = $1`, [touristEmail])
  })

  test('an administrator can create, edit, and deactivate a package', async () => {
    const created = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody(),
    })
    assert.equal(created.status, 201)
    const tourPackage = created.json.package
    assert.ok(tourPackage)
    assert.equal(tourPackage.name, packageName)
    assert.equal(tourPackage.priceEtb, 250)
    assert.equal(tourPackage.status, 'active')
    assert.equal(typeof tourPackage.createdAt, 'string')

    const edited = await request(`/api/admin/tours/${tourPackage.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: packageBody({ name: `${packageName} revised`, priceEtb: 275, durationMinutes: 75 }),
    })
    assert.equal(edited.status, 200)
    assert.equal(edited.json.package?.name, `${packageName} revised`)
    assert.equal(edited.json.package?.priceEtb, 275)

    const inactive = await request(`/api/admin/tours/${tourPackage.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { status: 'inactive' },
    })
    assert.equal(inactive.status, 200)
    assert.equal(inactive.json.package?.status, 'inactive')

    const hidden = await request(`/api/tours/${tourPackage.id}`)
    assert.equal(hidden.status, 404)
    const listed = await request('/api/tours')
    assert.equal(listed.status, 200)
    assert.equal(
      listed.json.packages?.some((item) => item.id === tourPackage.id),
      false,
    )

    const restored = await request(`/api/admin/tours/${tourPackage.id}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { status: 'active' },
    })
    assert.equal(restored.status, 200)
  })

  test('invalid package data is rejected', async () => {
    const negative = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody({ name: `Phase5 Invalid ${stamp}`, priceEtb: -1 }),
    })
    assert.equal(negative.status, 400)

    const fractional = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody({ name: `Phase5 Fraction ${stamp}`, priceEtb: 10.5 }),
    })
    assert.equal(fractional.status, 400)

    const short = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody({ name: `Phase5 Short ${stamp}`, description: 'Too short' }),
    })
    assert.equal(short.status, 400)
  })

  test('an administrator can create a schedule and invalid times or capacity are rejected', async () => {
    const created = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody({ name: `Phase5 Schedule ${stamp}`, maxGroupSize: 8 }),
    })
    assert.equal(created.status, 201)
    const packageId = created.json.package?.id
    assert.ok(packageId)

    const earlyEnd = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-03-12', startTime: '10:00', endTime: '09:00', maxCapacity: 8 },
    })
    assert.equal(earlyEnd.status, 400)

    const impossibleDay = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-02-31', startTime: '09:00', endTime: '10:00', maxCapacity: 8 },
    })
    assert.equal(impossibleDay.status, 400)

    const zeroCapacity = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-03-12', startTime: '09:00', endTime: '10:30', maxCapacity: 0 },
    })
    assert.equal(zeroCapacity.status, 400)

    const tooLarge = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-03-12', startTime: '09:00', endTime: '10:30', maxCapacity: 9 },
    })
    assert.equal(tooLarge.status, 400)

    const scheduled = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-03-12', startTime: '09:00', endTime: '10:30', maxCapacity: 8 },
    })
    assert.equal(scheduled.status, 201)
    const schedule = scheduled.json.schedule
    assert.ok(schedule)
    assert.equal(schedule.maxCapacity, 8)
    assert.equal(schedule.remainingCapacity, 8)
    assert.equal(schedule.bookable, true)
    assert.ok(schedule.startsAt)
    assert.equal(schedule.startsAt.includes('2027-03-12T06:00:00'), true)

    const duplicate = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-03-12', startTime: '09:00', endTime: '11:00', maxCapacity: 6 },
    })
    assert.equal(duplicate.status, 409)

    const upcoming = await request(`/api/schedules?packageId=${packageId}`)
    assert.equal(upcoming.status, 200)
    assert.equal(upcoming.json.schedules?.some((item) => item.id === schedule.id && item.bookable), true)

    const availability = await request(`/api/schedules/${schedule.id}`)
    assert.equal(availability.status, 200)
    assert.equal(availability.json.schedule?.remainingCapacity, 8)
  })

  test('a cancelled schedule is not bookable and an existing booking remains', async () => {
    const created = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody({ name: `Phase5 Cancel ${stamp}`, maxGroupSize: 6 }),
    })
    const packageId = created.json.package?.id
    assert.ok(packageId)
    const scheduled = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId, date: '2027-04-02', startTime: '14:00', endTime: '15:00', maxCapacity: 4 },
    })
    const scheduleId = scheduled.json.schedule?.id
    assert.ok(scheduleId)

    const tourist = await pool.query<{ id: string }>(
      `SELECT tourists.id::text
       FROM tourists
       JOIN users ON users.id = tourists.user_id
       WHERE users.email = $1`,
      [touristEmail],
    )
    const touristId = Number(tourist.rows[0]?.id)
    const booking = await bookTour(
      { touristId, tourScheduleId: scheduleId, partySize: 2, amountEtb: 250, status: 'confirmed' },
      pool,
    )

    const tooSmall = await request(`/api/admin/schedules/${scheduleId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { packageId, date: '2027-04-02', startTime: '14:00', endTime: '15:00', maxCapacity: 1 },
    })
    assert.equal(tooSmall.status, 400)

    const cancelled = await request(`/api/admin/schedules/${scheduleId}/cancel`, {
      method: 'POST',
      cookie: adminCookie,
    })
    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.json.schedule?.status, 'cancelled')
    assert.equal(cancelled.json.schedule?.bookable, false)

    const hidden = await request(`/api/schedules/${scheduleId}`)
    assert.equal(hidden.status, 404)
    const kept = await pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [booking.bookingId])
    assert.equal(kept.rows[0]?.status, 'confirmed')
  })

  test('visitors can browse active packages and upcoming schedules', async () => {
    const tours = await request('/api/tours')
    assert.equal(tours.status, 200)
    const history = tours.json.packages?.find((item) => item.name === 'Palace History Tour')
    assert.ok(history)
    assert.equal(history.priceEtb, 300)
    assert.equal(history.durationMinutes, 90)
    assert.ok((history.upcomingCount ?? 0) > 0)

    const detail = await request(`/api/tours/${history.id}`)
    assert.equal(detail.status, 200)
    assert.ok((detail.json.package?.schedules.length ?? 0) > 0)
    assert.equal(
      detail.json.package?.schedules.every((item) => item.bookable || item.remainingCapacity === 0),
      true,
    )
  })

  test('tourists and anonymous visitors cannot change packages or schedules', async () => {
    const anonymous = await request('/api/admin/tours', { method: 'POST', body: packageBody() })
    assert.equal(anonymous.status, 401)

    const tourist = await request('/api/admin/tours', {
      method: 'POST',
      cookie: touristCookie,
      body: packageBody({ name: `Phase5 Denied ${stamp}` }),
    })
    assert.equal(tourist.status, 403)

    const schedule = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: touristCookie,
      body: { packageId: 1, date: '2027-05-01', startTime: '09:00', endTime: '10:00', maxCapacity: 4 },
    })
    assert.equal(schedule.status, 403)
  })

  test('the PostgreSQL health check still succeeds', async () => {
    const health = await request('/api/health')
    assert.equal(health.status, 200)
    assert.equal(health.json.status, 'ok')
    assert.equal(health.json.database?.status, 'connected')
  })
})

function packageBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: packageName,
    description: 'A phase 5 package used only by the automated tour tests.',
    priceEtb: 250,
    durationMinutes: 60,
    category: 'History',
    includedActivities: 'A guided walk',
    maxGroupSize: 10,
    ...overrides,
  }
}

interface PackageBody {
  id?: number
  name?: string
  priceEtb?: number
  durationMinutes?: number
  status?: string
  createdAt?: string
  upcomingCount?: number
  schedules: ScheduleBody[]
}

interface ScheduleBody {
  id?: number
  bookable?: boolean
  remainingCapacity?: number
  maxCapacity?: number
  status?: string
  startsAt?: string
}

interface ApiBody {
  error?: string
  status?: string
  package?: PackageBody
  packages?: PackageBody[]
  schedule?: ScheduleBody
  schedules?: ScheduleBody[]
  database?: { status?: string }
}

async function request(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<{ status: number; json: ApiBody; cookie: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const json = (await response.json()) as ApiBody
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0] ?? '')
    .filter((value) => value.length > 0)
    .join('; ')
  return { status: response.status, json, cookie }
}
