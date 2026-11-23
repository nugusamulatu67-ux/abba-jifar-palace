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
const guideEmail = `phase9-guide-${stamp}@abba-jifar.local`
const otherGuideEmail = `phase9-guide-b-${stamp}@abba-jifar.local`
const inactiveEmail = `phase9-inactive-${stamp}@abba-jifar.local`
const touristEmail = `phase9-tourist-${stamp}@abba-jifar.local`
const receptionEmail = `phase9-reception-${stamp}@abba-jifar.local`
const staffPassword = 'staff-pass-1'

let baseUrl = ''
let server: ReturnType<typeof createServer>
let adminCookie = ''
let guideCookie = ''
let otherGuideCookie = ''
let receptionCookie = ''
let guideUserId = 0
let otherGuideUserId = 0
let inactiveUserId = 0
let touristUserId = 0

describe('guide assignment', { concurrency: 1 }, () => {
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
    guideUserId = await staff('Phase9 Guide', guideEmail, 'tour_guide')
    otherGuideUserId = await staff('Phase9 Other Guide', otherGuideEmail, 'tour_guide')
    inactiveUserId = await staff('Phase9 Inactive Guide', inactiveEmail, 'tour_guide')
    await pool.query(`UPDATE users SET status = 'inactive' WHERE id = $1`, [inactiveUserId])
    await register(touristEmail, 'Phase9 Visitor')
    const tourist = await pool.query<{ id: string }>(`SELECT id::text FROM users WHERE email = $1`, [touristEmail])
    touristUserId = Number(tourist.rows[0]?.id)
    await staff('Phase9 Reception', receptionEmail, 'receptionist')
    guideCookie = await login(guideEmail)
    otherGuideCookie = await login(otherGuideEmail)
    receptionCookie = await login(receptionEmail)
  })

  test.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await pool.query(
      `DELETE FROM audit_logs
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
          OR entity_id IN (
            SELECT tour_schedules.id::text FROM tour_schedules
            JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
            WHERE tour_packages.name LIKE 'Phase9 %'
          )`,
      [`phase9-%${stamp}%@abba-jifar.local`],
    )
    await pool.query(
      `DELETE FROM guide_assignments
       WHERE tour_schedule_id IN (
         SELECT tour_schedules.id FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase9 %'
       )
       OR guide_id IN (
         SELECT guides.id FROM guides
         JOIN users ON users.id = guides.user_id
         WHERE users.email LIKE $1
       )`,
      [`phase9-%${stamp}%@abba-jifar.local`],
    )
    await pool.query(
      `DELETE FROM receptions
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase9 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tickets WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase9 %'
       )`,
    )
    await pool.query(
      `DELETE FROM payments WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase9 %'
       )`,
    )
    await pool.query(
      `DELETE FROM bookings WHERE tour_schedule_id IN (
         SELECT tour_schedules.id FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase9 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tour_schedules WHERE tour_package_id IN (SELECT id FROM tour_packages WHERE name LIKE 'Phase9 %')`,
    )
    await pool.query(`DELETE FROM tour_packages WHERE name LIKE 'Phase9 %'`)
    await pool.query(`DELETE FROM tourists WHERE full_name LIKE $1 OR user_id IN (SELECT id FROM users WHERE email LIKE $2)`, [
      `Phase9 party ${stamp}%`,
      `phase9-%${stamp}%@abba-jifar.local`,
    ])
    await pool.query(`DELETE FROM guides WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [
      `phase9-%${stamp}%@abba-jifar.local`,
    ])
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`phase9-%${stamp}%@abba-jifar.local`])
  })

  test('an administrator can list guides and assign one to an upcoming departure', async () => {
    const listed = await request('/api/admin/guides?q=Phase9', { cookie: adminCookie })
    assert.equal(listed.status, 200)
    assert.equal(listed.json.guides?.some((guide) => guide.email === guideEmail && guide.password_hash === undefined), true)
    const scheduleId = await futureSchedule(`Phase9 Assign ${stamp}`, '2027-06-02', '09:00', '10:00')
    const saved = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId, guideUserId, assignedBy: touristUserId },
    })
    assert.equal(saved.status, 201)
    assert.equal(saved.json.departure?.guideUserId, guideUserId)
    const audit = await pool.query<{ user_id: string; details: { guideUserId?: number; scheduleId?: number } }>(
      `SELECT user_id::text, details FROM audit_logs WHERE action = 'guide.assign' AND entity_id = $1`,
      [String(scheduleId)],
    )
    assert.equal(audit.rowCount, 1)
    assert.equal(Number(audit.rows[0]?.user_id), await adminId())
    assert.equal(audit.rows[0]?.details.guideUserId, guideUserId)
    const history = await request(`/api/admin/guides/${guideUserId}/assignments`, { cookie: adminCookie })
    assert.equal(history.status, 200)
    assert.equal(history.json.assignments?.some((item) => item.scheduleId === scheduleId && item.status === 'active'), true)
  })

  test('tourists, inactive guides, cancelled departures, and past departures are rejected', async () => {
    const scheduleId = await futureSchedule(`Phase9 Reject ${stamp}`, '2027-06-03', '09:00', '10:00')
    const tourist = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId, guideUserId: touristUserId },
    })
    assert.equal(tourist.status, 400)
    const inactive = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId, guideUserId: inactiveUserId },
    })
    assert.equal(inactive.status, 400)
    const cancelledId = await futureSchedule(`Phase9 Cancelled ${stamp}`, '2027-06-04', '09:00', '10:00')
    const cancel = await request(`/api/admin/schedules/${cancelledId}/cancel`, { method: 'POST', cookie: adminCookie })
    assert.equal(cancel.status, 200)
    const cancelled = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: cancelledId, guideUserId },
    })
    assert.equal(cancelled.status, 400)
    const pastId = await sqlSchedule(`Phase9 Past ${stamp}`, -1)
    const past = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: pastId, guideUserId },
    })
    assert.equal(past.status, 400)
    const count = await pool.query(`SELECT id FROM guide_assignments WHERE tour_schedule_id = ANY($1::bigint[])`, [
      [scheduleId, cancelledId, pastId],
    ])
    assert.equal(count.rowCount, 0)
  })

  test('one active guide is kept, overlaps are rejected, and a failed change preserves the assignment', async () => {
    const first = await futureSchedule(`Phase9 Race ${stamp}`, '2027-07-01', '09:00', '11:00')
    const overlap = await futureSchedule(`Phase9 Overlap ${stamp}`, '2027-07-01', '10:00', '12:00')
    const later = await futureSchedule(`Phase9 Later ${stamp}`, '2027-07-01', '13:00', '14:00')
    const assigned = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: first, guideUserId },
    })
    assert.equal(assigned.status, 201)
    const duplicate = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: first, guideUserId: otherGuideUserId },
    })
    assert.equal(duplicate.status, 409)
    const active = await pool.query(`SELECT id FROM guide_assignments WHERE tour_schedule_id = $1 AND status = 'active'`, [
      first,
    ])
    assert.equal(active.rowCount, 1)
    const blocked = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: overlap, guideUserId },
    })
    assert.equal(blocked.status, 409)
    const second = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: later, guideUserId: otherGuideUserId },
    })
    assert.equal(second.status, 201)
    const separate = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId: overlap, guideUserId: otherGuideUserId },
    })
    assert.equal(separate.status, 201)
    const assignmentId = assigned.json.departure?.assignmentId
    assert.ok(assignmentId)
    const failed = await request(`/api/admin/assignments/${assignmentId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { guideUserId: otherGuideUserId },
    })
    assert.equal(failed.status, 409)
    const still = await pool.query<{ user_id: string }>(
      `SELECT guides.user_id::text
       FROM guide_assignments
       JOIN guides ON guides.id = guide_assignments.guide_id
       WHERE guide_assignments.id = $1 AND guide_assignments.status = 'active'`,
      [assignmentId],
    )
    assert.equal(Number(still.rows[0]?.user_id), guideUserId)
    const changed = await request(`/api/admin/assignments/${assignmentId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { guideUserId: inactiveUserId },
    })
    assert.equal(changed.status, 400)
    const removed = await request(`/api/admin/assignments/${separate.json.departure?.assignmentId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { guideUserId: null },
    })
    assert.equal(removed.status, 200)
    assert.equal(removed.json.departure?.guideUserId, null)
    const audits = await pool.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE entity_type = 'assignment' AND entity_id = $1 ORDER BY id`,
      [String(first)],
    )
    assert.equal(audits.rows.some((row) => row.action === 'guide.assign'), true)
    const removal = await pool.query(
      `SELECT id FROM audit_logs WHERE action = 'guide.unassign' AND entity_id = $1`,
      [String(overlap)],
    )
    assert.equal(removal.rowCount, 1)
  })

  test('a guide sees only their assignments and attendance, without payments or edits', async () => {
    const slot = await todaySlot()
    const scheduleId = await futureSchedule(`Phase9 Attendance ${stamp}`, slot.day, slot.start, slot.end)
    const assigned = await request('/api/admin/assignments', {
      method: 'POST',
      cookie: adminCookie,
      body: { scheduleId, guideUserId },
    })
    assert.equal(assigned.status, 201)
    const assignmentId = assigned.json.departure?.assignmentId
    assert.ok(assignmentId)
    await party(scheduleId, 5, 'cancelled')
    await party(scheduleId, 4, 'confirmed')
    const arrived = await party(scheduleId, 2, 'confirmed')
    await party(scheduleId, 1, 'pending')
    if (arrived) {
      const paid = await request('/api/reception/payments', {
        method: 'POST',
        cookie: receptionCookie,
        body: { reference: arrived, method: 'cash' },
      })
      assert.equal(paid.status, 201)
      const checked = await request('/api/reception/check-ins', {
        method: 'POST',
        cookie: receptionCookie,
        body: { reference: arrived },
      })
      assert.equal(checked.status, 201)
    }

    const own = await request('/api/guide/dashboard', { cookie: guideCookie })
    assert.equal(own.status, 200)
    assert.ok((own.json.dashboard?.upcomingCount ?? 0) >= 1)
    const detail = await request(`/api/guide/assignments/${assignmentId}`, { cookie: guideCookie })
    assert.equal(detail.status, 200)
    assert.equal(detail.json.assignment?.confirmedVisitors, 6)
    assert.equal(detail.json.assignment?.checkedInVisitors, 2)
    assert.equal(detail.json.assignment?.expectedVisitors, 4)
    const payload = JSON.stringify(detail.json)
    assert.equal(payload.includes(touristEmail), false)
    assert.equal(payload.includes('amountEtb'), false)
    assert.equal(payload.includes('"method"'), false)
    const hidden = await request(`/api/guide/assignments/${assignmentId}`, { cookie: otherGuideCookie })
    assert.equal(hidden.status, 404)
    const payments = await request('/api/admin/payments', { cookie: guideCookie })
    assert.equal(payments.status, 403)
    const checkIn = await request('/api/reception/check-ins', {
      method: 'POST',
      cookie: guideCookie,
      body: { reference: arrived },
    })
    assert.equal(checkIn.status, 403)
    const cancel = await request(`/api/admin/bookings/${arrived}/cancel`, { method: 'POST', cookie: guideCookie })
    assert.equal(cancel.status, 403)
  })
})

async function futureSchedule(name: string, date: string, start: string, end: string): Promise<number> {
  const created = await request('/api/admin/tours', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name,
      description: 'A phase 9 package used only by the automated guide tests.',
      priceEtb: 100,
      durationMinutes: 60,
      category: 'History',
      includedActivities: 'A guided walk',
      maxGroupSize: 30,
    },
  })
  assert.equal(created.status, 201)
  const packageId = created.json.package?.id
  assert.ok(packageId)
  const scheduled = await request('/api/admin/schedules', {
    method: 'POST',
    cookie: adminCookie,
    body: { packageId, date, startTime: start, endTime: end, maxCapacity: 20 },
  })
  assert.equal(scheduled.status, 201)
  const scheduleId = scheduled.json.schedule?.id
  assert.ok(scheduleId)
  return scheduleId
}

async function sqlSchedule(name: string, dayOffset: number): Promise<number> {
  const created = await request('/api/admin/tours', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name,
      description: 'A phase 9 package used only by the automated guide tests.',
      priceEtb: 100,
      durationMinutes: 60,
      category: 'History',
      includedActivities: 'A guided walk',
      maxGroupSize: 12,
    },
  })
  assert.equal(created.status, 201)
  const packageId = created.json.package?.id
  const row = await pool.query<{ id: string }>(
    `INSERT INTO tour_schedules (tour_package_id, starts_at, ends_at, max_capacity)
     SELECT $1,
            ((to_char(((now() AT TIME ZONE 'Africa/Addis_Ababa')::date + $2::int), 'YYYY-MM-DD') || ' 09:00:00+03')::timestamptz),
            ((to_char(((now() AT TIME ZONE 'Africa/Addis_Ababa')::date + $2::int), 'YYYY-MM-DD') || ' 10:00:00+03')::timestamptz),
            8
     RETURNING id::text`,
    [packageId, dayOffset],
  )
  return Number(row.rows[0]?.id)
}

async function party(scheduleId: number, partySize: number, status: 'confirmed' | 'cancelled' | 'pending'): Promise<string> {
  const tourist = await pool.query<{ id: string }>(
    `INSERT INTO tourists (full_name) VALUES ($1) RETURNING id::text`,
    [`Phase9 party ${stamp} ${scheduleId} ${partySize} ${status}`],
  )
  const booked = await bookTour(
    {
      touristId: Number(tourist.rows[0]?.id),
      tourScheduleId: scheduleId,
      partySize,
      amountEtb: 100 * partySize,
      status: status === 'cancelled' ? 'pending' : status,
      createdBy: null,
    },
    pool,
  )
  const reference = await pool.query<{ reference: string }>(`SELECT reference FROM bookings WHERE id = $1`, [booked.bookingId])
  const value = reference.rows[0]?.reference ?? ''
  if (status === 'cancelled') {
    await pool.query(`UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [booked.bookingId])
  }
  return value
}

async function todaySlot(): Promise<{ day: string; start: string; end: string }> {
  const result = await pool.query<{ day: string; start: string; end: string; future: boolean }>(
    `WITH bounds AS (
       SELECT (now() AT TIME ZONE 'Africa/Addis_Ababa') AS local_now
     )
     SELECT to_char(local_now::date, 'YYYY-MM-DD') AS day,
            to_char(local_now + interval '15 minutes', 'HH24:MI') AS start,
            to_char(local_now + interval '35 minutes', 'HH24:MI') AS end,
            (local_now + interval '35 minutes')::date = local_now::date AS future
     FROM bounds`,
  )
  const row = result.rows[0]
  assert.equal(row?.future, true)
  return { day: row?.day ?? '', start: row?.start ?? '', end: row?.end ?? '' }
}

async function adminId(): Promise<number> {
  const result = await pool.query<{ id: string }>(`SELECT id::text FROM users WHERE email = $1`, [env.seedAdminEmail])
  return Number(result.rows[0]?.id)
}

async function register(email: string, fullName: string): Promise<string> {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { fullName, email, password: 'visitor-pass-1', phone: '0911000099' },
  })
  assert.equal(registered.status, 201)
  return registered.cookie
}

async function staff(fullName: string, email: string, role: string): Promise<number> {
  const created = await request('/api/admin/users', {
    method: 'POST',
    cookie: adminCookie,
    body: { fullName, email, password: staffPassword, role },
  })
  assert.equal(created.status, 201)
  const row = await pool.query<{ id: string }>(`SELECT id::text FROM users WHERE email = $1`, [email])
  return Number(row.rows[0]?.id)
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
  schedule?: { id?: number }
  guides?: { email?: string; password_hash?: string }[]
  assignments?: { scheduleId?: number; status?: string }[]
  departure?: { guideUserId?: number | null; assignmentId?: number | null; guideName?: string | null }
  dashboard?: { upcomingCount?: number }
  assignment?: { confirmedVisitors?: number; checkedInVisitors?: number; expectedVisitors?: number }
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
