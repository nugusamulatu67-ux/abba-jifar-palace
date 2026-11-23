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
const touristEmail = `phase7-tourist-${stamp}@abba-jifar.local`
const otherEmail = `phase7-other-${stamp}@abba-jifar.local`
const receptionEmail = `phase7-reception-${stamp}@abba-jifar.local`
const guideEmail = `phase7-guide-${stamp}@abba-jifar.local`
const staffPassword = 'staff-pass-1'

let baseUrl = ''
let server: ReturnType<typeof createServer>
let adminCookie = ''
let touristCookie = ''
let otherCookie = ''
let receptionCookie = ''
let guideCookie = ''

describe('payments and tickets', { concurrency: 1 }, () => {
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
    touristCookie = await register(touristEmail, 'Phase7 Visitor')
    otherCookie = await register(otherEmail, 'Phase7 Other')
    await request('/api/admin/users', {
      method: 'POST',
      cookie: adminCookie,
      body: { fullName: 'Phase7 Reception', email: receptionEmail, password: staffPassword, role: 'receptionist' },
    })
    await request('/api/admin/users', {
      method: 'POST',
      cookie: adminCookie,
      body: { fullName: 'Phase7 Guide', email: guideEmail, password: staffPassword, role: 'tour_guide' },
    })
    receptionCookie = await login(receptionEmail)
    guideCookie = await login(guideEmail)
  })

  test.after(async () => {
    await pool.query('DROP TRIGGER IF EXISTS phase7_block_ticket ON tickets')
    await pool.query('DROP FUNCTION IF EXISTS phase7_block_ticket()')
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await pool.query(
      `DELETE FROM audit_logs
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@abba-jifar.local')
          OR entity_id IN (
            SELECT reference FROM bookings
            JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
            JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
            WHERE tour_packages.name LIKE 'Phase7 %'
          )`,
    )
    await pool.query(
      `DELETE FROM tickets
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase7 %'
       )`,
    )
    await pool.query(
      `DELETE FROM payments
       WHERE booking_id IN (
         SELECT bookings.id FROM bookings
         JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase7 %'
       )`,
    )
    await pool.query(
      `DELETE FROM bookings
       WHERE tour_schedule_id IN (
         SELECT tour_schedules.id FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         WHERE tour_packages.name LIKE 'Phase7 %'
       )`,
    )
    await pool.query(
      `DELETE FROM tour_schedules
       WHERE tour_package_id IN (SELECT id FROM tour_packages WHERE name LIKE 'Phase7 %')`,
    )
    await pool.query(`DELETE FROM tour_packages WHERE name LIKE 'Phase7 %'`)
    await pool.query(
      `DELETE FROM tourists WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@abba-jifar.local')`,
    )
    await pool.query(`DELETE FROM users WHERE email LIKE 'phase7-%@abba-jifar.local'`)
  })

  test('a tourist sees their own unpaid booking and cannot record payment', async () => {
    const reference = await book(`Phase7 Own ${stamp}`, touristCookie, 2, 300)
    const own = await request(`/api/payments/${reference}`, { cookie: touristCookie })
    assert.equal(own.status, 200)
    assert.equal(own.json.payment?.paymentStatus, 'unpaid')
    assert.equal(own.json.payment?.method, null)
    assert.equal(own.json.payment?.amountEtb, 600)
    assert.equal(own.json.payment?.ticket, null)

    const hidden = await request(`/api/payments/${reference}`, { cookie: otherCookie })
    assert.equal(hidden.status, 404)
    const touristPay = await request('/api/reception/payments', {
      method: 'POST',
      cookie: touristCookie,
      body: { reference, method: 'cash', amountEtb: 1 },
    })
    assert.equal(touristPay.status, 403)
    const touristAdmin = await request('/api/admin/payments', {
      method: 'POST',
      cookie: touristCookie,
      body: { reference, method: 'cash' },
    })
    assert.equal(touristAdmin.status, 403)
    const tickets = await pool.query(
      'SELECT tickets.id FROM tickets JOIN bookings ON bookings.id = tickets.booking_id WHERE bookings.reference = $1',
      [reference],
    )
    assert.equal(tickets.rowCount, 0)
  })

  test('reception and an administrator record the server amount once, and a ticket is issued', async () => {
    const receptionReference = await book(`Phase7 Reception ${stamp}`, touristCookie, 2, 300)
    const recorded = await request('/api/reception/payments', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference: receptionReference, method: 'transfer', amountEtb: 1 },
    })
    assert.equal(recorded.status, 201)
    assert.equal(recorded.json.payment?.paymentStatus, 'paid')
    assert.equal(recorded.json.payment?.method, 'transfer')
    assert.equal(recorded.json.payment?.amountEtb, 600)
    assert.equal(recorded.json.payment?.ticket?.status, 'valid')
    assert.match(recorded.json.payment?.ticket?.qrDataUrl ?? '', /^data:image\/png;base64,/)

    const stored = await pool.query<{ amount_etb: number; status: string; token: string }>(
      `SELECT payments.amount_etb, payments.status, tickets.token
       FROM payments
       JOIN bookings ON bookings.id = payments.booking_id
       JOIN tickets ON tickets.booking_id = bookings.id
       WHERE bookings.reference = $1`,
      [receptionReference],
    )
    assert.equal(stored.rows[0]?.amount_etb, 600)
    assert.equal(stored.rows[0]?.status, 'paid')
    const firstToken = stored.rows[0]?.token ?? ''
    assert.match(firstToken, /^[A-Za-z0-9_-]{32,80}$/)

    const again = await request('/api/reception/payments', {
      method: 'POST',
      cookie: receptionCookie,
      body: { reference: receptionReference, method: 'cash' },
    })
    assert.equal(again.status, 409)
    const ticketCount = await pool.query(
      `SELECT tickets.id FROM tickets JOIN bookings ON bookings.id = tickets.booking_id WHERE bookings.reference = $1`,
      [receptionReference],
    )
    assert.equal(ticketCount.rowCount, 1)

    const audit = await pool.query<{ action: string; details: { method?: string; amountEtb?: number } }>(
      `SELECT action, details FROM audit_logs WHERE entity_id = $1 AND action = 'payment.record'`,
      [receptionReference],
    )
    assert.equal(audit.rowCount, 1)
    assert.equal(audit.rows[0]?.details.method, 'transfer')
    assert.equal(audit.rows[0]?.details.amountEtb, 600)

    const verified = await request(`/api/tickets/${firstToken}/verify`)
    assert.equal(verified.status, 200)
    assert.equal(verified.json.ticket?.valid, true)
    assert.equal(verified.json.ticket?.reference, receptionReference)
    assert.equal(JSON.stringify(verified.json).includes(touristEmail), false)
    assert.equal(JSON.stringify(verified.json).includes(firstToken), false)

    const adminReference = await book(`Phase7 Admin ${stamp}`, otherCookie, 1, 200)
    const adminPaid = await request('/api/admin/payments', {
      method: 'POST',
      cookie: adminCookie,
      body: { reference: adminReference, method: 'cash', amountEtb: 5 },
    })
    assert.equal(adminPaid.status, 201)
    assert.equal(adminPaid.json.payment?.amountEtb, 200)
    assert.equal(adminPaid.json.payment?.method, 'cash')
    const second = await pool.query<{ token: string }>(
      `SELECT tickets.token FROM tickets JOIN bookings ON bookings.id = tickets.booking_id WHERE bookings.reference = $1`,
      [adminReference],
    )
    const secondToken = second.rows[0]?.token ?? ''
    assert.notEqual(secondToken, firstToken)
    await assert.rejects(pool.query('UPDATE tickets SET token = $1 WHERE token = $2', [firstToken, secondToken]))

    const listed = await request(`/api/admin/payments?q=${encodeURIComponent(adminReference)}&status=paid&method=cash`, {
      cookie: adminCookie,
    })
    assert.equal(listed.status, 200)
    assert.equal(listed.json.payments?.some((item) => item.reference === adminReference), true)
    const detail = await request(`/api/admin/payments/${adminReference}`, { cookie: adminCookie })
    assert.equal(detail.status, 200)
    assert.equal(detail.json.payment?.audits?.some((item) => item.action === 'payment.record'), true)
  })

  test('a guide cannot use payment routes, and cancelled or unpaid bookings have no valid ticket', async () => {
    const reference = await book(`Phase7 Closed ${stamp}`, touristCookie, 1, 150)
    const guideView = await request(`/api/payments/${reference}`, { cookie: guideCookie })
    assert.equal(guideView.status, 403)
    const guideList = await request('/api/reception/payments', { cookie: guideCookie })
    assert.equal(guideList.status, 403)
    const guidePay = await request('/api/reception/payments', {
      method: 'POST',
      cookie: guideCookie,
      body: { reference, method: 'cash' },
    })
    assert.equal(guidePay.status, 403)
    const guideAdmin = await request('/api/admin/payments', { cookie: guideCookie })
    assert.equal(guideAdmin.status, 403)

    const cancelled = await request(`/api/bookings/${reference}/cancel`, { method: 'POST', cookie: touristCookie })
    assert.equal(cancelled.status, 200)
    const payCancelled = await request('/api/admin/payments', {
      method: 'POST',
      cookie: adminCookie,
      body: { reference, method: 'cash' },
    })
    assert.equal(payCancelled.status, 400)
    const bookingId = await bookingIdFor(reference)
    await assert.rejects(
      pool.query(`INSERT INTO tickets (booking_id, token, status) VALUES ($1, $2, 'valid')`, [
        bookingId,
        'a'.repeat(32),
      ]),
    )

    const paidReference = await book(`Phase7 Void ${stamp}`, touristCookie, 1, 150)
    const paid = await request('/api/admin/payments', {
      method: 'POST',
      cookie: adminCookie,
      body: { reference: paidReference, method: 'cash' },
    })
    assert.equal(paid.status, 201)
    const token = await ticketToken(paidReference)
    await request(`/api/bookings/${paidReference}/cancel`, { method: 'POST', cookie: touristCookie })
    const after = await pool.query<{ status: string }>(
      `SELECT tickets.status FROM tickets JOIN bookings ON bookings.id = tickets.booking_id WHERE bookings.reference = $1`,
      [paidReference],
    )
    assert.equal(after.rows[0]?.status, 'void')
    const check = await request(`/api/tickets/${token}/verify`)
    assert.equal(check.status, 200)
    assert.equal(check.json.ticket?.valid, false)
    const missing = await request(`/api/tickets/${'b'.repeat(32)}/verify`)
    assert.equal(missing.status, 404)
  })

  test('a failed ticket insert rolls the payment back', async () => {
    const reference = await book(`Phase7 Rollback ${stamp}`, touristCookie, 1, 100)
    await pool.query(`
      CREATE OR REPLACE FUNCTION phase7_block_ticket() RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'phase7_ticket_failure' USING ERRCODE = '23514';
      END;
      $$
    `)
    await pool.query(`
      CREATE TRIGGER phase7_block_ticket
      BEFORE INSERT ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION phase7_block_ticket()
    `)
    try {
      const failed = await request('/api/admin/payments', {
        method: 'POST',
        cookie: adminCookie,
        body: { reference, method: 'cash' },
      })
      assert.equal(failed.status, 500)
      const payment = await pool.query<{ status: string }>(
        `SELECT payments.status FROM payments JOIN bookings ON bookings.id = payments.booking_id WHERE bookings.reference = $1`,
        [reference],
      )
      assert.equal(payment.rows[0]?.status, 'unpaid')
      const tickets = await pool.query(
        `SELECT tickets.id FROM tickets JOIN bookings ON bookings.id = tickets.booking_id WHERE bookings.reference = $1`,
        [reference],
      )
      assert.equal(tickets.rowCount, 0)
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS phase7_block_ticket ON tickets')
      await pool.query('DROP FUNCTION IF EXISTS phase7_block_ticket()')
    }
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

async function login(email: string): Promise<string> {
  const signedIn = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: staffPassword },
  })
  assert.equal(signedIn.status, 200)
  return signedIn.cookie
}

async function book(name: string, cookie: string, partySize: number, priceEtb: number): Promise<string> {
  const scheduleId = await openSchedule(name, priceEtb)
  const created = await request('/api/bookings', {
    method: 'POST',
    cookie,
    body: { scheduleId, partySize, amountEtb: 1 },
  })
  assert.equal(created.status, 201)
  const reference = created.json.booking?.reference
  assert.ok(reference)
  return reference
}

async function openSchedule(name: string, priceEtb: number): Promise<number> {
  const created = await request('/api/admin/tours', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name,
      description: 'A phase 7 package used only by the automated payment tests.',
      priceEtb,
      durationMinutes: 60,
      category: 'History',
      includedActivities: 'A guided walk',
      maxGroupSize: 10,
    },
  })
  assert.equal(created.status, 201)
  const schedule = await request('/api/admin/schedules', {
    method: 'POST',
    cookie: adminCookie,
    body: { packageId: created.json.package?.id, date: '2027-09-01', startTime: '09:00', endTime: '10:00', maxCapacity: 8 },
  })
  assert.equal(schedule.status, 201)
  const scheduleId = schedule.json.schedule?.id
  assert.ok(scheduleId)
  return scheduleId
}

async function bookingIdFor(reference: string): Promise<string> {
  const result = await pool.query<{ id: string }>('SELECT id::text FROM bookings WHERE reference = $1', [reference])
  const id = result.rows[0]?.id
  assert.ok(id)
  return id
}

async function ticketToken(reference: string): Promise<string> {
  const result = await pool.query<{ token: string }>(
    `SELECT tickets.token FROM tickets JOIN bookings ON bookings.id = tickets.booking_id WHERE bookings.reference = $1`,
    [reference],
  )
  const token = result.rows[0]?.token
  assert.ok(token)
  return token
}

interface PaymentBody {
  paymentStatus?: string
  method?: string | null
  amountEtb?: number
  ticket?: { status?: string; qrDataUrl?: string | null } | null
  audits?: { action?: string }[]
}

interface ApiBody {
  error?: string
  booking?: { reference?: string }
  payment?: PaymentBody
  payments?: { reference?: string }[]
  package?: { id?: number }
  schedule?: { id?: number }
  ticket?: { valid?: boolean; reference?: string }
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
