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
const touristEmail = `phase8-tourist-${stamp}@abba-jifar.local`
const receptionEmail = `phase8-reception-${stamp}@abba-jifar.local`
const secondReceptionEmail = `phase8-reception-b-${stamp}@abba-jifar.local`
const guideEmail = `phase8-guide-${stamp}@abba-jifar.local`
const staffPassword = 'staff-pass-1'

let baseUrl = ''
let server: ReturnType<typeof createServer>
let adminCookie = ''
let touristCookie = ''
let receptionCookie = ''
let secondReceptionCookie = ''
let guideCookie = ''

describe('reception check-in', { concurrency: 1 }, () => {
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
    touristCookie = await register(touristEmail, 'Phase8 Visitor')
    await staff('Phase8 Reception', receptionEmail)
    await staff('Phase8 Reception Two', secondReceptionEmail)
    await staff('Phase8 Guide', guideEmail, 'tour_guide')
    receptionCookie = await login(receptionEmail)
    secondReceptionCookie = await login(secondReceptionEmail)
    guideCookie = await login(guideEmail)
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
            WHERE tour_packages.name LIKE 'Phase8 %'
          )`,
      [`phase8-%${stamp}%@abba-jifar.local`],
    )
    await pool.query(
      `DELETE FROM receptions
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase8 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tickets
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase8 %'
       )`,
    )
    await pool.query(
      `DELETE FROM payments
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase8 %'
       )`,
    )
    await pool.query(
      `DELETE FROM bookings
       WHERE tour_schedule_id IN (
         SELECT tour_schedules.id FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase8 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tour_schedules
       WHERE tour_package_id IN (SELECT id FROM tour_packages WHERE name LIKE 'Phase8 %')`,
    )
    await pool.query(`DELETE FROM tour_packages WHERE name LIKE 'Phase8 %'`)
    await pool.query(`DELETE FROM tourists WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [
      `phase8-%${stamp}%@abba-jifar.local`,
    ])
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`phase8-%${stamp}%@abba-jifar.local`])
  })

  test('a receptionist can preview and check in a paid ticket for today', async () => {
    const ready = await prepare(`Phase8 Today ${stamp}`, await palaceDate(0), 3, true)
    const preview = await request(`/api/reception/check-ins/preview?token=${ready.token}`, { cookie: receptionCookie })
    assert.equal(preview.status, 200)
    assert.equal(preview.json.preview?.eligible, true)
    assert.equal(preview.json.preview?.partySize, 3)
    assert.equal(preview.json.preview?.touristName, 'Phase8 Visitor')
    const before = await pool.query('SELECT id FROM receptions WHERE booking_id = $1', [ready.bookingId])
    assert.equal(before.rowCount, 0)

    const saved = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { token: ready.token, receivedBy: 1 },
    })
    assert.equal(saved.status, 201)
    assert.equal(saved.json.checkIn?.partySize, 3)
    assert.equal(saved.json.checkIn?.reference, ready.reference)
    const row = await pool.query<{ received_by: string; status: string; payment: string }>(
      `SELECT receptions.received_by::text, bookings.status, payments.status AS payment
       FROM receptions
       JOIN bookings ON bookings.id = receptions.booking_id
       JOIN payments ON payments.booking_id = bookings.id
       WHERE bookings.reference = $1`,
      [ready.reference],
    )
    assert.equal(row.rowCount, 1)
    const receptionist = await pool.query<{ id: string }>(`SELECT id::text FROM users WHERE email = $1`, [receptionEmail])
    assert.equal(row.rows[0]?.received_by, receptionist.rows[0]?.id)
    assert.equal(row.rows[0]?.status, 'pending')
    assert.equal(row.rows[0]?.payment, 'paid')
    const audit = await pool.query<{ details: { ticketId?: number; partySize?: number; token?: string } }>(
      `SELECT details FROM audit_logs WHERE action = 'visitor.checkin' AND entity_id = $1`,
      [ready.reference],
    )
    assert.equal(audit.rowCount, 1)
    assert.equal(audit.rows[0]?.details.partySize, 3)
    assert.equal(audit.rows[0]?.details.token, undefined)
    assert.equal(typeof audit.rows[0]?.details.ticketId, 'number')

    const again = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference: ready.reference },
    })
    assert.equal(again.status, 409)
    const still = await pool.query('SELECT id FROM receptions WHERE booking_id = $1', [ready.bookingId])
    assert.equal(still.rowCount, 1)
  })

  test('unpaid, cancelled, void, closed, unknown, and wrong-date tickets are rejected', async () => {
    const unpaid = await prepare(`Phase8 Unpaid ${stamp}`, await palaceDate(0), 1, false)
    const unpaidResult = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference: unpaid.reference },
    })
    assert.equal(unpaidResult.status, 400)
    assert.equal(await receptionCount(unpaid.bookingId), 0)

    const cancelled = await prepare(`Phase8 Cancel ${stamp}`, await palaceDate(0), 1, true)
    const cancel = await request(`/api/admin/bookings/${cancelled.reference}/cancel`, { method: 'POST', cookie: adminCookie })
    assert.equal(cancel.status, 200)
    const cancelledResult = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference: cancelled.reference },
    })
    assert.equal(cancelledResult.status, 400)
    assert.equal(await receptionCount(cancelled.bookingId), 0)

    const closed = await prepare(`Phase8 Schedule ${stamp}`, await palaceDate(0), 1, true)
    const schedule = await pool.query<{ id: string }>(
      `SELECT tour_schedule_id::text AS id FROM bookings WHERE id = $1`,
      [closed.bookingId],
    )
    const cancelSchedule = await request(`/api/admin/schedules/${schedule.rows[0]?.id}/cancel`, {
      method: 'POST',
      cookie: adminCookie,
    })
    assert.equal(cancelSchedule.status, 200)
    const closedResult = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { token: closed.token },
    })
    assert.equal(closedResult.status, 400)
    assert.equal(await receptionCount(closed.bookingId), 0)

    const otherDay = await prepare(`Phase8 Tomorrow ${stamp}`, await palaceDate(1), 2, true)
    const otherDayResult = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { token: otherDay.token },
    })
    assert.equal(otherDayResult.status, 400)
    assert.equal(otherDayResult.json.error, 'Check-in is only available on the scheduled visit date.')
    assert.equal(await receptionCount(otherDay.bookingId), 0)

    const missing = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { token: 'c'.repeat(43) },
    })
    assert.equal(missing.status, 404)
    const audits = await pool.query(`SELECT id FROM audit_logs WHERE action = 'visitor.checkin' AND entity_id = $1`, [
      unpaid.reference,
    ])
    assert.equal(audits.rowCount, 0)
  })

  test('tourists and guides cannot check in, and administrators can read history', async () => {
    const ready = await prepare(`Phase8 Roles ${stamp}`, await palaceDate(0), 2, true)
    const tourist = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: touristCookie,
      body: { token: ready.token },
    })
    assert.equal(tourist.status, 403)
    const guide = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: guideCookie,
      body: { reference: ready.reference },
    })
    assert.equal(guide.status, 403)
    const adminPost = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: adminCookie,
      body: { token: ready.token },
    })
    assert.equal(adminPost.status, 403)

    const saved = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference: ready.reference },
    })
    assert.equal(saved.status, 201)
    const history = await request(`/api/admin/check-ins?q=${ready.reference}`, { cookie: adminCookie })
    assert.equal(history.status, 200)
    assert.equal(history.json.history?.checkIns?.some((item) => item.reference === ready.reference), true)
    assert.equal(history.json.history?.checkIns?.[0]?.partySize, 2)
    assert.equal(history.json.history?.checkIns?.[0]?.receptionistName, 'Phase8 Reception')
    const summary = await request('/api/admin/check-ins/summary', { cookie: adminCookie })
    assert.equal(summary.status, 200)
    assert.ok((summary.json.summary?.totalCheckIns ?? 0) >= 1)
    assert.ok((summary.json.summary?.totalVisitors ?? 0) >= 2)
    const guideHistory = await request('/api/admin/check-ins', { cookie: guideCookie })
    assert.equal(guideHistory.status, 403)
  })

  test('two simultaneous check-ins create one arrival', async () => {
    const ready = await prepare(`Phase8 Race ${stamp}`, await palaceDate(0), 1, true)
    const [first, second] = await Promise.all([
      request('/api/reception/check-ins', { method: 'POST', cookie: receptionCookie, body: { token: ready.token } }),
      request('/api/reception/check-ins', { method: 'POST', cookie: secondReceptionCookie, body: { token: ready.token } }),
    ])
    const statuses = [first.status, second.status].sort()
    assert.deepEqual(statuses, [201, 409])
    assert.equal(await receptionCount(ready.bookingId), 1)
    const audits = await pool.query(`SELECT id FROM audit_logs WHERE action = 'visitor.checkin' AND entity_id = $1`, [
      ready.reference,
    ])
    assert.equal(audits.rowCount, 1)
  })
})

async function prepare(name: string, date: string, partySize: number, pay: boolean): Promise<{
  reference: string
  token: string
  bookingId: string
}> {
  const created = await request('/api/admin/tours', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name,
      description: 'A phase 8 package used only by the automated check-in tests.',
      priceEtb: 100,
      durationMinutes: 60,
      category: 'History',
      includedActivities: 'A guided walk',
      maxGroupSize: 10,
    },
  })
  assert.equal(created.status, 201)
  const packageId = created.json.package?.id
  assert.ok(packageId)
  const schedule = await pool.query<{ id: string }>(
    `INSERT INTO tour_schedules (tour_package_id, starts_at, ends_at, max_capacity)
     VALUES ($1, ($2 || 'T09:00:00+03:00')::timestamptz, ($2 || 'T10:00:00+03:00')::timestamptz, 8)
     RETURNING id::text`,
    [packageId, date],
  )
  const scheduleId = Number(schedule.rows[0]?.id)
  const tourist = await pool.query<{ id: string }>(
    `SELECT tourists.id::text FROM tourists JOIN users ON users.id = tourists.user_id WHERE users.email = $1`,
    [touristEmail],
  )
  const booked = await bookTour({
    touristId: Number(tourist.rows[0]?.id),
    tourScheduleId: scheduleId,
    partySize,
    amountEtb: 100 * partySize,
    createdBy: null,
  }, pool)
  const referenceRow = await pool.query<{ reference: string }>(`SELECT reference FROM bookings WHERE id = $1`, [
    booked.bookingId,
  ])
  const reference = referenceRow.rows[0]?.reference ?? ''
  assert.match(reference, /^AJ-/)
  if (pay) {
    const paid = await request('/api/reception/payments', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference, method: 'cash' },
    })
    assert.equal(paid.status, 201)
  }
  const tokenRow = await pool.query<{ token: string | null }>(
    `SELECT tickets.token FROM tickets WHERE booking_id = $1`,
    [booked.bookingId],
  )
  return {
    reference,
    token: tokenRow.rows[0]?.token ?? 'd'.repeat(43),
    bookingId: String(booked.bookingId),
  }
}

async function receptionCount(bookingId: string): Promise<number> {
  const result = await pool.query(`SELECT id FROM receptions WHERE booking_id = $1`, [bookingId])
  return result.rowCount ?? 0
}

async function palaceDate(daysAhead: number): Promise<string> {
  const result = await pool.query<{ day: string }>(
    `SELECT to_char(((now() AT TIME ZONE 'Africa/Addis_Ababa')::date + $1::int), 'YYYY-MM-DD') AS day`,
    [daysAhead],
  )
  return result.rows[0]?.day ?? ''
}

async function register(email: string, fullName: string): Promise<string> {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { fullName, email, password: 'visitor-pass-1', phone: '0911000000' },
  })
  assert.equal(registered.status, 201)
  return registered.cookie
}

async function staff(fullName: string, email: string, role = 'receptionist'): Promise<void> {
  const created = await request('/api/admin/users', {
    method: 'POST',
    cookie: adminCookie,
    body: { fullName, email, password: staffPassword, role },
  })
  assert.equal(created.status, 201)
}

async function login(email: string): Promise<string> {
  const signedIn = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: staffPassword },
  })
  assert.equal(signedIn.status, 200)
  return signedIn.cookie
}

interface ApiBody {
  error?: string
  package?: { id?: number }
  preview?: { eligible?: boolean; partySize?: number; touristName?: string }
  checkIn?: { partySize?: number; reference?: string }
  history?: { checkIns?: { reference?: string; partySize?: number; receptionistName?: string }[] }
  summary?: { totalCheckIns?: number; totalVisitors?: number }
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
