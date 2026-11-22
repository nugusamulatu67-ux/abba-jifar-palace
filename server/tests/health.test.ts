import assert from 'node:assert/strict'
import fs from 'node:fs'
import type { Server } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { checkDatabaseConnection } from '../src/config/database.ts'
import { createApp } from '../src/app.ts'

test('SQLite connection succeeds for a new database file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abba-jifar-'))
  const databasePath = path.join(dir, 'test.sqlite')

  try {
    const result = checkDatabaseConnection(databasePath)
    assert.equal(result.status, 'connected')
    assert.equal(fs.existsSync(databasePath), true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
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
      database: { status: string }
    }

    assert.equal(response.status, 200)
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'abba-jifar-api')
    assert.equal(body.database.status, 'connected')
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})
