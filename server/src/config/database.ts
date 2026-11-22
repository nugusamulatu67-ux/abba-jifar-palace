import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { DatabaseHealth } from '../../../shared/src/index.ts'
import { env } from './env.ts'

/**
 * Opens the SQLite database file and creates its folder on first use.
 * Phase 1 only checks that the connection works. Tables are added in a later phase.
 */
export function openDatabase(databasePath: string = env.databasePath): DatabaseSync {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  return new DatabaseSync(databasePath)
}

export function checkDatabaseConnection(databasePath: string = env.databasePath): DatabaseHealth {
  try {
    const db = openDatabase(databasePath)
    try {
      const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined
      if (row?.ok !== 1) {
        return { status: 'unavailable', message: 'The database returned an unexpected result.' }
      }
      return { status: 'connected', message: 'SQLite connection succeeded.' }
    } finally {
      db.close()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return { status: 'unavailable', message }
  }
}
