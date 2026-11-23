import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, test } from 'node:test'
import { env } from '../src/config/env.ts'
import { pool } from '../src/config/database.ts'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { createApp } from '../src/app.ts'

const stamp = Date.now()
const touristEmail = `phase6-tourist-${stamp}@abba-jifar.local`
const otherEmail = `phase6-other-${stamp}@abba-jifar.local`

let baseUrl = ''
let server: ReturnType<typeof createServer>
let adminCookie = ''
let touristCookie = ''
let otherCookie = ''

describe('tourist bookings', { concurrency: 1 }, () => {
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
    touristCookie = await register(touristEmail, 'Phase6 Visitor')
    otherCookie = await register(otherEmail, 'Phase6 Other')
  })

  test.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await pool.query(
      `DELETE FROM audit_logs
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
          OR entity_id IN (
            SELECT reference FROM bookings
            JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
            JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
            WHERE tour_packages.name LIKE 'Phase6 %'
          )`,
      [`phase6-%${stamp}%@abba-jifar.local`],
    )
    await pool.query(
      `DELETE FROM payments
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase6 %'
       )`,
    )
    await pool.query(
      `DELETE FROM bookings
       WHERE tour_schedule_id IN (
         SELECT tour_schedules.id FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase6 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tour_schedules
       WHERE tour_package_id IN (SELECT id FROM tour_packages WHERE name LIKE 'Phase6 %')`,
    )
    await pool.query(`DELETE FROM tour_packages WHERE name LIKE 'Phase6 %'`)
    await pool.query(
      `DELETE FROM tourists WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [`phase6-%${stamp}%@abba-jifar.local`],
    )
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`phase6-%${stamp}%@abba-jifar.local`])
  })

  test('a tourist can book, see only their booking, and the server calculates the amount', async () => {
    const scheduleId = await openSchedule(`Phase6 Main ${stamp}`, '2027-06-01', 6, 300)
    const created = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId, partySize: 2, amountEtb: 1, touristId: 999999 },
    })
    assert.equal(created.status, 201)
    const booking = created.json.booking
    assert.ok(booking)
    assert.match(booking.reference ?? '', /^AJ-[A-Z0-9]{6,12}$/)
    assert.equal(booking.partySize, 2)
    assert.equal(booking.totalEtb, 600)
    assert.equal(booking.status, 'pending')
    assert.equal(booking.canConfirm, false)

    const mine = await request('/api/bookings', { cookie: touristCookie })
    assert.equal(mine.status, 200)
    assert.equal(mine.json.bookings?.some((item) => item.reference === booking.reference), true)

    const hidden = await request(`/api/bookings/${booking.reference}`, { cookie: otherCookie })
    assert.equal(hidden.status, 404)
    const denied = await request(`/api/bookings/${booking.reference}/cancel`, { method: 'POST', cookie: otherCookie })
    assert.equal(denied.status, 404)

    const detail = await request(`/api/bookings/${booking.reference}`, { cookie: touristCookie })
    assert.equal(detail.status, 200)
    assert.equal(detail.json.booking?.totalEtb, 600)

    const listed = await request('/api/admin/bookings?status=pending', { cookie: adminCookie })
    assert.equal(listed.status, 200)
    assert.equal(listed.json.bookings?.some((item) => item.reference === booking.reference), true)

    const confirmed = await request(`/api/admin/bookings/${booking.reference}/confirm`, {
      method: 'POST',
      cookie: adminCookie,
    })
    assert.equal(confirmed.status, 200)
    assert.equal(confirmed.json.booking?.status, 'confirmed')
    const payment = await pool.query<{ status: string }>(
      `SELECT payments.status FROM payments
       JOIN bookings ON bookings.id = payments.booking_id
       WHERE bookings.reference = $1`,
      [booking.reference],
    )
    assert.equal(payment.rows[0]?.status, 'unpaid')
  })

  test('invalid parties, closed tours, and full departures are rejected', async () => {
    const scheduleId = await openSchedule(`Phase6 Closed ${stamp}`, '2027-06-02', 2, 250)
    const inactivePackage = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody(`Phase6 Inactive ${stamp}`),
    })
    const inactiveId = inactivePackage.json.package?.id
    assert.ok(inactiveId)
    const inactiveSchedule = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId: inactiveId, date: '2027-06-03', startTime: '09:00', endTime: '10:00', maxCapacity: 4 },
    })
    const inactiveScheduleId = inactiveSchedule.json.schedule?.id
    assert.ok(inactiveScheduleId)
    await request(`/api/admin/tours/${inactiveId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { status: 'inactive' },
    })
    const inactiveBooking = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId: inactiveScheduleId, partySize: 1 },
    })
    assert.equal(inactiveBooking.status, 400)

    const cancelledSchedule = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId: (await packageId(`Phase6 Closed ${stamp}`)), date: '2027-06-04', startTime: '09:00', endTime: '10:00', maxCapacity: 4 },
    })
    const cancelledId = cancelledSchedule.json.schedule?.id
    assert.ok(cancelledId)
    await request(`/api/admin/schedules/${cancelledId}/cancel`, { method: 'POST', cookie: adminCookie })
    const cancelledBooking = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId: cancelledId, partySize: 1 },
    })
    assert.equal(cancelledBooking.status, 400)

    const pastPackage = await request('/api/admin/tours', {
      method: 'POST',
      cookie: adminCookie,
      body: packageBody(`Phase6 Past ${stamp}`),
    })
    const pastSchedule = await request('/api/admin/schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: { packageId: pastPackage.json.package?.id, date: '2020-01-02', startTime: '09:00', endTime: '10:00', maxCapacity: 4 },
    })
    const pastBooking = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId: pastSchedule.json.schedule?.id, partySize: 1 },
    })
    assert.equal(pastBooking.status, 400)

    const zero = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId, partySize: 0 },
    })
    assert.equal(zero.status, 400)
    const fraction = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId, partySize: 1.5 },
    })
    assert.equal(fraction.status, 400)

    const first = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId, partySize: 2 },
    })
    assert.equal(first.status, 201)
    const overflow = await request('/api/bookings', {
      method: 'POST',
      cookie: otherCookie,
      body: { scheduleId, partySize: 1 },
    })
    assert.equal(overflow.status, 409)
  })

  test('cancellation releases seats once', async () => {
    const scheduleId = await openSchedule(`Phase6 Cancel ${stamp}`, '2027-07-01', 4, 200)
    const before = await request(`/api/schedules/${scheduleId}`)
    assert.equal(before.json.schedule?.remainingCapacity, 4)
    const created = await request('/api/bookings', {
      method: 'POST',
      cookie: touristCookie,
      body: { scheduleId, partySize: 3 },
    })
    assert.equal(created.status, 201)
    const reference = created.json.booking?.reference
    assert.ok(reference)
    const held = await request(`/api/schedules/${scheduleId}`)
    assert.equal(held.json.schedule?.remainingCapacity, 1)

    const cancelled = await request(`/api/bookings/${reference}/cancel`, { method: 'POST', cookie: touristCookie })
    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.json.booking?.status, 'cancelled')
    const restored = await request(`/api/schedules/${scheduleId}`)
    assert.equal(restored.json.schedule?.remainingCapacity, 4)

    const again = await request(`/api/bookings/${reference}/cancel`, { method: 'POST', cookie: touristCookie })
    assert.equal(again.status, 200)
    assert.equal(again.json.booking?.status, 'cancelled')
    const still = await request(`/api/schedules/${scheduleId}`)
    assert.equal(still.json.schedule?.remainingCapacity, 4)
    const rows = await pool.query<{ status: string }>(
      `SELECT status FROM bookings WHERE reference = $1`,
      [reference],
    )
    assert.equal(rows.rowCount, 1)
    assert.equal(rows.rows[0]?.status, 'cancelled')
  })

  test('tourists cannot use administrator booking routes', async () => {
    const anonymous = await request('/api/bookings', { method: 'POST', body: { scheduleId: 1, partySize: 1 } })
    assert.equal(anonymous.status, 401)
    const forbidden = await request('/api/admin/bookings', { cookie: touristCookie })
    assert.equal(forbidden.status, 403)
    const confirm = await request('/api/admin/bookings/AJ-000001/confirm', { method: 'POST', cookie: touristCookie })
    assert.equal(confirm.status, 403)
  })

  test('simultaneous bookings cannot exceed the last seats', async () => {
    const scheduleId = await openSchedule(`Phase6 Race ${stamp}`, '2027-08-01', 2, 100)
    const cookies: string[] = []
    for (let index = 0; index < 6; index += 1) {
      cookies.push(await register(`phase6-race-${stamp}-${index}@abba-jifar.local`, `Phase6 Race ${index}`))
    }
    const results = await Promise.all(
      cookies.map((cookie) =>
        request('/api/bookings', {
          method: 'POST',
          cookie,
          body: { scheduleId, partySize: 1 },
        }),
      ),
    )
    const saved = results.filter((result) => result.status === 201)
    const rejected = results.filter((result) => result.status === 409)
    assert.equal(saved.length, 2)
    assert.equal(rejected.length, 4)
    assert.equal(rejected.every((result) => result.json.error === 'Not enough seats remain for that party.'), true)
    const seats = await pool.query<{ seats: string; rows: string }>(
      `SELECT
         COALESCE(SUM(party_size) FILTER (WHERE status IN ('pending', 'confirmed')), 0)::text AS seats,
         count(*)::text AS rows
       FROM bookings
       WHERE tour_schedule_id = $1`,
      [scheduleId],
    )
    assert.equal(seats.rows[0]?.seats, '2')
    assert.equal(seats.rows[0]?.rows, '2')
  })
})

async function register(email: string, fullName: string): Promise<string> {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { fullName, email, password: 'visitor-pass-1', phone: '0911000000' },
  })
  assert.equal(registered.status, 201)
  return registered.cookie
}

async function openSchedule(name: string, date: string, capacity: number, priceEtb: number): Promise<number> {
  const created = await request('/api/admin/tours', {
    method: 'POST',
    cookie: adminCookie,
    body: packageBody(name, priceEtb),
  })
  assert.equal(created.status, 201)
  const packageId = created.json.package?.id
  assert.ok(packageId)
  const schedule = await request('/api/admin/schedules', {
    method: 'POST',
    cookie: adminCookie,
    body: { packageId, date, startTime: '09:00', endTime: '10:00', maxCapacity: capacity },
  })
  assert.equal(schedule.status, 201)
  const scheduleId = schedule.json.schedule?.id
  assert.ok(scheduleId)
  return scheduleId
}

async function packageId(name: string): Promise<number> {
  const listed = await request(`/api/admin/tours?q=${encodeURIComponent(name)}`, { cookie: adminCookie })
  const id = listed.json.packages?.find((item) => item.name === name)?.id
  assert.ok(id)
  return id
}

function packageBody(name: string, priceEtb = 250): Record<string, unknown> {
  return {
    name,
    description: 'A phase 6 package used only by the automated booking tests.',
    priceEtb,
    durationMinutes: 60,
    category: 'History',
    includedActivities: 'A guided walk',
    maxGroupSize: 10,
  }
}

interface BookingBody {
  reference?: string
  partySize?: number
  totalEtb?: number
  status?: string
  canConfirm?: boolean
}

interface ApiBody {
  error?: string
  booking?: BookingBody
  bookings?: BookingBody[]
  package?: { id?: number; name?: string }
  packages?: { id?: number; name?: string }[]
  schedule?: { id?: number; remainingCapacity?: number }
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
