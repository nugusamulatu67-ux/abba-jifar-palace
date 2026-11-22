import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { checkDatabaseConnection, closePool } from '../src/config/database.ts'

test('PostgreSQL connection succeeds', async () => {
  const result = await checkDatabaseConnection()
  assert.equal(result.status, 'connected')
  assert.equal(result.message, 'PostgreSQL connection succeeded.')
})

test('GET /api/health reports the API and the configured database', async () => {
  const app = createApp()
  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
  })

  try {
    const address = server.address()
    assert.ok(address && typeof address === 'object')

    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`)
    const body = (await response.json()) as {
      status: string
      service: string
      database: { status: string; message: string }
    }

    assert.equal(response.status, 200)
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'abba-jifar-api')
    assert.equal(body.database.status, 'connected')
    assert.equal(body.database.message, 'PostgreSQL connection succeeded.')
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})

test.after(async () => {
  await closePool()
})
