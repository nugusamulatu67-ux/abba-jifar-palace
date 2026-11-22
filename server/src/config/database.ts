import pg from 'pg'
import type { DatabaseHealth } from '../../../shared/src/index.ts'
import { env } from './env.ts'

const { Pool } = pg

export const pool = new Pool({ connectionString: env.databaseUrl })

export async function checkDatabaseConnection(): Promise<DatabaseHealth> {
  try {
    const result = await pool.query<{ ok: number }>('SELECT 1 AS ok')
    if (result.rows[0]?.ok !== 1) {
      return { status: 'unavailable', message: 'The database returned an unexpected result.' }
    }
    return { status: 'connected', message: 'PostgreSQL connection succeeded.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return { status: 'unavailable', message }
  }
}

export async function closePool(): Promise<void> {
  await pool.end()
}
