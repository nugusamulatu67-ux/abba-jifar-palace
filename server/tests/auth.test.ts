import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, test } from 'node:test'
import { env } from '../src/config/env.ts'
import { closePool, pool } from '../src/config/database.ts'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { createApp } from '../src/app.ts'

const stamp = Date.now()
const touristEmail = `phase3-tourist-${stamp}@abba-jifar.local`
const guideEmail = `phase3-guide-${stamp}@abba-jifar.local`
const receptionistEmail = `phase3-reception-${stamp}@abba-jifar.local`
const touristPassword = 'visitor-pass-1'
const staffPassword = 'staff-pass-1'

let baseUrl = ''
let server: ReturnType<typeof createServer>

describe('authentication and authorization', { concurrency: 1 }, () => {
test.before(async () => {
  await migrate(env.databaseUrl)
  await seed(env.databaseUrl)
  server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  await pool.query(`DELETE FROM tourists WHERE email LIKE 'phase3-%@abba-jifar.local'`)
  await pool.query(
    `DELETE FROM guides WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase3-%@abba-jifar.local')`,
  )
  await pool.query(`DELETE FROM users WHERE email LIKE 'phase3-%@abba-jifar.local'`)
  await closePool()
})

test('a tourist can register, sign in, and is never given a staff role', async () => {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: '  Phase3 Visitor  ',
      email: touristEmail.toUpperCase(),
      password: touristPassword,
      phone: '0911222333',
      role: 'administrator',
    },
  })
  assert.equal(registered.status, 201)
  const registeredUser = userFrom(registered.json)
  assert.equal(registeredUser.role, 'tourist')
  assert.equal(registeredUser.email, touristEmail)
  assert.equal(registeredUser.passwordHash, undefined)
  assert.equal(registeredUser.password_hash, undefined)
  assert.equal(registered.cookie.includes('abba_session='), true)

  const profile = await request('/api/auth/me', { cookie: registered.cookie })
  assert.equal(profile.status, 200)
  assert.equal(userFrom(profile.json).fullName, 'Phase3 Visitor')

  const signedOut = await request('/api/auth/logout', { method: 'POST', cookie: registered.cookie })
  assert.equal(signedOut.status, 200)
  const afterLogout = await request('/api/auth/me', { cookie: registered.cookie })
  assert.equal(afterLogout.status, 401)

  const signedIn = await request('/api/auth/login', {
    method: 'POST',
    body: { email: touristEmail, password: touristPassword },
  })
  assert.equal(signedIn.status, 200)
  assert.equal(userFrom(signedIn.json).role, 'tourist')
})

test('incorrect credentials are rejected and repeated failures are locked', async () => {
  const wrong = await request('/api/auth/login', {
    method: 'POST',
    body: { email: touristEmail, password: 'not-the-password' },
  })
  assert.equal(wrong.status, 401)
  assert.equal(wrong.json.error, 'Email or password is incorrect.')

  const lockEmail = `phase3-lock-${stamp}@abba-jifar.local`
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await request('/api/auth/login', {
      method: 'POST',
      body: { email: lockEmail, password: 'wrong-password' },
    })
    assert.equal(failed.status, 401)
  }
  const locked = await request('/api/auth/login', {
    method: 'POST',
    body: { email: lockEmail, password: 'wrong-password' },
  })
  assert.equal(locked.status, 429)
})

test('passwords are stored as bcrypt hashes', async () => {
  const stored = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE email = $1',
    [touristEmail],
  )
  const hash = stored.rows[0]?.password_hash ?? ''
  assert.equal(hash.startsWith('$2'), true)
  assert.equal(hash.includes(touristPassword), false)
  assert.equal(JSON.stringify(stored.rows[0]).includes(touristPassword), false)
})

test('a logged-out request cannot reach protected endpoints', async () => {
  const profile = await request('/api/auth/me')
  const admin = await request('/api/admin/access')
  assert.equal(profile.status, 401)
  assert.equal(admin.status, 401)
})

test('roles are enforced on the server', async () => {
  const admin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: env.seedAdminEmail, password: env.seedAdminPassword },
  })
  assert.equal(admin.status, 200)
  assert.equal(userFrom(admin.json).role, 'administrator')
  const adminArea = await request('/api/admin/access', { cookie: admin.cookie })
  assert.equal(adminArea.status, 200)

  const guide = await request('/api/admin/users', {
    method: 'POST',
    cookie: admin.cookie,
    body: { fullName: 'Phase3 Guide', email: guideEmail, password: staffPassword, role: 'tour_guide' },
  })
  assert.equal(guide.status, 201)
  assert.equal(userFrom(guide.json).role, 'tour_guide')
  assert.equal(userFrom(guide.json).password_hash, undefined)

  const reception = await request('/api/admin/users', {
    method: 'POST',
    cookie: admin.cookie,
    body: {
      fullName: 'Phase3 Reception',
      email: receptionistEmail,
      password: staffPassword,
      role: 'receptionist',
    },
  })
  assert.equal(reception.status, 201)

  const tourist = await request('/api/auth/login', {
    method: 'POST',
    body: { email: touristEmail, password: touristPassword },
  })
  const touristAdmin = await request('/api/admin/access', { cookie: tourist.cookie })
  assert.equal(touristAdmin.status, 403)

  const guideSession = await request('/api/auth/login', {
    method: 'POST',
    body: { email: guideEmail, password: staffPassword },
  })
  const guideReception = await request('/api/reception/access', { cookie: guideSession.cookie })
  const guideOwn = await request('/api/guide/access', { cookie: guideSession.cookie })
  assert.equal(guideReception.status, 403)
  assert.equal(guideOwn.status, 200)

  const receptionSession = await request('/api/auth/login', {
    method: 'POST',
    body: { email: receptionistEmail, password: staffPassword },
  })
  const receptionAdmin = await request('/api/admin/access', { cookie: receptionSession.cookie })
  const receptionOwn = await request('/api/reception/access', { cookie: receptionSession.cookie })
  assert.equal(receptionAdmin.status, 403)
  assert.equal(receptionOwn.status, 200)

  const publicStaff = await request('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Phase3 Fake Admin',
      email: `phase3-fake-${stamp}@abba-jifar.local`,
      password: touristPassword,
      role: 'administrator',
    },
  })
  assert.equal(publicStaff.status, 201)
  assert.equal(userFrom(publicStaff.json).role, 'tourist')
})

test('the PostgreSQL health check still works', async () => {
  const health = await request('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.json.status, 'ok')
  assert.ok(health.json.database)
  assert.equal(health.json.database.status, 'connected')
})

test('authentication responses use the error field the website displays', async () => {
  const missing = await request('/api/auth/register', {
    method: 'POST',
    body: { fullName: 'A', email: 'not-an-email', password: 'short' },
  })
  assert.equal(missing.status, 400)
  assert.equal(typeof missing.json.error, 'string')

  const denied = await request('/api/auth/login', {
    method: 'POST',
    body: { email: touristEmail, password: touristPassword },
  })
  const forbidden = await request('/api/admin/access', { cookie: denied.cookie })
  assert.equal(forbidden.status, 403)
  assert.equal(typeof forbidden.json.error, 'string')
  assert.equal(JSON.stringify(forbidden.json).includes('password'), false)
})
})

interface ApiBody {
  error?: string
  status?: string
  user?: { role?: string; email?: string; fullName?: string; passwordHash?: string; password_hash?: string }
  database?: { status?: string }
  [key: string]: unknown
}

function userFrom(body: ApiBody): NonNullable<ApiBody['user']> {
  assert.ok(body.user)
  return body.user
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
