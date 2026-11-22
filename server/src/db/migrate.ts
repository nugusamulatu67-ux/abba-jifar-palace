import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { projectRoot } from '../config/env.ts'

const { Client } = pg

const migrationsDir = path.join(projectRoot, 'database', 'migrations')

export async function migrate(connectionString: string): Promise<string[]> {
  const client = new Client({ connectionString })
  await client.connect()
  const applied: string[] = []

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file])
      if ((existing.rowCount ?? 0) > 0) {
        continue
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied.push(file)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.end()
  }

  return applied
}
